//routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const investmentController = require('../controllers/investmentController');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { getUserBalances, getCryptoRates } = require('../controllers/userController');
const { createNotification } = require('../routes/notificationRoutes');

const router = express.Router();

router.use(authController.protect);

router.get('/dashboard', userController.getDashboard);
router.patch('/profile', async (req, res, next) => {
  try {
    const updatedUser = await userController.updateProfile(req, res, next);
    
    // Create a notification for profile update
    await createNotification(
      req.user._id, 
      'profile', 
      'Profile updated successfully', 
      'success',
      { updatedFields: Object.keys(req.body) }
    );
    
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
});
router.get('/search', userController.getUserByName);
router.get('/', userController.getAllUsers);
router.post(
  '/adjust-balance/:userId',
  authMiddleware,
  restrictTo('superadmin'),
  investmentController.adjustInvestment
);
router.get('/balances', authMiddleware, getUserBalances);
router.post('/withdraw', async (req, res, next) => {
  try {
    const withdrawalResult = await userController.requestWithdrawal(req, res, next);
    
    // Create a notification for withdrawal request
    await createNotification(
      req.user._id, 
      'withdrawal', 
      'Withdrawal request processed', 
      withdrawalResult.status,
      { 
        amount: withdrawalResult.amount,
        method: withdrawalResult.method 
      }
    );
    
    res.status(200).json(withdrawalResult);
  } catch (error) {
    next(error);
  }
});


router.get('/investment-log', userController.getInvestmentLog);

// Route to fetch withdrawal log
router.get('/withdrawal-log', userController.getWithdrawalLog);

router.get('/crypto/rates', restrictTo('user'), userController.getCryptoRates);

module.exports = router;


module.exports = router;