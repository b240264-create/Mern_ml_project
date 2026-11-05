const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: [{
    _id: false,
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 }, // unit price at purchase time
  }],
  subtotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  shipping: { type: Number, default: 0 },
  total: { type: Number, required: true },
  // The ML-chosen offer shown to the customer at checkout. Logging it (and whether the order happened)
  // gives you REAL reward data to replace the simulated bandit environment later.
  offerApplied: { type: String, default: null },
  segmentAtPurchase: { type: String, default: null },
  status: { type: String, enum: ['placed', 'delivered', 'cancelled'], default: 'placed' },
  createdAt: { type: Date, default: Date.now, index: true },
});

module.exports = mongoose.model('Order', orderSchema);
