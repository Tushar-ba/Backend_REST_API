const express = require('express');
const router = express.Router();
const {
  createWallet,
  getWallet,
  getWalletBalance,
  updateWallet
} = require('../controller/walletController');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');

router.post('/createWallet', authenticateToken, createWallet);
router.get('/', authenticateToken, getWallet);
router.get('/:walletId', authenticateToken, checkWalletOwnership, getWalletBalance);
router.get('/:walletId/balance', authenticateToken, checkWalletOwnership, getWalletBalance);
router.put('/:walletId', authenticateToken, checkWalletOwnership, updateWallet);


module.exports = router;