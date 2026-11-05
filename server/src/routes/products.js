const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SORTS = {
  popular: { salesCount: -1 },
  newest: { createdAt: -1 },
  'price-asc': { price: 1 },
  'price-desc': { price: -1 },
};

router.get('/categories', async (req, res) => {
  res.json((await Product.distinct('category')).sort());
});

router.get('/', async (req, res) => {
  const { q, category, sort = 'popular' } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));

  const filter = {};
  if (category) filter.category = String(category);
  if (q) filter.name = new RegExp(escapeRegex(String(q)), 'i');

  const [items, total] = await Promise.all([
    Product.find(filter).sort(SORTS[sort] || SORTS.popular).skip((page - 1) * limit).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Product not found' });
  const product = await Product.findById(req.params.id).lean();
  if (!product) return res.status(404).json({ message: 'Product not found' });
  res.json(product);
});

module.exports = router;
