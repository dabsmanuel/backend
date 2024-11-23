const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Notification must belong to a user']
  },
  type: {
    type: String,
    enum: ['investment', 'withdrawal', 'system'],
    required: [true, 'Notification type is required']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    required: [true, 'Notification status is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required']
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: '30d' // Automatically delete notifications after 30 days
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for faster queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;