const Investment = require('../models/Investment');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Notification = require('../models/Notifications');



exports.getReceipt = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  // First try to find in Investment model
  let document = await Investment.findById(id);
  
  // If not found in Investment, try Transaction model
  if (!document) {
    document = await Transaction.findById(id);
  }
  
  if (!document) {
    return res.status(404).json({
      status: 'error',
      message: 'No document found with that ID'
    });
  }

  // Check if user has permission
  if (req.user.role !== 'superadmin' && document.user.toString() !== req.user.id) {
    return res.status(403).json({
      status: 'error',
      message: 'You do not have permission to view this receipt'
    });
  }

  // Check if receipt URL exists (handle both fields)
  const receiptUrl = document.receiptUrl || document.receipt;
  
  if (!receiptUrl) {
    return res.status(404).json({
      status: 'error',
      message: 'No receipt found for this document'
    });
  }

  // Return the full URL
  const fullUrl = `${process.env.BACKEND_URL || 'https://koinfest.onrender.com'}${receiptUrl}`;
  
  res.status(200).json({
    status: 'success',
    data: {
      receiptUrl: fullUrl
    }
  });
});

exports.serveReceipt = catchAsync(async (req, res) => {
  const { filename } = req.params;
  
  // Construct the full path to the receipt file
  const fullPath = path.join(__dirname, '../uploads', filename);
  
  // Check if file exists
  if (!fs.existsSync(fullPath)) {
    throw new AppError('Receipt file not found', 404);
  }
  
  // Send the file
  res.sendFile(fullPath);
});

exports.getPendingInvestments = catchAsync(async (req, res) => {
  const investments = await Transaction.find({
    type: 'investment',
    status: 'pending'
  }).populate('user', 'name email');

  res.status(200).json({
    status: 'success',
    data: investments
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

  // Update the specific crypto balance
  const { cryptoType, amount } = adjustments;
  user.cryptoBalances[cryptoType] = amount;
  
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
  });

  // Create notification for withdrawal request
  await Notification.create({
    user: user._id,
    type: 'withdrawal',
    message: `Withdrawal request of ${amount} BTC is pending`,
    status: 'pending',
    details: {
      amount,
      currency: 'BTC',
      transactionId: transaction._id
    }
  });

  user.totalInvestment -= amount;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Withdrawal request approved. Amount will be paid within 24 hours.',
    data: { transaction }
  });
});

exports.submitInvestment = catchAsync(async (req, res) => {
  // Validate request
  if (!req.file) {
    return res.status(400).json({
      status: 'error',
      message: 'Please upload a receipt'
    });
  }
  const receiptPath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!receiptPath) {
    return res.status(400).json({ message: 'Receipt is required' });
  }

  const { cryptoType, amount } = req.body;

  if (!cryptoType || !amount) {
    return res.status(400).json({
      status: 'error',
      message: 'Please provide both cryptoType and amount'
    });
  }

  // Create investment record
  const investment = await Investment.create({
    user: req.user.id,
    cryptoType,
    amount: parseFloat(amount),
    receiptUrl: receiptPath,
    status: 'pending'
  });

  // Create corresponding transaction record
  const transaction = await Transaction.create({
    user: req.user.id,
    type: 'investment',
    amount: parseFloat(amount),
    currency: cryptoType,
    status: 'pending',
    receipt: receiptPath
  });

  // Create notification for new investment
  await Notification.create({
    user: req.user.id,
    type: 'investment',
    message: `New investment of ${amount} ${cryptoType} is pending`,
    status: 'pending',
    details: {
      amount: parseFloat(amount),
      currency: cryptoType,
      transactionId: investment._id
    }
  });

  return res.status(201).json({
    status: 'success',
    data: {
      investment,
      transaction
    }
  });
});

exports.processInvestment = catchAsync(async (req, res) => {
  const { transactionId, action } = req.params;
  
  const transaction = await Transaction.findById(transactionId);
  if (!transaction) {
    return res.status(404).json({
      status: 'error',
      message: 'Transaction not found'
    });
  }

  const user = await User.findById(transaction.user);
  if (!user) {
    return res.status(404).json({
      status: 'error',
      message: 'User not found'
    });
  }

  if (action === 'approve') {
    // Update user's crypto balance
    if (!user.cryptoBalances) {
      user.cryptoBalances = {};
    }
    
    const currentBalance = user.cryptoBalances[transaction.currency] || 0;
    user.cryptoBalances[transaction.currency] = currentBalance + transaction.amount;
    
    // Update transaction status
    transaction.status = 'confirmed';
    
    // Create notification for approved investment
    await Notification.create({
      user: user._id,
      type: 'investment',
      message: `Your investment of ${transaction.amount} ${transaction.currency} has been approved`,
      status: 'confirmed',
      details: {
        amount: transaction.amount,
        currency: transaction.currency,
        transactionId: transaction._id
      }
    });
    
    await user.save();
    await transaction.save();
    
    return res.status(200).json({
      status: 'success',
      message: 'Investment approved and balance updated'
    });
  } else if (action === 'reject') {
    transaction.status = 'rejected';
    
    // Create notification for rejected investment
    await Notification.create({
      user: user._id,
      type: 'investment',
      message: `Your investment of ${transaction.amount} ${transaction.currency} has been rejected`,
      status: 'rejected',
      details: {
        amount: transaction.amount,
        currency: transaction.currency,
        transactionId: transaction._id
      }
    });
    
    await transaction.save();
    
    return res.status(200).json({
      status: 'success',
      message: 'Investment rejected'
    });
  }

  return res.status(400).json({
    status: 'error',
    message: 'Invalid action'
  });
});
