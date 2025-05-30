const { body, param, query, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const cryptoUtils = require('../utils/cryptoUtils');

const MINIMUM_AMOUNT = 0.01;
const TRANSACTION_FEE = 0.001;

/**
 * Calculate wallet balance from transactions
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<number>} - Balance amount
 */
async function calculateWalletBalance(walletAddress) {
  const transactions = await Transaction.find({
    $or: [{ fromWallet: walletAddress }, { toWallet: walletAddress }],
    status: 'confirmed'
  });

  let balance = 0;
  transactions.forEach(tx => {
    if (tx.fromWallet === walletAddress) {
      balance -= (tx.amount + (tx.fee || 0));
    } else if (tx.toWallet === walletAddress) {
      balance += tx.amount;
    }
  });

  return balance;
}

/**
 * Get pending transactions for a wallet
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<{pendingOutgoing: number, pendingIncoming: number}>}
 */
async function getPendingTransactions(walletAddress) {
  const pendingTransactions = await Transaction.find({
    $or: [{ fromWallet: walletAddress }, { toWallet: walletAddress }],
    status: 'pending'
  });

  let pendingOutgoing = 0;
  let pendingIncoming = 0;

  pendingTransactions.forEach(tx => {
    if (tx.fromWallet === walletAddress) {
      pendingOutgoing += (tx.amount + (tx.fee || 0));
    } else if (tx.toWallet === walletAddress) {
      pendingIncoming += tx.amount;
    }
  });

  return { pendingOutgoing, pendingIncoming };
}

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
      const balance = await calculateWalletBalance(fromWallet);
      
      // Update wallet balance in database
      senderWallet.balance = balance;
      await senderWallet.save();

      // Get pending transactions
      const { pendingOutgoing } = await getPendingTransactions(fromWallet);
      
      // Calculate available balance
      const availableBalance = balance - pendingOutgoing;
      const totalCost = parseFloat(amount) + TRANSACTION_FEE;

      if (availableBalance < totalCost) {
        return res.status(400).json({ 
          success: false, 
          error: 'Insufficient balance',
          data: {
            availableBalance,
            requiredAmount: totalCost,
            pendingTransactions: pendingOutgoing > 0
          }
        });
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
        amount: parseFloat(amount),
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
          hash: transaction.hash,
          timestamp: transaction.timestamp
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

// Get transaction by ID
const getTransaction = [
  param('transactionId').isMongoId().withMessage('Invalid transaction ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const transaction = await Transaction.findById(req.params.transactionId);
      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }

      res.json({
        success: true,
        data: {
          id: transaction._id,
          fromWallet: transaction.fromWallet,
          toWallet: transaction.toWallet,
          amount: transaction.amount,
          fee: transaction.fee,
          status: transaction.status,
          signature: transaction.signature,
          timestamp: transaction.timestamp,
          blockId: transaction.blockId,
          hash: transaction.hash
        },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Get transaction error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

// List all transactions with pagination
const listTransactions = [
  query('status').optional().isIn(['pending', 'confirmed', 'failed']).withMessage('Invalid status'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive number'),
  query('sortBy').optional().isIn(['timestamp', 'amount', 'status']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const { status, limit = 20, offset = 0, sortBy = 'timestamp', order = 'desc' } = req.query;
      
      // Build query
      const query = {};
      if (status) query.status = status;
      
      // Build sort
      const sort = {};
      sort[sortBy] = order === 'asc' ? 1 : -1;

      // Count total documents for pagination
      const total = await Transaction.countDocuments(query);
      
      // Get transactions
      const transactions = await Transaction.find(query)
        .sort(sort)
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: transactions.map(tx => ({
          id: tx._id,
          fromWallet: tx.fromWallet,
          toWallet: tx.toWallet,
          amount: tx.amount,
          fee: tx.fee,
          status: tx.status,
          timestamp: tx.timestamp,
          blockId: tx.blockId,
          hash: tx.hash
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasNext: offset + transactions.length < total
        },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('List transactions error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

// Get wallet-specific transactions
const getWalletTransactions = [
  param('walletId').isMongoId().withMessage('Invalid wallet ID'),
  query('status').optional().isIn(['pending', 'confirmed', 'failed']).withMessage('Invalid status'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive number'),
  query('minAmount').optional().isFloat({ min: 0 }).withMessage('Min amount must be a positive number'),
  query('maxAmount').optional().isFloat({ min: 0 }).withMessage('Max amount must be a positive number'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const wallet = await Wallet.findById(req.params.walletId);
      if (!wallet) {
        return res.status(404).json({ success: false, error: 'Wallet not found' });
      }

      // Check ownership
      if (wallet.userId.toString() !== req.user.userId) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }

      const { 
        status, 
        limit = 20, 
        offset = 0, 
        minAmount, 
        maxAmount 
      } = req.query;
      
      // Build query
      const query = {
        $or: [{ fromWallet: wallet.address }, { toWallet: wallet.address }]
      };
      
      if (status) query.status = status;
      if (minAmount !== undefined) query.amount = { $gte: parseFloat(minAmount) };
      if (maxAmount !== undefined) {
        if (query.amount) {
          query.amount.$lte = parseFloat(maxAmount);
        } else {
          query.amount = { $lte: parseFloat(maxAmount) };
        }
      }

      // Count total documents for pagination
      const total = await Transaction.countDocuments(query);
      
      // Get transactions
      const transactions = await Transaction.find(query)
        .sort({ timestamp: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: transactions.map(tx => ({
          id: tx._id,
          fromWallet: tx.fromWallet,
          toWallet: tx.toWallet,
          amount: tx.amount,
          fee: tx.fee,
          status: tx.status,
          timestamp: tx.timestamp,
          blockId: tx.blockId,
          hash: tx.hash,
          type: tx.fromWallet === wallet.address ? 'outgoing' : 'incoming'
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasNext: offset + transactions.length < total
        },
        user: { id: req.user.userId, username: req.user.username, role: req.user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Get wallet transactions error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

// Validate transaction before processing
const validateTransaction = [
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
        return res.status(404).json({ 
          success: false, 
          error: 'Sender or receiver wallet not found',
          validationErrors: {
            senderExists: !!senderWallet,
            receiverExists: !!receiverWallet
          }
        });
      }

      // Check ownership
      const isOwner = senderWallet.userId.toString() === req.user.userId;
      if (!isOwner) {
        return res.status(403).json({ 
          success: false, 
          error: 'You can only spend from your own wallet',
          validationErrors: {
            isOwner: false
          }
        });
      }

      // Calculate balance
      const balance = await calculateWalletBalance(fromWallet);
      
      // Get pending transactions
      const { pendingOutgoing } = await getPendingTransactions(fromWallet);
      
      // Calculate available balance
      const availableBalance = balance - pendingOutgoing;
      const totalCost = parseFloat(amount) + TRANSACTION_FEE;

      const hasSufficientBalance = availableBalance >= totalCost;

      // Check for double-spending
      const pendingTx = await Transaction.findOne({
        fromWallet,
        status: 'pending'
      });

      res.json({
        success: true,
        data: {
          isValid: hasSufficientBalance && !pendingTx && isOwner,
          validationDetails: {
            fromWallet: {
              exists: true,
              isOwner,
              balance,
              availableBalance,
              pendingOutgoing,
              hasSufficientBalance,
              hasPendingTransactions: !!pendingTx
            },
            toWallet: {
              exists: true
            },
            amount: {
              isValid: amount >= MINIMUM_AMOUNT,
              minimumAmount: MINIMUM_AMOUNT
            },
            fee: TRANSACTION_FEE,
            totalCost
          }
        },
        user: { id: req.user.userId, username: req.user.username, role: req.user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Validate transaction error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

module.exports = {
  createTransaction,
  getTransaction,
  listTransactions,
  getWalletTransactions,
  validateTransaction
};