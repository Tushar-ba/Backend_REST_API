const crypto = require('crypto');

/**
 * Calculate Merkle Root from an array of transaction hashes
 * @param {Array} hashes - Array of transaction hashes
 * @returns {String} - Merkle root hash
 */
function calculateMerkleRoot(hashes) {
  if (hashes.length === 0) return crypto.createHash('sha256').update('empty_merkle_tree').digest('hex');
  if (hashes.length === 1) return hashes[0];

  const newHashes = [];
  
  // Process pairs of hashes
  for (let i = 0; i < hashes.length; i += 2) {
    if (i + 1 < hashes.length) {
      // Concatenate pair and hash them
      const hashPair = hashes[i] + hashes[i + 1];
      const newHash = crypto.createHash('sha256').update(hashPair).digest('hex');
      newHashes.push(newHash);
    } else {
      // If odd number of hashes, duplicate the last one
      const hashPair = hashes[i] + hashes[i];
      const newHash = crypto.createHash('sha256').update(hashPair).digest('hex');
      newHashes.push(newHash);
    }
  }

  // Recursively calculate until we have a single hash (the merkle root)
  return calculateMerkleRoot(newHashes);
}

/**
 * Calculate block hash
 * @param {Object} block - Block data
 * @returns {String} - Block hash
 */
function calculateBlockHash(block) {
  const blockData = block.index + block.previousHash + block.timestamp.toString() + 
                    block.merkleRoot + block.nonce.toString() + block.difficulty.toString();
  return crypto.createHash('sha256').update(blockData).digest('hex');
}

/**
 * Mine a block with proof-of-work
 * @param {Object} blockData - Block data without hash and nonce
 * @param {Number} difficulty - Mining difficulty (number of leading zeros)
 * @returns {Object} - Mined block with hash and nonce
 */
function mineBlock(blockData, difficulty) {
  const target = Array(difficulty + 1).join('0');
  let nonce = 0;
  let hash = '';
  
  const startTime = Date.now();
  
  // Mine until we find a hash with the required number of leading zeros
  while (true) {
    blockData.nonce = nonce;
    hash = calculateBlockHash(blockData);
    
    if (hash.substring(0, difficulty) === target) {
      break;
    }
    
    nonce++;
    
    // Safety check to prevent infinite loops
    if (nonce > 10000000) {
      throw new Error('Mining took too long, consider reducing difficulty');
    }
    
    // Log progress every million attempts
    if (nonce % 1000000 === 0) {
      console.log(`Still mining... Attempts: ${nonce}, Current hash: ${hash}`);
    }
  }
  
  const endTime = Date.now();
  const miningTimeSeconds = (endTime - startTime) / 1000;
  
  console.log(`Block mined in ${miningTimeSeconds} seconds. Nonce: ${nonce}, Hash: ${hash}`);
  
  return {
    ...blockData,
    nonce,
    hash
  };
}

/**
 * Validate block hash and proof-of-work
 * @param {Object} block - Block to validate
 * @returns {Boolean} - True if valid, false otherwise
 */
function validateBlockHash(block) {
  const calculatedHash = calculateBlockHash(block);
  const target = Array(block.difficulty + 1).join('0');
  
  return (
    calculatedHash === block.hash && 
    block.hash.substring(0, block.difficulty) === target
  );
}

/**
 * Validate entire blockchain
 * @param {Array} blockchain - Array of blocks
 * @returns {Object} - Validation result with isValid flag and error message if invalid
 */
function validateBlockchain(blockchain) {
  if (blockchain.length === 0) {
    return { isValid: true, message: 'Empty blockchain is valid' };
  }
  
  // Check each block
  for (let i = 1; i < blockchain.length; i++) {
    const currentBlock = blockchain[i];
    const previousBlock = blockchain[i - 1];
    
    // Check hash integrity
    if (!validateBlockHash(currentBlock)) {
      return { 
        isValid: false, 
        message: `Block #${currentBlock.index} has invalid hash`,
        blockIndex: currentBlock.index
      };
    }
    
    // Check chain linking
    if (currentBlock.previousHash !== previousBlock.hash) {
      return { 
        isValid: false, 
        message: `Block #${currentBlock.index} has invalid previous hash`,
        blockIndex: currentBlock.index
      };
    }
    
    // Check block index sequence
    if (currentBlock.index !== previousBlock.index + 1) {
      return { 
        isValid: false, 
        message: `Block #${currentBlock.index} has invalid index sequence`,
        blockIndex: currentBlock.index
      };
    }
  }
  
  return { isValid: true, message: 'Blockchain is valid' };
}

/**
 * Calculate mining reward based on block index
 * @param {Number} blockIndex - Block index
 * @returns {Number} - Mining reward amount
 */
function calculateMiningReward(blockIndex) {
  // Simple halving mechanism similar to Bitcoin
  // Initial reward of 50, halved every 210,000 blocks
  const initialReward = 50;
  const halvingInterval = 210000;
  
  // For simplicity in testing, use a smaller interval
  const testHalvingInterval = 10;
  const halvings = Math.floor(blockIndex / testHalvingInterval);
  
  // Calculate reward with halving
  return initialReward / Math.pow(2, halvings);
}

module.exports = {
  calculateMerkleRoot,
  calculateBlockHash,
  mineBlock,
  validateBlockHash,
  validateBlockchain,
  calculateMiningReward
};
