//models/CryptoRate.js

const mongoose = require('mongoose');

const cryptoRateSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    unique: true,
    enum: ['BTC', 'ETH', 'USDT', 'SOL', 'LTC', 'USDC', 'TRX', 'XRP', 'DOGE']
  },
  usdRate: {
    type: Number,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const CryptoRate = mongoose.model('CryptoRate', cryptoRateSchema);
module.exports = CryptoRate;
