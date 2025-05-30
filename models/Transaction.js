const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fromWallet: {
    type: String,
    required: true,
    index: true
  },
  toWallet: {
    type: String,
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  fee: {
    type: Number,
    default: 0,
    min: 0
  },
  signature: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'failed'],
    default: 'pending',
    index: true
  },
  blockId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Block',
    default: null,
    index: true
  },
  hash: {
    type: String,
    required: true,
    unique: true,
    index: true
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);