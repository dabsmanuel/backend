const cron = require('node-cron');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const sendEmail = require('../services/emailService');

const updateInvestments = async () => {
  try {
    // Update investments with daily growth
    const users = await User.find();
    
    for (const user of users) {
      // Calculate investment growth (this is a simplified example)
      const dailyGrowthRate = 0.001; // 0.1% daily growth
      const growthAmount = user.totalInvestment * dailyGrowthRate;

      user.totalInvestment += growthAmount;
      await user.save();

      // Create a transaction record for the growth
      await Transaction.create({
        user: user._id,
        type: 'growth',
        amount: growthAmount,
        currency: 'USD',
        status: 'completed',
      });

      console.log(`Updated investment for user ${user._id}: +${growthAmount}`);
    }

    // Check for pending deposits and send reminder emails
    const pendingDeposits = await Transaction.find({ status: 'pending', type: 'deposit' });

    for (const deposit of pendingDeposits) {
      const user = await User.findById(deposit.user);

      // Send reminder email for pending deposits
      await sendEmail({
        email: user.email,
        subject: 'Deposit Pending',
        message: `Hi ${user.name},\n\nIt looks like you started a deposit of ${deposit.amount} but haven’t completed it. Please complete your deposit to start investing.`,
      });
      
      console.log(`Sent deposit reminder email to ${user.email} for pending deposit: ${deposit.amount}`);
    }

    console.log('Daily investment update completed');
  } catch (error) {
    console.error('Error updating investments:', error);
  }
};

// Schedule the job to run daily at midnight
const scheduleInvestmentUpdates = () => {
  cron.schedule('0 0 * * *', updateInvestments);
  console.log('Investment update job scheduled');
};

module.exports = scheduleInvestmentUpdates;
