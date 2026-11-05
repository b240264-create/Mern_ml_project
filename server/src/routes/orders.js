const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { getUserInsights, invalidateInsights } = require('../services/insights');

const router = express.Router();
const round2 = (n) => Math.round(n * 100) / 100;

const SHIPPING_FLAT = 5;
const FREE_SHIPPING_OVER = 50;

// Turns the ML-chosen offer text into a price effect. Other offers (loyalty points, bundle deal, ...)
// are recorded on the order but have no price effect in this demo.
function applyOffer(offer, subtotal) {
  let discount = 0;
  let shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : SHIPPING_FLAT;
  const pct = /^(\d+)% discount$/.exec(offer || '');
  if (pct) discount = round2(subtotal * (Number(pct[1]) / 100));
  if (offer === 'Free shipping') shipping = 0;
  return { discount, shipping };
}

router.post('/', auth, async (req, res) => {
  const lines = req.body && req.body.items;
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 50) {
    return res.status(400).json({ message: 'Cart is empty' });
  }
  const wanted = new Map(); // productId -> quantity (merge duplicates)
  for (const l of lines) {
    const qty = Number(l.quantity);
    if (!mongoose.isValidObjectId(l.productId) || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ message: 'Invalid cart item' });
    }
    wanted.set(String(l.productId), (wanted.get(String(l.productId)) || 0) + qty);
  }

  // Prices always come from the database, never from the client.
  const products = await Product.find({ _id: { $in: [...wanted.keys()] } }).lean();
  if (products.length !== wanted.size) return res.status(400).json({ message: 'Some products no longer exist' });

  const items = products.map((p) => ({ product: p._id, name: p.name, quantity: wanted.get(String(p._id)), price: p.price }));
  const subtotal = round2(items.reduce((s, i) => s + i.price * i.quantity, 0));

  const insights = await getUserInsights(req.user.id); // never throws; falls back if ML is down
  const { discount, shipping } = applyOffer(insights.offer, subtotal);

  const order = await Order.create({
    user: req.user.id, items, subtotal, discount, shipping,
    total: round2(subtotal - discount + shipping),
    offerApplied: insights.offer, segmentAtPurchase: insights.segment,
  });

  await Promise.all(items.map((i) => Product.updateOne({ _id: i.product }, { $inc: { salesCount: i.quantity } })));
  invalidateInsights(req.user.id); // the new order changes the customer's segment and recommendations
  res.status(201).json(order);
});

router.get('/mine', auth, async (req, res) => {
  res.json(await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(50).lean());
});

module.exports = router;
module.exports.applyOffer = applyOffer;
