// notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authController = require('../controllers/authController');

// Protect all routes after this middleware
router.use(authController.protect);

router.get('/', notificationController.getNotifications);
router.patch('/mark-read', notificationController.markNotificationsAsRead);
router.get('/unread-count', notificationController.getUnreadCount);

module.exports = router;