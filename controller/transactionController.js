const { body, param, query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const cryptoUtils = require('../utils/cryptoUtils');

const MINIMUM_AMOUNT = 0.01;
const TRANSACTION_FEE = 0.001;

const createTransaction = [
  body('fromWallet').trim().notEmpty().withMessage('From wallet address is required'),
  body('toWallet').trim().notEmpty().withMessage('To wallet address is required'),
  body('amount').isFloat({ min: MINIMUM_AMOUNT }).withMessage(`Amount must be at least ${MINIMUM_AMOUNT}`),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const { fromWallet, toWallet, amount } = req.body;

      // Verify wallets exist
      const senderWallet = await Wallet.findOne({ address: fromWallet });
      const receiverWallet = await Wallet.findOne({ address: toWallet });

      if (!senderWallet || !receiverWallet) {
        return res.status(404).json({ success: false, error: 'Sender or receiver wallet not found' });
      }

      // Check ownership
      if (senderWallet.userId.toString() !== req.user.userId) {
        return res.status(403).json({ success: false, error: 'You can only spend from your own wallet' });
      }

      // Calculate balance
      const transactions = await Transaction.find({
        $or: [{ fromWallet }, { toWallet: fromWallet }],
        status: 'confirmed'
      });

      let balance = 0;
      transactions.forEach(tx => {
        if (tx.fromWallet === fromWallet) {
          balance -= (tx.amount + (tx.fee || 0));
        } else if (tx.toWallet === fromWallet) {
          balance += tx.amount;
        }
      });

      const totalCost = amount + TRANSACTION_FEE;
      if (balance < totalCost) {
        return res.status(400).json({ success: false, error: 'Insufficient balance' });
      }

      // Check for double-spending
      const pendingTx = await Transaction.findOne({
        fromWallet,
        status: 'pending'
      });
      if (pendingTx) {
        return res.status(409).json({ success: false, error: 'Pending transaction exists, wait for confirmation' });
      }

      // Sign the transaction
      const transactionData = `${fromWallet}${toWallet}${amount}${TRANSACTION_FEE}${Date.now()}`;
      const signature = cryptoUtils.signData(transactionData, senderWallet.privateKey);

      // Verify signature
      if (!cryptoUtils.verifySignature(transactionData, signature, senderWallet.publicKey)) {
        return res.status(400).json({ success: false, error: 'Invalid signature' });
      }

      // Create transaction
      const transaction = new Transaction({
        userId: req.user.userId,
        fromWallet,
        toWallet,
        amount,
        fee: TRANSACTION_FEE,
        signature,
        timestamp: Date.now(),
        status: 'pending',
        hash: cryptoUtils.generateTransactionHash({
          fromWallet,
          toWallet,
          amount,
          fee: TRANSACTION_FEE,
          timestamp: Date.now()
        })
      });

      await transaction.save();

      res.status(201).json({
        success: true,
        data: {
          id: transaction._id,
          fromWallet: transaction.fromWallet,
          toWallet: transaction.toWallet,
          amount: transaction.amount,
          fee: transaction.fee,
          status: transaction.status,
          hash: transaction.hash
        },
        user: { id: req.user.userId, username: req.user.username, role: req.user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];


module.exports = {
  createTransaction
};