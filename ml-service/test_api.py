import hashlib

from fastapi.testclient import TestClient
from app import app, A

client = TestClient(app)


def test_model_product_ids_are_stable():
    assert all(
        product_id == hashlib.sha256(A["item_names"][product_id].encode("utf-8")).hexdigest()[:24]
        for product_id in A["items"]
    )


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_new_customer_gets_popularity_and_welcome_offer():
    r = client.post("/v1/insights", json={}).json()
    assert r["segment"] == "New" and r["purchase_probability"] is None
    assert len(r["recommendations"]) == 8


def test_existing_customer():
    owned = A["items"][:3]
    r = client.post("/v1/insights", json={"recency_days": 10, "frequency": 12, "monetary": 3000,
                                          "purchased_product_ids": owned, "top_n": 5}).json()
    assert r["segment"] in A["segments"]
    assert 0 <= r["purchase_probability"] <= 1
    ids = [x["product_id"] for x in r["recommendations"]]
    assert len(ids) == 5 and not set(ids) & set(owned)


def test_validation():
    assert client.post("/v1/insights", json={"frequency": -1}).status_code == 422
