const Order = require('../models/Order');
const Product = require('../models/Product');
const { getInsights } = require('./mlClient');
const { buildPayload } = require('../utils/customerFeatures');

const TTL_OK = 10 * 60 * 1000;     // cache good answers for 10 min
const TTL_FALLBACK = 30 * 1000;    // retry the ML service soon after a failure
const cache = new Map();           // use Redis instead if you run several Node instances

async function popularProducts(n = 8) {
  return Product.find().sort({ salesCount: -1 }).limit(n).lean();
}

/**
 * Personalised insights for one user: segment, purchase probability, offer, recommended products.
 * Never throws because of the ML service: on failure it degrades to popular products.
 */
async function getUserInsights(userId) {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  let data;
  let ttl = TTL_OK;
  try {
    const orders = await Order.find({ user: key, status: { $ne: 'cancelled' } }).select('items createdAt').lean();
    const ml = await getInsights(buildPayload(orders));

    const docs = await Product.find({ _id: { $in: ml.recommendations.map((r) => r.product_id) } }).lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    data = {
      segment: ml.segment,
      segmentTier: ml.segment_tier,
      purchaseProbability: ml.purchase_probability,
      offer: ml.offer,
      recommendations: ml.recommendations
        .map((r) => ({ score: r.score, product: byId.get(r.product_id) }))
        .filter((r) => r.product), // skip products that no longer exist
      modelTrainedAt: ml.model_trained_at,
      fallback: false,
    };
  } catch (err) {
    console.error('[insights] ML unavailable, using popular products:', err.message);
    const popular = await popularProducts();
    data = {
      segment: null, segmentTier: null, purchaseProbability: null, offer: null,
      recommendations: popular.map((p) => ({ score: null, product: p })),
      fallback: true,
    };
    ttl = TTL_FALLBACK;
  }
  cache.set(key, { data, expires: Date.now() + ttl });
  return data;
}

function invalidateInsights(userId) {
  cache.delete(String(userId));
}

module.exports = { getUserInsights, invalidateInsights, popularProducts };
