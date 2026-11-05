const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();
const sign = (user) => jwt.sign({ id: String(user._id) }, config.jwtSecret, { expiresIn: '7d' });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ message: 'Name is required' });
  if (!EMAIL.test(email || '')) return res.status(400).json({ message: 'Enter a valid email' });
  if (!password || String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

  if (await User.findOne({ email: String(email).toLowerCase() })) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }
  const user = await User.create({ name, email, passwordHash: await bcrypt.hash(String(password), 10) });
  res.status(201).json({ token: sign(user), user: user.toPublic() });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await bcrypt.compare(String(password || ''), user.passwordHash))) {
    return res.status(401).json({ message: 'Wrong email or password' });
  }
  res.json({ token: sign(user), user: user.toPublic() });
});

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(401).json({ message: 'Account no longer exists' });
  res.json({ user: user.toPublic() });
});

module.exports = router;
