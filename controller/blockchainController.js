const { body, param, query, validationResult } = require('express-validator');
const Block = require('../models/Block');
const Transaction = require('../models/Transaction');
const Wallet = require('../models/Wallet');
const blockchainUtils = require('../utils/blockchainUtils');

// Default mining difficulty
const DEFAULT_DIFFICULTY = 4;
// Maximum transactions per block
const MAX_TRANSACTIONS_PER_BLOCK = 10;

/**
 * Get all blocks with pagination
 */
const getBlocks = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be a positive number'),
  query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid ISO date'),
  query('toDate').optional().isISO8601().withMessage('toDate must be a valid ISO date'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const { limit = 20, offset = 0, fromDate, toDate } = req.query;
      
      // Build query
      const query = {};
      if (fromDate || toDate) {
        query.timestamp = {};
        if (fromDate) query.timestamp.$gte = new Date(fromDate);
        if (toDate) query.timestamp.$lte = new Date(toDate);
      }
      
      // Count total for pagination
      const total = await Block.countDocuments(query);
      
      // Get blocks
      const blocks = await Block.find(query)
        .sort({ index: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit));

      res.json({
        success: true,
        data: blocks.map(block => ({
          id: block._id,
          index: block.index,
          hash: block.hash,
          previousHash: block.previousHash,
          timestamp: block.timestamp,
          transactionCount: block.transactionCount,
          merkleRoot: block.merkleRoot,
          difficulty: block.difficulty,
          nonce: block.nonce
        })),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasNext: offset + blocks.length < total
        },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Get blocks error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

/**
 * Get specific block with transactions
 */
const getBlock = [
  param('blockId').isMongoId().withMessage('Invalid block ID'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const block = await Block.findById(req.params.blockId).populate('transactions');
      if (!block) {
        return res.status(404).json({ success: false, error: 'Block not found' });
      }

      res.json({
        success: true,
        data: {
          id: block._id,
          index: block.index,
          hash: block.hash,
          previousHash: block.previousHash,
          timestamp: block.timestamp,
          transactions: block.transactions.map(tx => ({
            id: tx._id,
            fromWallet: tx.fromWallet,
            toWallet: tx.toWallet,
            amount: tx.amount,
            fee: tx.fee,
            hash: tx.hash,
            timestamp: tx.timestamp
          })),
          transactionCount: block.transactionCount,
          merkleRoot: block.merkleRoot,
          difficulty: block.difficulty,
          nonce: block.nonce,
          minedBy: block.minedBy
        },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Get block error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

/**
 * Mine pending transactions into a new block
 */
const mineBlock = [
  body('minerWallet').optional().isString().withMessage('Miner wallet must be a string'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      // Get pending transactions
      const pendingTransactions = await Transaction.find({ status: 'pending' })
        .limit(MAX_TRANSACTIONS_PER_BLOCK)
        .sort({ timestamp: 1 });

      if (pendingTransactions.length === 0) {
        return res.status(400).json({ success: false, error: 'No pending transactions to mine' });
      }

      // Get the latest block to determine the next index and previous hash
      const latestBlock = await Block.findOne().sort({ index: -1 });
      const index = latestBlock ? latestBlock.index + 1 : 0;
      const previousHash = latestBlock ? latestBlock.hash : '0'.repeat(64); // Genesis block has all zeros

      // Calculate merkle root
      const transactionHashes = pendingTransactions.map(tx => tx.hash);
      const merkleRoot = blockchainUtils.calculateMerkleRoot(transactionHashes);

      // Prepare block data for mining
      const blockData = {
        index,
        timestamp: new Date(),
        transactions: pendingTransactions.map(tx => tx._id),
        transactionCount: pendingTransactions.length,
        previousHash,
        merkleRoot,
        difficulty: DEFAULT_DIFFICULTY,
        minedBy: req.user.userId
      };

      // Mine the block (find nonce and hash)
      const minedBlock = blockchainUtils.mineBlock(blockData, DEFAULT_DIFFICULTY);

      // Create and save the block
      const newBlock = new Block(minedBlock);
      await newBlock.save();

      // Update transactions to confirmed status and add blockId
      for (const tx of pendingTransactions) {
        tx.status = 'confirmed';
        tx.blockId = newBlock._id;
        await tx.save();

        // Update wallet balances if not a mining reward transaction
        if (tx.fromWallet !== 'SYSTEM' && tx.fromWallet !== 'MINING_REWARD') {
          // Deduct from sender wallet
          const senderWallet = await Wallet.findOne({ address: tx.fromWallet });
          if (senderWallet) {
            // Recalculate balance from confirmed transactions
            const transactions = await Transaction.find({
              $or: [{ fromWallet: senderWallet.address }, { toWallet: senderWallet.address }],
              status: 'confirmed'
            });

            let balance = 0;
            transactions.forEach(transaction => {
              if (transaction.fromWallet === senderWallet.address) {
                balance -= (transaction.amount + (transaction.fee || 0));
              } else if (transaction.toWallet === senderWallet.address) {
                balance += transaction.amount;
              }
            });

            senderWallet.balance = balance;
            await senderWallet.save();
          }

          // Add to receiver wallet
          const receiverWallet = await Wallet.findOne({ address: tx.toWallet });
          if (receiverWallet) {
            // Recalculate balance from confirmed transactions
            const transactions = await Transaction.find({
              $or: [{ fromWallet: receiverWallet.address }, { toWallet: receiverWallet.address }],
              status: 'confirmed'
            });

            let balance = 0;
            transactions.forEach(transaction => {
              if (transaction.fromWallet === receiverWallet.address) {
                balance -= (transaction.amount + (transaction.fee || 0));
              } else if (transaction.toWallet === receiverWallet.address) {
                balance += transaction.amount;
              }
            });

            receiverWallet.balance = balance;
            await receiverWallet.save();
          }
        }
      }

      // Create mining reward transaction if miner wallet is specified
      if (req.body.minerWallet) {
        const minerWallet = await Wallet.findOne({ address: req.body.minerWallet });
        
        if (minerWallet) {
          const miningReward = blockchainUtils.calculateMiningReward(index);
          
          // Create reward transaction
          const rewardTransaction = new Transaction({
            userId: req.user.userId,
            fromWallet: 'MINING_REWARD',
            toWallet: minerWallet.address,
            amount: miningReward,
            fee: 0,
            signature: 'MINING_REWARD',
            timestamp: Date.now(),
            status: 'confirmed',
            blockId: newBlock._id,
            hash: `MINING_REWARD_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
          });
          
          await rewardTransaction.save();
          
          // Update miner's wallet balance
          minerWallet.balance += miningReward;
          await minerWallet.save();
        }
      }

      res.status(201).json({
        success: true,
        data: {
          blockId: newBlock._id,
          index: newBlock.index,
          hash: newBlock.hash,
          previousHash: newBlock.previousHash,
          timestamp: newBlock.timestamp,
          transactionCount: newBlock.transactionCount,
          merkleRoot: newBlock.merkleRoot,
          difficulty: newBlock.difficulty,
          nonce: newBlock.nonce,
          miningTimeMs: newBlock.miningTimeMs
        },
        user: { id: req.user.userId, username: req.user.username, role: req.user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Mine block error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

/**
 * Get blockchain status and metrics
 */
const getBlockchainStatus = async (req, res) => {
  try {
    // Get total blocks
    const totalBlocks = await Block.countDocuments();
    
    // Get latest block
    const latestBlock = await Block.findOne().sort({ index: -1 });
    
    // Get total transactions
    const totalTransactions = await Transaction.countDocuments({ status: 'confirmed' });
    
    // Get pending transactions
    const pendingTransactions = await Transaction.countDocuments({ status: 'pending' });
    
    // Calculate average block time (if more than 1 block)
    let averageBlockTime = null;
    if (totalBlocks > 1) {
      const blocks = await Block.find().sort({ index: -1 }).limit(10);
      let totalTime = 0;
      let count = 0;
      
      for (let i = 0; i < blocks.length - 1; i++) {
        const timeDiff = blocks[i].timestamp.getTime() - blocks[i + 1].timestamp.getTime();
        totalTime += timeDiff;
        count++;
      }
      
      if (count > 0) {
        averageBlockTime = totalTime / count / 1000; // in seconds
      }
    }
    
    res.json({
      success: true,
      data: {
        totalBlocks,
        latestBlockIndex: latestBlock ? latestBlock.index : null,
        latestBlockHash: latestBlock ? latestBlock.hash : null,
        latestBlockTime: latestBlock ? latestBlock.timestamp : null,
        totalTransactions,
        pendingTransactions,
        averageBlockTime,
        currentDifficulty: DEFAULT_DIFFICULTY
      },
      meta: { timestamp: new Date().toISOString(), version: '1.0' }
    });
  } catch (error) {
    console.error('Get blockchain status error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

/**
 * Validate blockchain integrity
 */
const validateBlockchain = async (req, res) => {
  try {
    // Get all blocks in order
    const blocks = await Block.find().sort({ index: 1 });
    
    if (blocks.length === 0) {
      return res.json({
        success: true,
        data: {
          isValid: true,
          message: 'Blockchain is empty',
          blockCount: 0
        },
        user: { id: req.user.userId, username: req.user.username, role: req.user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    }
    
    // Validate the blockchain
    const validation = blockchainUtils.validateBlockchain(blocks);
    
    res.json({
      success: true,
      data: {
        isValid: validation.isValid,
        message: validation.message,
        blockCount: blocks.length,
        invalidBlockIndex: validation.blockIndex
      },
      user: { id: req.user.userId, username: req.user.username, role: req.user.role },
      meta: { timestamp: new Date().toISOString(), version: '1.0' }
    });
  } catch (error) {
    console.error('Validate blockchain error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

module.exports = {
  getBlocks,
  getBlock,
  mineBlock,
  getBlockchainStatus,
  validateBlockchain
};
