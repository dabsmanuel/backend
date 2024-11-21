  // In your backend routes file (e.g., notificationRoutes.js)
const express = require('express');
const router = express.Router();
const Notification = require('../models/Notifications');
const { protect } = require('../controllers/authController');


// Fetch user notifications
router.get('/:userId', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      user: req.params.userId 
    }).sort({ createdAt: -1 }).limit(10);
    
    res.status(200).json({
      status: 'success',
      results: notifications.length,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch notifications'
    });
  }
});

// Mark notifications as read
router.patch('/:userId/read', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.params.userId, isRead: false },
      { isRead: true }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'Notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to mark notifications as read'
    });
  }
});

// Delete read notifications
router.delete('/:userId', protect, async (req, res) => {
  try {
    await Notification.deleteMany({ 
      user: req.params.userId, 
      isRead: true 
    });
    
    res.status(204).json({
      status: 'success',
      message: 'Read notifications deleted'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete notifications'
    });
  }
});

// Create a helper function to add notifications
const createNotification = async (userId, type, message, status, details) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      message,
      status,
      details,
      isRead: false
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification', error);
  }
};

module.exports = { router, createNotification };