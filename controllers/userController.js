// controllers/userController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const CryptoRate = require('../models/CryptoRate');
const mongoose = require('mongoose');

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find()
    .select('+password') 
    .lean();  
  
  res.status(200).json({
    status: 'success',
    data: users
  });
});

exports.getDashboard = catchAsync(async (req, res) => {
  console.log("Fetching dashboard data for user:", req.user.id);

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error("User not found in database.");
      return res.status(404).json({ status: 'fail', message: 'User not found.' });
    }

    const transactions = await Transaction.find({ user: req.user.id })
      .sort('-createdAt')
      .limit(10)
      .lean();

    const formattedTransactions = transactions.map(t => ({
      type: t.type,
      amount: t.amount,
      status: t.status,
      date: t.createdAt
    }));

    // Map cryptoBalances to the format expected by frontend
    const balances = {
      BTC: user.cryptoBalances.BTC || 0,
      ETH: user.cryptoBalances.ETH || 0,
      TRX: user.cryptoBalances.TRX || 0, 
      BCH: user.cryptoBalances.BCH || 0,
      SOL: user.cryptoBalances.SOL || 0,
      LTC: user.cryptoBalances.LTC || 0,
      USDC: user.cryptoBalances.USDC || 0,
      USDT: user.cryptoBalances.USDT || 0,
      XRP: user.cryptoBalances.XRP || 0,
      DOGE: user.cryptoBalances.DOGE || 0,
    };

    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          name: user.name,
          email: user.email,
          mobileNumber: user.mobileNumber,
          country: user.country,
          city: user.city,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth,
          totalInvestment: user.totalInvestment,
          bitcoinWalletAddress: user.bitcoinWalletAddress,
          role: 'user'
        },
        balances,
        transactions: formattedTransactions
      }
    });
  } catch (error) {
    console.error("Error retrieving dashboard data:", error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Server error. Please try again later.',
      error: error.message 
    });
  }
});

exports.updateProfile = catchAsync(async (req, res) => {
  const { name, email, dateOfBirth, gender, country, city, mobileNumber } = req.body;
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { name, email, dateOfBirth, gender, country, city, mobileNumber },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: { user }
  });
});

exports.getUserByName = catchAsync(async (req, res) => {
  const { name } = req.query;
  const user = await User.findOne({ name });
  
  if (!user) {y
    throw new AppError('User not found', 404);
  }
  
  res.status(200).json({
    status: 'success',
    data: user
  });
});

exports.getUserBalances = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  
  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'User not found'
    });
  }

  res.status(200).json({
    status: 'success',
    balances: user.cryptoBalances || {}
  });
});

exports.requestWithdrawal = catchAsync(async (req, res) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    const { amount, currency, walletAddress } = req.body;
    
    // Enhanced input validation
    if (!amount || !currency || !walletAddress) {
      return res.status(400).json({
        status: 'fail',
        message: 'Missing required fields: amount, currency, and wallet address are required'
      });
    }

    // Validate cryptocurrency code
    const validCurrencies = ['BTC', 'ETH', 'TRX', 'BCH', 'SOL', 'LTC', 'USDC', 'USDT', 'XRP', 'DOGE'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid cryptocurrency code'
      });
    }

    const withdrawalAmount = Number(amount);
    if (isNaN(withdrawalAmount) || withdrawalAmount <= 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'Invalid withdrawal amount'
      });
    }

    // Verify user exists and get their data
    const user = await User.findById(req.user.id).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Initialize cryptoBalances if undefined
    if (!user.cryptoBalances) {
      user.cryptoBalances = {};
    }

    // Check balance with proper decimal handling
    const availableBalance = parseFloat(user.cryptoBalances[currency] || 0);
    if (availableBalance < withdrawalAmount) {
      await session.abortTransaction();
      return res.status(400).json({
        status: 'fail',
        message: `Insufficient balance. Available: ${availableBalance} ${currency}, Requested: ${withdrawalAmount} ${currency}`
      });
    }

    // Create withdrawal transaction with proper session handling
    const transaction = new Transaction({
      user: user._id,
      type: 'withdrawal',
      amount: withdrawalAmount,
      currency,
      walletAddress,
      status: 'pending'
    });
    await transaction.save({ session });

    // Update user's balance with proper decimal precision
    user.cryptoBalances[currency] = (availableBalance - withdrawalAmount).toFixed(8);
    await user.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      status: 'success',
      message: 'Withdrawal request submitted successfully',
      data: {
        transaction,
        newBalance: user.cryptoBalances[currency]
      }
    });

  } catch (error) {
    await session.abortTransaction();
    
    console.error('Withdrawal processing error:', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id
    });
    
    return res.status(500).json({
      status: 'error',
      message: 'An error occurred while processing your withdrawal'
    });
  } finally {
    session.endSession();
  }
});

// Fetch investment history
exports.getInvestmentLog = catchAsync(async (req, res) => {
  const investments = await Transaction.find({
    user: req.user.id,
    type: 'investment'
  }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    data: investments,
  });
});

// Fetch withdrawal history
exports.getWithdrawalLog = catchAsync(async (req, res) => {
  const withdrawals = await Transaction.find({
    user: req.user.id,
    type: 'withdrawal'
  }).sort({ createdAt: -1 });

  res.status(200).json({
    status: 'success',
    data: withdrawals,
  });
});

exports.getCryptoRates = async (req, res) => {
  try {
    const cryptoRates = await CryptoRate.find();
    
    res.status(200).json({
      status: 'success',
      data: cryptoRates
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch crypto rates'
    });
  }
};