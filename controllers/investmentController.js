// controllers/investmentController.js
const User = require('../models/User');
const Investment = require('../models/investment');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const mongoose = require('mongoose');

exports.submitInvestment = catchAsync(async (req, res) => {
  const { amount, cryptoType } = req.body;

  if (!req.file) {
    console.log('Error: Receipt file is missing');
    return res.status(400).json({ message: 'Receipt is required for investment' });
  }

  if (!amount || !cryptoType) {
    console.log('Error: Amount or cryptoType missing');
    return res.status(400).json({ message: 'Amount and crypto type are required' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log('Creating investment record');
    const investment = await Investment.create([{
      user: req.user._id,
      cryptoType,
      amount: parseFloat(amount),
      receiptUrl: `/uploads/${req.file.filename}`, 
      status: 'pending'
    }], { session });

    console.log('Investment record created:', investment[0]);

    await session.commitTransaction();
    res.status(201).json({
      status: 'success',
      message: 'Investment submitted successfully. Pending admin approval.',
      data: { investment: investment[0] }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error during investment submission:', error); // Log specific error
    res.status(500).json({ message: 'Failed to submit investment' });
  } finally {
    session.endSession();
  }
});



exports.confirmTransaction = catchAsync(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await Transaction.findById(transactionId).populate('investment');
    const investment = transaction.investment;
    const user = await User.findById(investment.user);

    // Update the user's crypto currency balance
    user.cryptoBalances[investment.cryptoType] += investment.amount;
    await user.save();

    // Update the investment and transaction status
    investment.status = 'confirmed';
    transaction.status = 'confirmed';
    await investment.save();
    await transaction.save();

    res.status(200).json({
      status: 'success',
      message: 'Investment approved successfully'
    });
  }),

exports.rejectInvestment = catchAsync(async (req, res) =>{
  const { transactionId } = req.params;
  const transaction = await Transaction.findById(transactionId).populate('investment');
  const investment = transaction.investment;

  investment.status = 'rejected';
  transaction.status = 'rejected';
  await investment.save();
  await transaction.save();

  res.status(200).json({
    status: 'success',
    message: 'Investment rejected successfully'
  });
})


exports.adjustInvestment = catchAsync(async (req, res) => {
  const { userId, adjustments } = req.body;

  if (!userId || !adjustments) {
    throw new AppError('User ID and adjustments are required', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Initialize cryptoBalances if it doesn't exist
    if (!user.cryptoBalances) {
      user.cryptoBalances = new Map();
    }

    // Update user's cryptoBalances
    for (const [cryptoType, amount] of Object.entries(adjustments)) {
      const currentBalance = user.cryptoBalances.get(cryptoType) || 0;
      const newBalance = currentBalance + parseFloat(amount);
      user.cryptoBalances.set(cryptoType, Math.max(0, newBalance));
    }

    // Create a transaction record
    const transaction = await Transaction.create([{
      user: userId,
      type: 'adjustment',
      adjustments: new Map(Object.entries(adjustments)),
      performedBy: req.user._id,
      status: 'confirmed'
    }], { session });

    await user.save({ session });
    await session.commitTransaction();

    res.status(200).json({
      status: 'success',
      message: 'Balances adjusted successfully',
      data: {
        user: {
          _id: user._id,
          cryptoBalances: Object.fromEntries(user.cryptoBalances)
        },
        transaction: transaction[0]
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

exports.requestWithdrawal = catchAsync(async (req, res) => {
  const { amount } = req.body;
  const user = await User.findById(req.user.id);

  if (user.totalInvestment < amount) {
    throw new AppError('Insufficient funds for withdrawal', 400);
  }

  if (!req.file) {
    throw new AppError('Please upload a receipt for your transaction', 400);
  }

  const transaction = await Transaction.create({
    user: user._id,
    type: 'withdrawal',
    amount,
    currency: 'BTC',
    status: 'pending',
    receipt: req.file.path
  });

  user.totalInvestment -= amount;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Withdrawal request approved. Amount will be paid within 24 hours.',
    data: { transaction }
  });
});
