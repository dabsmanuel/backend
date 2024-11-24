//routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const investmentController = require('../controllers/investmentController');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { getUserBalances, getCryptoRates } = require('../controllers/userController');

const router = express.Router();

router.use(authController.protect);

router.get('/dashboard', userController.getDashboard);
router.patch('/profile', userController.updateProfile);
router.get('/search', userController.getUserByName);
router.get('/', userController.getAllUsers);
router.post(
  '/adjust-balance/:userId',
  authMiddleware,
  restrictTo('superadmin'),
  investmentController.adjustInvestment
);
router.get('/balances', authMiddleware, getUserBalances);
router.post('/withdraw', userController.requestWithdrawal);
// router.get('/notifications', userController.getNotifications);
// router.patch('/notifications/mark-read', userController.markNotificationsAsRead);


// Route to fetch investment log
router.get('/investment-log', userController.getInvestmentLog);

// Route to fetch withdrawal log
router.get('/withdrawal-log', userController.getWithdrawalLog);

router.get('/crypto/rates', restrictTo('user'), userController.getCryptoRates);

module.exports = router;

