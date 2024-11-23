//models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  mobileNumber: {
    type: String,
    required: [true, 'Please provide a mobile number'],
    trim: true,
  },
  country: {
    type: String,
    required: [true, 'Please provide your country'],
    trim: true,
  },
  city: {
    type: String,
    required: [true, 'Please provide your city'],
    trim: true,
  },
  gender: {
    type: String,
    required: [true, 'Please specify your gender'],
    enum: ['male', 'female', 'other'],
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Please provide your date of birth'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: true,
  },
  bitcoinWalletAddress: {
    type: String,
    trim: true,
  },
  totalInvestment: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'superadmin'],
    default: 'user',
  },
  cryptoBalances: {
    BTC: { type: Number, default: 0 },
    ETH: { type: Number, default: 0 },
    USDT: { type: Number, default: 0 },
    LTC: { type: Number, default: 0 },
    SOL: { type: Number, default: 0 },
    USDC: { type: Number, default: 0 },
    TRX: { type: Number, default: 0 },
    XRP: { type: Number, default: 0 },
    DOGE: { type: Number, default: 0 },
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  // this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.resetPassword = async function(newPassword) {
  this.password = newPassword;
  return this.save({ validateBeforeSave: false });
};

const User = mongoose.model('User', userSchema);
module.exports = User;