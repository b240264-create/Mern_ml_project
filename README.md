# Giftly: a MERN shop with a dual-engine ML personalisation service

A complete demo e-commerce app (MongoDB, Express, React, Node) plus a Python model service.
The model answers three questions for every customer:

| Engine | Question | Where you see it |
|---|---|---|
| **Engine 1: clustering** (RFM + K-Means) | Who is this customer? | Segment badge (Champions, Loyal, ..., Lost) |
| **Engine 2: prediction + recommender** | What will they buy, and will they come back? | "Recommended for you" shelf, purchase probability |
| **Engine 2: offer policy** (bandit) | Which offer should they see? | Offer banner, discount applied at checkout |

```
React (Vite) --/api--> Express --HTTP--> FastAPI model service
                          |
                       MongoDB (users, products, orders)
```

Express builds the customer's RFM numbers from their orders, asks the model service, swaps product ids for full
products and caches the answer for 10 minutes (the cache is cleared when the customer orders). **If the model service is
down or slow (2.5 s timeout), the shop keeps working** and shows popular products instead.

## What is in the app

- Register, log in (JWT), protected pages
- Catalogue with search, category filter, sorting, pagination, product page
- Cart (saved in the browser), checkout, order history
- Offer from the model applied at checkout (10% / 20% discount, free shipping); prices are always recomputed on the server
- "For you" page that shows the segment, purchase probability, offer and recommendations
- Seed script with 120 products, 404 customers and about 3,700 orders, so the model has data to learn from

## Requirements

Node 18+ (22 recommended), Python 3.10+, and MongoDB (local install, Atlas, or `docker compose up -d mongo`).

## Quick start (local)

Open four terminals from the project root.

**1. Database and API**
```bash
docker compose up -d mongo            # or use a MongoDB you already run
cd server
npm install
cp .env.example .env                  # set MONGO_URI / JWT_SECRET if needed
npm run seed                          # demo products, customers, orders
npm run export                        # writes ../ml-service/orders.csv
```

**2. Train the model and start the model service**
```bash
cd ml-service
pip install -r requirements.txt
python train.py --orders orders.csv   # writes artifacts/model.joblib (takes a few seconds)
ML_API_KEY=dev-ml-key uvicorn app:app --port 8000
```
(On Windows PowerShell: `$env:ML_API_KEY="dev-ml-key"; uvicorn app:app --port 8000`.)
`ML_API_KEY` must equal the value in `server/.env`.

**3. API server**
```bash
cd server && npm start                # http://localhost:5000
```

**4. Frontend**
```bash
cd client
npm install
npm run dev                           # http://localhost:5173
```

### Demo accounts (password `password123`)

| Email | Behaviour | What the model does |
|---|---|---|
| `champion@demo.com` | frequent, recent buyer | Champions, high purchase probability, loyalty offer |
| `regular@demo.com` | steady buyer | Loyal |
| `lapsed@demo.com` | last bought over a year ago | Lost, 20% discount to win them back |
| `new@demo.com` | no orders | cold start: bestsellers + welcome offer |

Try this: log in as `lapsed@demo.com`, add items to the cart, place an order, then open **For you**.
The customer moves to a better segment because the order changed their recency.

## Run with Docker (optional, untested: Docker was not available where this was built)

```bash
docker compose up -d --build mongo api web
docker compose run --rm api npm run seed
docker compose run --rm -v ./ml-service:/out api node src/scripts/exportOrders.js /out/orders.csv
docker compose run --rm -v ./ml-service:/app ml python train.py --orders orders.csv
docker compose up -d ml
```
Open http://localhost:8080.

## Deploy publicly (Render + MongoDB Atlas)

The included `render.yaml` deploys the web app, API, and ML service as separate Render services. MongoDB runs on Atlas. Render's free services can sleep when idle, so the first visit/request after a quiet period may take longer.

1. Push this project folder to a GitHub repository, with `render.yaml` at the repository root. Keep `ml-service/artifacts/model.joblib` and `ml-service/artifacts/metadata.json` in the repository; the ML Docker image needs them.
2. Create a MongoDB Atlas cluster and database user. Add `0.0.0.0/0` to Atlas Network Access so Render can connect (use a strong database password and never commit the connection string). Copy the Atlas connection URI and encode any special characters in the password.
3. In Render, create a Blueprint from that GitHub repository. Set `MONGO_URI` to the Atlas URI. Set `ML_API_KEY` on both the `giftly-api` and `giftly-ml` services to the same long random value. Render generates `JWT_SECRET` for the API.
4. Once the services are live, seed a new/empty Atlas database from PowerShell in the project folder:

   ```powershell
   Set-Location .\server
   $env:MONGO_URI = "mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority"
   npm install
   npm run seed
   Remove-Item Env:\MONGO_URI
   ```

   **Warning:** `npm run seed` deletes existing users, products, and orders in the configured database. Use it only with a fresh demo database. The product IDs are stable so they match the bundled recommendation model after reseeding.
5. Open the `giftly-web` URL from Render and share that HTTPS link. The frontend proxies `/api` to the API service, so the phone browser does not need any special network setup.

The demo accounts listed above all use `password123`; anyone can see these credentials in this README, so use them only for a public demo. For an actual shop, do not seed demo accounts and add production-grade monitoring, rate limits, and backups.

## API

| Method and path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | - / - / yes | accounts |
| `GET /api/products?q=&category=&sort=&page=&limit=` | - | catalogue (sort: popular, newest, price-asc, price-desc) |
| `GET /api/products/categories`, `GET /api/products/:id` | - | filters, product page |
| `POST /api/orders` | yes | place an order (applies the ML offer) |
| `GET /api/orders/mine` | yes | order history |
| `GET /api/insights/me` | yes | segment, purchase probability, offer, recommendations |
| `GET /api/insights/popular` | - | popular products |
| `GET /api/health` | - | API and model service status |

Model service: `POST /v1/insights` (header `x-api-key`) and `GET /health` on port 8000.

## Project layout

```
client/                 React + Vite
  src/pages, components, context (auth, cart), hooks/useInsights.js
server/
  src/models            User, Product, Order
  src/routes            auth, products, orders, insights
  src/services          mlClient.js (HTTP + timeout), insights.js (cache + fallback)
  src/utils             customerFeatures.js (orders -> RFM payload)
  src/scripts           seed.js, exportOrders.js
ml-service/
  train.py              trains and saves artifacts/model.joblib
  app.py                FastAPI scoring service
  test_api.py           pytest tests for the API (run after training)
```

## Retraining

The model learns from order history, so retrain when enough new orders arrive (for example nightly):
```bash
cd server && npm run export && cd ../ml-service && python train.py --orders orders.csv
```
Then restart the model service. `ml-service/artifacts/metadata.json` shows when it was trained and its held-out ROC-AUC.

## Using your own products and orders

`train.py` reads any CSV with the columns
`customer_id, product_id, product_name, invoice_id, quantity, price, order_date`.
`product_id` must be the same id Express sends (`String(item.product)`), otherwise recommendations will not match products in your database.
The model only recommends products it saw during training, so retrain after adding many new products.

## Honest limitations (mention these in your report)

- **The offer policy is learned in a simulation.** The shop has never shown real offers to real customers, so
  `learn_offers` in `train.py` uses assumed response rates. Every order records `offerApplied` and `segmentAtPurchase`;
  once you have real data, train the bandit on that instead.
- **Demo data is synthetic.** The seed script creates customers with four behaviour types, so the segments the model finds are
  partly baked into the data. Results on a real shop will be noisier.
- **Cold start.** New customers have no history, so they get bestsellers and a welcome offer. Very small shops give weak segments.
- **No payment, stock tracking, admin panel or email**: it is a demo.
- **Production hardening** you would still add: rate limiting on login, HTTPS, Redis instead of the in-memory cache when running several API instances, and keeping the model service on a private network.
