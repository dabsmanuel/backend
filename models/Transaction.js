//transaction.js

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['investment', 'withdrawal', 'adjustment'],
    required: true
  },
  amount: {
    type: Number,
    required: function() {
      return this.type !== 'adjustment';
    }
  },
  currency: {
    type: String,
    required: function() {
      return this.type !== 'adjustment';
    }
  },
  receipt: {
    type: String,
    required: function() {
      return this.type === 'investment';
    }
  },
  adjustments: {
    type: Map,
    of: Number
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending'
  },
  investment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Investment'
  }
}, { timestamps: true });

// Create and export the model
const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;