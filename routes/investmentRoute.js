//routes\investmentRoute.js
const express = require('express');
const Investment = require('../models/Investment');
const { submitInvestment, processInvestment, adjustInvestment } = require('../controllers/investmentController');
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { upload } = require('../middleware/uploadMiddleware');
const { getReceipt, serveReceipt } = require('../controllers/investmentController');
const router = express.Router();

router.use(authMiddleware);


router.get('/:id/receipt', getReceipt);

// Route to serve receipt files
router.get('/uploads/:filename', serveReceipt);

// Update to use upload middleware
router.post('/invest', upload.single('receipt'), submitInvestment);
// In your investments routes file
router.get('/:investmentId', authMiddleware, async (req, res) => {
  try {
    const investment = await Investment.findById(req.params.investmentId);
    if (!investment) {
      return res.status(404).json({ message: 'Investment not found' });
    }
    
    // Optional: Check if the user has permission to view this receipt
    if (investment.user.toString() !== req.user.id && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Not authorized to view this receipt' });
    }
    
    res.json({ receiptUrl: investment.receiptUrl });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching receipt' });
  }
});

router.post('/adjust-balance', restrictTo('superadmin'), adjustInvestment);
router.patch('/:transactionId/:action', restrictTo('superadmin'), processInvestment);

module.exports = router;