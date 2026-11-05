const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

userSchema.methods.toPublic = function () {
  return { id: String(this._id), name: this.name, email: this.email };
};

module.exports = mongoose.model('User', userSchema);
