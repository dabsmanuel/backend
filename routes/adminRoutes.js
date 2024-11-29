const express = require('express');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');

const router = express.Router();

// Protect all routes and restrict to superadmin
router.use(authMiddleware);
router.use(restrictTo('superadmin'));

// User management
router.get('/users', adminController.getAllUsers);
router.delete('/users/:userId', adminController.deleteUser); 

router.patch(
  '/change-password',
  authMiddleware, 
  restrictTo('superadmin'), 
  authController.changePassword
);

router.post('/crypto/rate', adminController.setConversionRate); 
router.get('/crypto/rate', adminController.getCryptoRate);
router.get('/users/:userId/portfolio', adminController.getUserPortfolio);

// Investment management
router.get('/investments', adminController.getAllInvestments);
router.patch('/investments/:transactionId/approve', adminController.approveInvestment);
router.patch('/investments/:transactionId/reject', adminController.rejectInvestment);
router.patch('/investments/adjust', adminController.adjustInvestment);

router.get('/users/:userId/balances', adminController.getUserBalances);

module.exports = router;
