const express = require('express');
const router = express.Router();
const {
  createWallet
} = require('../controller/walletController');
const { authenticateToken, checkWalletOwnership } = require('../middleware/auth');

router.post('/createWallet', authenticateToken, createWallet);


module.exports = router;