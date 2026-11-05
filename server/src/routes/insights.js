const express = require('express');
const auth = require('../middleware/auth');
const { getUserInsights, popularProducts } = require('../services/insights');

const router = express.Router();

// Personalised: segment, purchase probability, offer, recommended products
router.get('/me', auth, async (req, res) => {
  res.json(await getUserInsights(req.user.id));
});

// Logged-out visitors: just popular products
router.get('/popular', async (req, res) => {
  res.json(await popularProducts(8));
});

module.exports = router;
