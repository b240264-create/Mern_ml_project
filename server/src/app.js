const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const mlClient = require('./services/mlClient');

const app = express();
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '100kb' }));
if (config.env !== 'test') app.use(morgan('dev'));

app.get('/api/health', async (req, res) => res.json({ status: 'ok', ml: await mlClient.health() }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/insights', require('./routes/insights'));

app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

module.exports = app;
