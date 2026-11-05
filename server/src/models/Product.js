const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, required: true, index: true },
  price: { type: Number, required: true, min: 0 },
  salesCount: { type: Number, default: 0, index: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Product', productSchema);
