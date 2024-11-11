const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Routes for regular users
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// Routes for super admin
router.post('/admin/signup', authController.signupSuperAdmin);
router.post('/admin/login', authController.loginSuperAdmin);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
