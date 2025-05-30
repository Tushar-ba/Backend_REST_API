const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  index: {
    type: Number,
    required: true,
    unique: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  transactions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  }],
  transactionCount: {
    type: Number,
    default: 0
  },
  previousHash: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true,
    unique: true
  },
  nonce: {
    type: Number,
    required: true
  },
  merkleRoot: {
    type: String,
    required: true
  },
  difficulty: {
    type: Number,
    default: 4
  },
  minedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
});

// Add indexes for better performance
blockSchema.index({ index: 1 });
blockSchema.index({ hash: 1 });
blockSchema.index({ previousHash: 1 });

module.exports = mongoose.model('Block', blockSchema);
