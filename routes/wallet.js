const express = require('express');
const router = express.Router();
const {
  createWallet,
  getWallet,
  getWalletBalance
} = require('../controller/walletController');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');

router.post('/createWallet', authenticateToken, createWallet);
router.get('/', authenticateToken, getWallet);
router.get('/:walletId', authenticateToken, checkWalletOwnership, getWalletBalance);


module.exports = router;