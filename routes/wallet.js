const express = require('express');
const router = express.Router();
const {
  createWallet,
  getWallet,
  getWalletBalance,
  updateWallet,
  getUserWallets,
  addWalletBalance
} = require('../controller/walletController');
const { authenticateToken, checkWalletOwnership, requireAdmin } = require('../middleware/auth');

router.post('/', authenticateToken, createWallet);

// Get all user's wallets
router.get('/', authenticateToken, getUserWallets);

// Get specific wallet details
router.get('/:walletId', authenticateToken, checkWalletOwnership, getWallet);

// Get wallet balance
router.get('/:walletId/balance', authenticateToken, checkWalletOwnership, getWalletBalance);

// Update wallet metadata
router.put('/:walletId', authenticateToken, checkWalletOwnership, updateWallet);

// Add balance to wallet (admin only, for testing)
router.post('/:walletId/balance', authenticateToken, requireAdmin, addWalletBalance);

module.exports = router;