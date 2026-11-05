const axios = require('axios');
const config = require('../config');

const ml = axios.create({
  baseURL: config.mlUrl,
  timeout: config.mlTimeoutMs, // the model must never slow the shop down
  headers: config.mlKey ? { 'x-api-key': config.mlKey } : {},
});

async function getInsights(payload) {
  const { data } = await ml.post('/v1/insights', payload);
  return data;
}

async function health() {
  try {
    const { data } = await ml.get('/health', { timeout: 1000 });
    return { up: true, model: data.model };
  } catch {
    return { up: false };
  }
}

module.exports = { getInsights, health };
