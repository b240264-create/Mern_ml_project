require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/shop',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  mlUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  mlKey: process.env.ML_API_KEY || '',
  mlTimeoutMs: Number(process.env.ML_TIMEOUT_MS || 2500),
};

if (config.env === 'production' && config.jwtSecret === 'dev-secret-change-me') {
  throw new Error('Set JWT_SECRET in production');
}

module.exports = config;
