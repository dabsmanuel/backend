const CryptoWallet = require('../models/CryptoWallet');

exports.getCryptoWallets = async (req, res) => {
  try {
    const wallets = await CryptoWallet.find();
    res.status(200).json({
      status: 'success',
      data: wallets
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
