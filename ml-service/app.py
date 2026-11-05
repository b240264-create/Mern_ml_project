"""
FastAPI scoring service. Run:  uvicorn app:app --host 0.0.0.0 --port 8000
Env: MODEL_PATH (default artifacts/model.joblib), ML_API_KEY (optional shared secret for x-api-key header)
"""
import hashlib
import json, os
from typing import List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from train import FEATS, LOG_COLS

MODEL_PATH = os.getenv("MODEL_PATH", "artifacts/model.joblib")
API_KEY = os.getenv("ML_API_KEY")

A = joblib.load(MODEL_PATH)
stable_names = {}
stable_items = []
for item_id in A["items"]:
    name = A["item_names"][item_id]
    stable_id = hashlib.sha256(name.encode("utf-8")).hexdigest()[:24]
    if stable_id in stable_names:
        raise ValueError(f"Duplicate product name in model: {name}")
    stable_items.append(stable_id)
    stable_names[stable_id] = name
A["items"] = stable_items
A["item_index"] = {item_id: i for i, item_id in enumerate(stable_items)}
A["item_names"] = stable_names
try:
    with open(os.path.join(os.path.dirname(MODEL_PATH), "metadata.json")) as f:
        META = json.load(f)
except FileNotFoundError:
    META = {}

app = FastAPI(title="Personalization service", version="1.0")


def check_key(x_api_key: Optional[str] = Header(default=None)):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid api key")


class CustomerIn(BaseModel):
    recency_days: float = Field(0, ge=0, description="days since last order")
    frequency: int = Field(0, ge=0, description="number of orders")
    monetary: float = Field(0, ge=0, description="total spend")
    unique_products: int = Field(0, ge=0)
    tenure_days: float = Field(0, ge=0, description="days since first order")
    purchased_product_ids: List[str] = []
    top_n: int = Field(8, ge=1, le=50)


class Recommendation(BaseModel):
    product_id: str
    name: str
    score: float


class Insights(BaseModel):
    segment: str
    segment_tier: int
    purchase_probability: Optional[float]
    offer: str
    recommendations: List[Recommendation]
    model_trained_at: Optional[str] = None


def _norm(v):
    return v / (v.max() + 1e-9)


def _recommend(scores, exclude_idx, n):
    scores = scores.copy()
    scores[exclude_idx] = -np.inf
    top = [i for i in np.argsort(-scores)[:n] if np.isfinite(scores[i])]
    return [Recommendation(product_id=A["items"][i], name=A["item_names"][A["items"][i]],
                           score=round(float(scores[i]), 4)) for i in top]


@app.get("/health")
def health():
    return {"status": "ok", "model": META}


@app.post("/v1/insights", response_model=Insights, dependencies=[Depends(check_key)])
def insights(c: CustomerIn):
    owned = [A["item_index"][p] for p in c.purchased_product_ids if p in A["item_index"]]
    trained_at = META.get("trained_at")

    # Cold start: no order history -> popularity + welcome offer
    if c.frequency == 0:
        return Insights(segment="New", segment_tier=-1, purchase_probability=None, offer=A["welcome_offer"],
                        recommendations=_recommend(A["global_pop"].astype(float), owned, c.top_n),
                        model_trained_at=trained_at)

    # Engine 1: segment
    Z = A["scaler"].transform(np.log1p(pd.DataFrame(
        [[c.recency_days, c.frequency, c.monetary]], columns=["recency", "frequency", "monetary"])))
    segment = A["cluster_name"][int(A["km"].predict(Z)[0])]
    tier = A["segments"].index(segment)

    # Engine 2a: purchase probability
    row = pd.DataFrame([{"recency": c.recency_days, "frequency": c.frequency, "monetary": c.monetary,
                         "avg_basket": c.monetary / max(c.frequency, 1),
                         "unique_products": c.unique_products or len(set(c.purchased_product_ids)),
                         "tenure": c.tenure_days}])[FEATS]
    for col in LOG_COLS:
        row[col] = np.log1p(row[col])
    for s in A["segments"]:
        row["Seg_" + s] = int(s == segment)
    prob = float(A["propensity"].predict_proba(row[A["feature_columns"]])[0, 1])

    # Engine 2a: hybrid recommendation (segment popularity + item-based CF)
    ui = np.zeros(len(A["items"]), dtype=np.float32)
    ui[owned] = 1
    cf = ui @ A["sim"]
    scores = A["alpha"] * _norm(A["seg_pop"][tier].astype(float)) + (1 - A["alpha"]) * _norm(cf.astype(float))

    return Insights(segment=segment, segment_tier=tier, purchase_probability=round(prob, 4),
                    offer=A["offers"][segment], recommendations=_recommend(scores, owned, c.top_n),
                    model_trained_at=trained_at)
