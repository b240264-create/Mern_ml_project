const mongoose = require('mongoose');
const config = require('./config');
const app = require('./app');

mongoose
  .connect(config.mongoUri)
  .then(() => {
    app.listen(config.port, () => console.log(`API on http://localhost:${config.port}  (MongoDB: ${config.mongoUri})`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
