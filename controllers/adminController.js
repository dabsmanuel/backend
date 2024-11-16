const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Investment = require('../models/Investment');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find().select('-password');
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

  // Destructure the crypto type and adjustment amount from the request
  const { cryptoType, amount } = adjustments;

  // Get the current balance or default to 0 if not found, and add the adjustment
  const currentBalance = user.cryptoBalances[cryptoType] || 0;
  user.cryptoBalances[cryptoType] = currentBalance + amount;

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
});
