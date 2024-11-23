const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Notification = require('../models/Notifications');

exports.createNotification = catchAsync(async (userId, type, status, amount, currency) => {
  const notification = await Notification.create({
    user: userId,
    type,
    status,
    amount,
    currency,
    read: false
  });

  return notification;
});

exports.getNotifications = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;

  const query = {
    user: req.user.id,
    read: false
  };

  // Add status filter if provided
  if (req.query.status && req.query.status !== 'all') {
    query.status = req.query.status;
  }

  // Add type filter if provided
  if (req.query.type && req.query.type !== 'all') {
    query.type = req.query.type;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-__v');

  const total = await Notification.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: notifications.length,
    total,
    data: notifications,
    pagination: {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      limit
    }
  });
});

exports.markNotificationsAsRead = catchAsync(async (req, res, next) => {
  const query = {
    user: req.user.id,
    read: false
  };

  // If specific notification IDs are provided
  if (req.body.notificationIds && req.body.notificationIds.length > 0) {
    query._id = { $in: req.body.notificationIds };
  }

  const result = await Notification.updateMany(
    query,
    { $set: { read: true } }
  );

  if (result.modifiedCount === 0) {
    return next(new AppError('No unread notifications found', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Notifications marked as read',
    modifiedCount: result.modifiedCount
  });
});

exports.getUnreadCount = catchAsync(async (req, res, next) => {
  const count = await Notification.countDocuments({
    user: req.user.id,
    read: false
  });

  res.status(200).json({
    status: 'success',
    data: { count }
  });
});