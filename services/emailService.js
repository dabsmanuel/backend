// services/emailService.js

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendEmail = async (options) => {
  const mailOptions = {
    from: 'KoinFest <noreply@koinfest.com>',
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  await transporter.sendMail(mailOptions);
};

const sendWelcomeEmail = async (user) => {
  await sendEmail({
    email: user.email,
    subject: 'Welcome to KoinFest',
    html: `
      <h1>Welcome to KoinFest, ${user.name}!</h1>
      <p>We're excited to have you on board. Start investing today!</p>
    `,
  });
};

const sendDepositConfirmationEmail = async (user, amount) => {
  await sendEmail({
    email: user.email,
    subject: 'Deposit Confirmation',
    html: `
      <h1>Deposit Confirmed</h1>
      <p>Dear ${user.name},</p>
      <p>Your deposit of $${amount} has been confirmed and added to your account.</p>
    `,
  });
};

const sendDepositReminderEmail = async (user, amount) => {
  await sendEmail({
    email: user.email,
    subject: 'Complete Your Deposit',
    html: `
      <h1>Finish Your Deposit</h1>
      <p>Dear ${user.name},</p>
      <p>You've initiated a deposit of $${amount}. Please complete the transaction to add funds to your account.</p>
    `,
  });
};

const sendWithdrawalRequestEmail = async (user, amount) => {
  await sendEmail({
    email: user.email,
    subject: 'Withdrawal Request Received',
    html: `
      <h1>Withdrawal Request Received</h1>
      <p>Dear ${user.name},</p>
      <p>We've received your withdrawal request for $${amount}. It will be processed within 24 hours.</p>
    `,
  });
};

module.exports = {
  sendWelcomeEmail,
  sendDepositConfirmationEmail,
  sendDepositReminderEmail,
  sendWithdrawalRequestEmail,
};