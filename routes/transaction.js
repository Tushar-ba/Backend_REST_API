const express = require('express');
const router = express.Router();
const {
  createTransaction,
  getTransaction,
  listTransactions,
  getWalletTransactions,
  validateTransaction
} = require('../controller/transactionController');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');

// Create a new transaction
router.post('/', authenticateToken, createTransaction);

// Get transaction by ID
router.get('/:transactionId', getTransaction);

// List all transactions with pagination
router.get('/', listTransactions);

// Get wallet-specific transactions
router.get('/wallet/:walletId', authenticateToken, checkWalletOwnership, getWalletTransactions);

// Validate transaction before processing
router.post('/validate', authenticateToken, validateTransaction);

module.exports = router;