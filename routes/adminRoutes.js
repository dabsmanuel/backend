const express = require('express');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Protect all routes and restrict access to superadmins
router.use(authMiddleware);
router.use(restrictTo('superadmin'));

router.get('/users', adminController.getAllUsers);
router.patch('/confirm/:transactionId', adminController.confirmTransaction);
router.patch('/adjust-investment', adminController.adjustInvestment);
// routes/adminRoutes.js
router.patch('/approve-investment/:transactionId', adminController.approveInvestment);


module.exports = router;
