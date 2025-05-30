const express = require('express');
const router = express.Router();
const {
  createTransaction,
} = require('../controller/transactionController');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');

router.post('/', authenticateToken, createTransaction);

module.exports = router;