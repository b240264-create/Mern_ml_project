const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function auth(req, res, next) {
  const [type, token] = (req.headers.authorization || '').split(' ');
  if (type !== 'Bearer' || !token) return res.status(401).json({ message: 'Login required' });
  try {
    req.user = { id: jwt.verify(token, config.jwtSecret).id };
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
