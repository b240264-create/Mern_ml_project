// Turns a user's orders into the payload the ML service expects (the same RFM-style features used in training).
const DAY = 24 * 60 * 60 * 1000;

function buildPayload(orders, { topN = 8, now = new Date() } = {}) {
  if (!orders.length) return { frequency: 0, top_n: topN };

  let monetary = 0;
  const products = new Set();
  for (const o of orders) {
    for (const it of o.items) {
      monetary += it.quantity * it.price;
      products.add(String(it.product)); // must equal the product_id used at training time
    }
  }
  const times = orders.map((o) => new Date(o.createdAt).getTime());

  return {
    recency_days: Math.max(0, Math.floor((now - Math.max(...times)) / DAY)),
    frequency: orders.length,
    monetary: Number(monetary.toFixed(2)),
    unique_products: products.size,
    tenure_days: Math.max(0, Math.floor((now - Math.min(...times)) / DAY)),
    purchased_product_ids: [...products],
    top_n: topN,
  };
}

module.exports = { buildPayload };
