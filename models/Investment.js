//models/Investment.js
const mongoose = require('mongoose');

const investmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cryptoType: {
    type: String,
    required: true,
    enum: ['BTC', 'ETH', 'USDT', 'LTC', 'SOL', 'BNB', 'TRX', 'BCH', 'XRP' ]
  },
  amount: {
    type: Number,
    required: true
  },
  receiptUrl: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const Investment = mongoose.model('Investment', investmentSchema);
module.exports = Investment;