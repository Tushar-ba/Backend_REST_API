const { body, param, validationResult } = require('express-validator');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const cryptoUtils = require('../utils/cryptoUtils');

const createWallet = [
    body('metadata.name').optional().trim(),
    body('metadata.description').optional().trim(),
    async (req , res) =>{
        try {
            const errors = validationResult(req);
            if(!errors.isEmpty()){
                return res.status(400).json({success: false, error: errors.array().map(e => e.msg).join(', ')});
            }
            const {publicKey , privateKey} = cryptoUtils.generateKeyPair();
            const address = cryptoUtils.generateWalletAddress(publicKey);
            
            const wallet = new Wallet({
                userId: req.user.userId,
                address,
                publicKey,
                privateKey,
                metadata:req.body.metadata || {}
            });

            await wallet.save();
            res.status(201).json({
            success: true,
            data: { id: wallet._id, address: wallet.address, balance: wallet.balance },
            user: { id: req.user.userId, username: req.user.username, role: req.user.role },
            meta: { timestamp: new Date().toISOString(), version: '1.0' }
        });
        } catch (error) {
            console.error('Create wallet error:', error);
            res.status(500).json({ success: false, error: 'Server error' });
        }
    }
]

const getWallet = [
  param('walletId').isMongoId().withMessage('Invalid wallet ID'),
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

      res.json({
        success: true,
        data: {
          id: wallet._id,
          address: wallet.address,
          publicKey: wallet.publicKey,
          balance: wallet.balance,
          metadata: wallet.metadata,
          createdAt: wallet.createdAt,
          updatedAt: wallet.updatedAt
        },
        user: { id: req.user.userId, username: req.user.username, role: req.user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Get wallet error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];


const getWalletBalance = [
  param('walletId').isMongoId().withMessage('Invalid wallet ID'),
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

      const transactions = await Transaction.find({
        $or: [{ fromWallet: wallet.address }, { toWallet: wallet.address }],
        status: 'confirmed'
      });

      let balance = 0;
      transactions.forEach(tx => {
        if (tx.fromWallet === wallet.address) {
          balance -= (tx.amount + (tx.fee || 0));
        } else if (tx.toWallet === wallet.address) {
          balance += tx.amount;
        }
      });

      wallet.balance = balance;
      await wallet.save();

      res.json({
        success: true,
        data: { balance: wallet.balance },
        user: { id: req.user.userId, username: req.user.username, role: req.user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' }
      });
    } catch (error) {
      console.error('Get wallet balance error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  }
];

module.exports = {
    createWallet, getWalletBalance, getWallet
}