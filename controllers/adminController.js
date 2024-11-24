//controllers/adminController.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const CryptoRate = require('../models/CryptoRate');

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find().select('+password');
  res.status(200).json({
    status: 'success',
    data: users
  });
});

exports.getAllInvestments = catchAsync(async (req, res) => {
  const investments = await Transaction.find({
    type: 'investment'
  }).populate('user', 'name email');

  res.status(200).json({
    status: 'success',
    data: investments
  });
});

exports.approveInvestment = catchAsync(async (req, res) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw new AppError('Investment not found', 404);
  }

  const user = await User.findById(transaction.user);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Update user's crypto balance
  if (!user.cryptoBalances) {
    user.cryptoBalances = {};
  }
  
  const currentBalance = user.cryptoBalances[transaction.currency] || 0;
  user.cryptoBalances[transaction.currency] = currentBalance + transaction.amount;
  
  // Update transaction status
  transaction.status = 'confirmed';
  
  await user.save();
  await transaction.save();

  res.status(200).json({
    status: 'success',
    message: 'Investment approved successfully',
    data: transaction
  });
});

exports.rejectInvestment = catchAsync(async (req, res) => {
  const { transactionId } = req.params;

  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    throw new AppError('Investment not found', 404);
  }

  transaction.status = 'rejected';
  await transaction.save();

  res.status(200).json({
    status: 'success',
    message: 'Investment rejected successfully',
    data: transaction
  });
});


exports.adjustInvestment = catchAsync(async (req, res) => {
  const { userId, adjustments } = req.body;
  
  if (!userId || !adjustments) {
    throw new AppError('Missing required fields', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Initialize cryptoBalances if it doesn't exist
  if (!user.cryptoBalances) {
    user.cryptoBalances = {};
  }

  const { cryptoType, amount } = adjustments;
  
  // Validate the adjustment data
  if (!cryptoType || amount === undefined) {
    throw new AppError('Invalid adjustment data: cryptoType and amount are required', 400);
  }

  try {
    // Convert amount to number if it's a string
    const adjustmentAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Get current balance or default to 0
    const currentBalance = user.cryptoBalances[cryptoType] || 0;
    
    // Calculate new balance
    const newBalance = currentBalance + adjustmentAmount;
    
    // Update the balance
    user.cryptoBalances[cryptoType] = Math.max(0, newBalance); // Prevent negative balances
    
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Investment balance adjusted successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          cryptoBalances: user.cryptoBalances
        }
      }
    });
  } catch (error) {
    throw new AppError(`Failed to adjust balance: ${error.message}`, 500);
  }
});


const calculateDollarValue = (cryptoAmount, usdRate) => {
  return cryptoAmount * usdRate;
};

const calculateCryptoAmount = (dollarValue, usdRate) => {
  return dollarValue / usdRate;
};

exports.getCryptoRates = catchAsync(async (req, res) => {
  const rates = await CryptoRate.find();
  
  const formattedRates = rates.map(rate => ({
    symbol: rate.symbol,
    usdRate: rate.usdRate,
    lastUpdated: rate.lastUpdated
  }));

  res.status(200).json({
    status: 'success',
    data: formattedRates
  });
});

exports.updateCryptoRate = catchAsync(async (req, res) => {
  const { symbol, usdRate } = req.body;
  
  if (!symbol || !usdRate || usdRate <= 0) {
    throw new AppError('Invalid rate or symbol provided', 400);
  }

  // Get old rate first (if exists)
  const oldRate = await CryptoRate.findOne({ symbol });
  
  // Update or create new rate
  const updatedRate = await CryptoRate.findOneAndUpdate(
    { symbol },
    { 
      usdRate,
      lastUpdated: Date.now()
    },
    { upsert: true, new: true }
  );

  // Find users who have this crypto
  const users = await User.find({
    [`cryptoBalances.${symbol}`]: { $exists: true }
  });

  let affectedUsers = 0;

  // Update user balances
  for (const user of users) {
    const currentCryptoAmount = user.cryptoBalances[symbol];
    
    if (currentCryptoAmount > 0) {
      // Calculate dollar value using old rate if it exists
      const dollarValue = oldRate 
        ? calculateDollarValue(currentCryptoAmount, oldRate.usdRate)
        : calculateDollarValue(currentCryptoAmount, usdRate);

      // Calculate new crypto amount based on the same dollar value but new rate
      const newCryptoAmount = calculateCryptoAmount(dollarValue, usdRate);
      
      // Update user's crypto balance
      user.cryptoBalances[symbol] = newCryptoAmount;
      await user.save();
      
      affectedUsers++;
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      rate: {
        symbol,
        usdRate,
        lastUpdated: updatedRate.lastUpdated,
        affectedUsers
      }
    }
  });
});

// New endpoint to get user's portfolio with both crypto amounts and dollar values
exports.getUserPortfolio = catchAsync(async (req, res) => {
  const userId = req.params.userId;
  const user = await User.findById(userId);
  
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const rates = await CryptoRate.find();
  const ratesMap = rates.reduce((acc, rate) => {
    acc[rate.symbol] = rate.usdRate;
    return acc;
  }, {});

  const portfolio = {};
  let totalPortfolioValue = 0;

  // Calculate both crypto amounts and dollar values for each currency
  for (const [symbol, amount] of Object.entries(user.cryptoBalances)) {
    const rate = ratesMap[symbol] || 0;
    const dollarValue = calculateDollarValue(amount, rate);
    
    portfolio[symbol] = {
      cryptoAmount: amount,
      dollarValue,
      rate
    };

    totalPortfolioValue += dollarValue;
  }

  res.status(200).json({
    status: 'success',
    data: {
      userId: user._id,
      portfolio,
      totalPortfolioValue
    }
  });
});

exports.setConversionRate = catchAsync(async (req, res, next) => { 
  const { symbol, usdRate } = req.body; 
  if (!symbol || !usdRate) {
     return next(new AppError('Please provide both symbol and USD rate', 400)); 
    } 
    let conversion = await CryptoRate.findOneAndUpdate( 
      { symbol }, { usdRate, lastUpdated: Date.now() }, 
      { new: true, upsert: true } 
    ); 
    res.status(200).json({ 
      status: 'success', 
      data: { rate: conversion } }); 
    });

// In your cryptoController.js or routes file
exports.getCryptoRate = async (req, res) => {
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