const mongoose = require('mongoose');

const cryptoWalletSchema = new mongoose.Schema({
  cryptoName: {
    type: String,
    required: true,
    unique: true
  },
  walletAddress: {
    type: String,
    required: true,
    unique: true
  }
});

const CryptoWallet = mongoose.model('CryptoWallet', cryptoWalletSchema);

module.exports = CryptoWallet;