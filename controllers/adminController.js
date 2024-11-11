const User = require('../models/User');
const Transaction = require('../models/Transaction');

exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.status(200).json({
      status: 'success',
      data: users
    });
  } catch (error) {
    next(error);
  }
};

// Admin confirms investment and updates user's cryptocurrency balance
exports.confirmTransaction = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    const transaction = await Transaction.findById(transactionId);

    if (!transaction || transaction.status !== 'pending') {
      return res.status(400).json({ message: 'Invalid or already confirmed transaction.' });
    }

    transaction.status = 'completed';
    await transaction.save();

    if (transaction.type === 'investment') {
      const user = await User.findById(transaction.user);
      user.balances[transaction.currency] += transaction.amount; // Update specific cryptocurrency balance
      await user.save();
    }

    res.status(200).json({ message: 'Investment approved successfully.' });
  } catch (error) {
    console.error('Transaction confirmation error:', error);
    next(error);
  }
};

exports.adjustInvestment = async (req, res, next) => {
  try {
    const { userId, amount } = req.body;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    user.totalInvestment += amount;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: `$${amount} has been added to your total. New total: ${user.totalInvestment}`,
      data: {
        totalInvestment: user.totalInvestment,
      },
    });
  } catch (error) {
    next(error);
  }
};
exports.approveInvestment = async (req, res, next) => {
  try {
    const { transactionId } = req.params;

    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      { status: 'completed' },
      { new: true }
    ).populate('user');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const user = transaction.user;
    user.totalInvestment += transaction.amount;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Investment approved and reflected on user dashboard.',
      data: { transaction },
    });
  } catch (error) {
    next(error);
  }
};
