"""
Trains the dual-engine model and saves it to artifacts/model.joblib.

Input: an orders CSV with one row per purchased line item and these columns:
    customer_id, product_id, product_name, invoice_id, quantity, price, order_date

Usage:
    python train.py --orders orders.csv
    python train.py --synthetic            # quick dry run with fake data

Engine 1  : RFM + K-Means segmentation
Engine 2a : purchase-propensity model + hybrid item recommender
Engine 2b : LinUCB offer policy (learned on a SIMULATED environment, see learn_offers)
"""
import argparse, json, os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score, silhouette_score
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

SEED = 42
HOLDOUT_DAYS = 90
TOP_ITEMS = 1500
K_RANGE = range(3, 7)
FEATS = ["recency", "frequency", "monetary", "avg_basket", "unique_products", "tenure"]
LOG_COLS = ["frequency", "monetary", "avg_basket", "unique_products"]
NAMES = ["Champions", "Loyal", "Potential", "At-Risk", "Hibernating", "Lost"]
OFFERS = ["No offer", "10% discount", "20% discount", "Free shipping", "Loyalty points", "Bundle deal"]
MARGIN = np.array([1.00, 0.90, 0.80, 0.85, 0.95, 0.95])
REQUIRED = ["customer_id", "product_id", "invoice_id", "quantity", "price", "order_date"]


# ------------------------------------------------------------------ data
def make_synthetic(n_customers=800, n_products=300, days=480):
    rng = np.random.default_rng(SEED)
    start = pd.Timestamp("2025-01-01")
    pids = [f"SKU{10000 + i}" for i in range(n_products)]
    price = rng.uniform(1, 25, n_products).round(2)
    cat = rng.integers(0, 6, n_products)
    pop = rng.dirichlet(np.ones(n_products) * 0.5)
    ctype = rng.choice(4, n_customers, p=[.15, .30, .35, .20])
    pref = rng.integers(0, 6, n_customers)
    rows, inv = [], 100000
    for c in range(n_customers):
        t = ctype[c]
        for _ in range([30, 12, 4, 2][t] + int(rng.integers(0, 3))):
            active = days if t < 3 else days // 3
            d = start + pd.Timedelta(days=int(rng.integers(0, active)))
            w = pop * np.where(cat == pref[c], 4.0, 1.0); w /= w.sum()
            inv += 1
            for i in rng.choice(n_products, size=int(rng.integers(2, 12)), replace=False, p=w):
                rows.append((f"C{c}", pids[i], f"Product {pids[i]}", f"INV{inv}", int(rng.integers(1, 10)), price[i], d))
    return pd.DataFrame(rows, columns=["customer_id", "product_id", "product_name", "invoice_id",
                                       "quantity", "price", "order_date"])


def load_orders(path):
    df = pd.read_csv(path, parse_dates=["order_date"])
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise SystemExit(f"orders CSV is missing columns: {missing}")
    if "product_name" not in df.columns:
        df["product_name"] = df["product_id"].astype(str)
    return df


def clean(df):
    df = df.dropna(subset=["customer_id", "product_id", "order_date"]).copy()
    df["customer_id"] = df["customer_id"].astype(str)
    df["product_id"] = df["product_id"].astype(str)
    df["order_date"] = pd.to_datetime(df["order_date"]).dt.tz_localize(None)
    df = df[(df["quantity"] > 0) & (df["price"] > 0)]
    df["revenue"] = df["quantity"] * df["price"]
    return df.drop_duplicates().reset_index(drop=True)


# ------------------------------------------------------------------ engine 1
def build_rfm(d, snapshot):
    o = d.groupby("customer_id").agg(last=("order_date", "max"), first=("order_date", "min"),
                                     frequency=("invoice_id", "nunique"), monetary=("revenue", "sum"),
                                     unique_products=("product_id", "nunique"))
    o["recency"] = (snapshot - o["last"]).dt.days
    o["tenure"] = (snapshot - o["first"]).dt.days
    o["avg_basket"] = o["monetary"] / o["frequency"]
    return o[FEATS]


def model_features(rfm, seg_names, segments):
    X = rfm[FEATS].copy()
    for c in LOG_COLS:
        X[c] = np.log1p(X[c])
    for s in segments:
        X["Seg_" + s] = (np.asarray(seg_names) == s).astype(int)
    return X


def fit_segmenter(rfm):
    Xl = np.log1p(rfm[["recency", "frequency", "monetary"]])
    scaler = StandardScaler().fit(Xl)
    Z = scaler.transform(Xl)
    best = max(K_RANGE, key=lambda k: silhouette_score(Z, KMeans(k, n_init=10, random_state=SEED).fit_predict(Z)))
    km = KMeans(best, n_init=10, random_state=SEED).fit(Z)
    prof = rfm.assign(c=km.labels_).groupby("c")[["recency", "frequency", "monetary"]].mean()
    score = prof["recency"].rank(ascending=False) + prof["frequency"].rank() + prof["monetary"].rank()
    order = list(score.sort_values(ascending=False).index)
    cluster_name = {int(c): NAMES[i] for i, c in enumerate(order)}
    segments = [cluster_name[int(c)] for c in order]          # best -> worst
    return scaler, km, cluster_name, segments


def assign_segments(rfm, scaler, km, cluster_name):
    Z = scaler.transform(np.log1p(rfm[["recency", "frequency", "monetary"]]))
    return np.array([cluster_name[int(c)] for c in km.predict(Z)])


# ------------------------------------------------------------------ engine 2b
def learn_offers(n_seg, seg_probs, T=30000, alpha=0.5, seed=0):
    """Learns the best offer per segment with LinUCB on a SIMULATED environment.
    With one-hot segment context, disjoint LinUCB reduces to a per-(segment, offer) ridge mean with
    bonus alpha / sqrt(1 + n), which is what is implemented here. REPLACE the simulated rewards with
    real logged offer outcomes once you run offers in production."""
    n_arm = len(OFFERS)
    base = np.linspace(0.30, 0.08, n_seg)
    pos = np.arange(n_seg) / max(n_seg - 1, 1)
    peaks = {1: 0.75, 2: 1.0, 3: 0.5, 4: 0.0, 5: 0.25}
    lift = np.ones((n_seg, n_arm))
    for a, pk in peaks.items():
        lift[:, a] = 1 + 1.5 * np.exp(-((pos - pk) ** 2) / (2 * 0.15 ** 2))
    P = np.clip(base[:, None] * lift, 0, 1)
    rng = np.random.default_rng(seed)
    n = np.zeros((n_seg, n_arm)); s = np.zeros((n_seg, n_arm))
    for c in rng.choice(n_seg, size=T, p=seg_probs):
        ucb = s[c] / (1 + n[c]) + alpha / np.sqrt(1 + n[c])
        a = int(np.argmax(ucb))
        r = float(rng.random() < P[c, a]) * MARGIN[a]
        n[c, a] += 1; s[c, a] += r
    return [OFFERS[int(a)] for a in (s / (1 + n)).argmax(1)]


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--orders", help="orders CSV (see module docstring)")
    ap.add_argument("--synthetic", action="store_true")
    ap.add_argument("--out", default="artifacts")
    args = ap.parse_args()
    if not args.orders and not args.synthetic:
        ap.error("give --orders orders.csv or --synthetic")

    df = clean(make_synthetic() if args.synthetic else load_orders(args.orders))
    print(f"{len(df):,} line items | {df.customer_id.nunique():,} customers | {df.product_id.nunique():,} products")

    now = df["order_date"].max()
    cutoff = now - pd.Timedelta(days=HOLDOUT_DAYS)
    hist, future = df[df["order_date"] <= cutoff], df[df["order_date"] > cutoff]

    # Engine 1 (fit on history so propensity labels are honest)
    rfm_h = build_rfm(hist, cutoff)
    scaler, km, cluster_name, segments = fit_segmenter(rfm_h)
    seg_h = assign_segments(rfm_h, scaler, km, cluster_name)
    print("Segments (best -> worst):", segments)

    # Engine 2a: purchase propensity
    X = model_features(rfm_h, seg_h, segments)
    y = rfm_h.index.isin(future["customer_id"]).astype(int)
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.25, stratify=y, random_state=SEED)
    rf = RandomForestClassifier(n_estimators=300, min_samples_leaf=5, class_weight="balanced",
                                random_state=SEED, n_jobs=-1).fit(Xtr, ytr)
    auc = float(roc_auc_score(yte, rf.predict_proba(Xte)[:, 1]))
    print(f"Propensity model ROC-AUC (held out): {auc:.3f}")
    rf.fit(X, y)                                              # refit on everything for production

    # Engine 2a: recommender on ALL data (fresher), segments from the fitted segmenter
    rfm_all = build_rfm(df, now)
    seg_all = assign_segments(rfm_all, scaler, km, cluster_name)
    items = list(df["product_id"].value_counts().head(TOP_ITEMS).index)
    ui = (df[df["product_id"].isin(items)].groupby(["customer_id", "product_id"]).size().unstack(fill_value=0)
            .reindex(index=rfm_all.index, columns=items, fill_value=0).values > 0).astype(np.float32)
    sim = cosine_similarity(ui.T).astype(np.float32); np.fill_diagonal(sim, 0)
    seg_pop = np.vstack([ui[seg_all == s].mean(0) if (seg_all == s).any() else ui.mean(0) for s in segments])
    names = df.groupby("product_id")["product_name"].agg(lambda s: s.mode().iat[0]).to_dict()

    # Engine 2b
    probs = np.array([(seg_all == s).mean() for s in segments])
    offers = dict(zip(segments, learn_offers(len(segments), probs / probs.sum())))
    print("Offer per segment (simulated policy):", offers)

    artifacts = dict(scaler=scaler, km=km, cluster_name=cluster_name, segments=segments, propensity=rf,
                     feature_columns=list(X.columns), items=items, item_index={p: i for i, p in enumerate(items)},
                     sim=sim, seg_pop=seg_pop, global_pop=ui.mean(0), item_names={p: names.get(p, p) for p in items},
                     offers=offers, welcome_offer="10% discount", alpha=0.5)
    os.makedirs(args.out, exist_ok=True)
    joblib.dump(artifacts, os.path.join(args.out, "model.joblib"), compress=3)
    meta = dict(trained_at=datetime.now(timezone.utc).isoformat(), customers=int(len(rfm_all)),
                products_in_model=len(items), segments=segments, propensity_auc=round(auc, 4),
                data_through=str(now.date()), offers=offers)
    with open(os.path.join(args.out, "metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print("Saved", os.path.join(args.out, "model.joblib"))


if __name__ == "__main__":
    main()
