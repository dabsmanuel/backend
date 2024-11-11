//routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const investmentController = require('../controllers/investmentController');
const { authMiddleware, restrictTo } = require('../middleware/auth');

const router = express.Router();

router.use(authController.protect);

router.get('/dashboard', userController.getDashboard);
router.patch('/profile', userController.updateProfile);
router.get('/search', userController.getUserByName);
router.get('/', userController.getAllUsers);
router.post(
  '/users/adjust-balance/:userId',
  authMiddleware,
  restrictTo('superadmin'),
  investmentController.adjustInvestment
);

module.exports = router;