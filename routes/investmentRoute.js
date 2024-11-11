//routes/investmentRoute.js
const express = require('express');
const router = express.Router();
const investmentController = require('../controllers/investmentController');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { upload } = require('../middleware/uploadMiddleware');


// Investment routes
router.post('/invest', authMiddleware, upload.single('receipt'), investmentController.submitInvestment);

router.post(
  '/adjust-investment',
  authMiddleware,
  restrictTo('superadmin'),
  investmentController.adjustInvestment
);

router.patch('/reject/:transactionId',
  investmentController.rejectInvestment
);

router.patch('/confirm/:transactionId',
  investmentController.confirmTransaction
);

module.exports = router;