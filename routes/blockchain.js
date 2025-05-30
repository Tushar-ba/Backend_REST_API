const express = require('express');
const router = express.Router();
const {
  getBlocks,
  getBlock,
  mineBlock,
  getBlockchainStatus,
  validateBlockchain
} = require('../controller/blockchainController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all blocks (public, paginated)
router.get('/blocks', getBlocks);

// Get specific block with transactions (public)
router.get('/blocks/:blockId', getBlock);

// Mine pending transactions into new block (admin only)
router.post('/mine', authenticateToken, requireAdmin, mineBlock);

// Get blockchain metrics (public)
router.get('/status', getBlockchainStatus);

// Validate entire blockchain integrity (admin only)
router.get('/validate', authenticateToken, requireAdmin, validateBlockchain);

module.exports = router;
