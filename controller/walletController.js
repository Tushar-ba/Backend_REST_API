const { body, param, validationResult } = require('express-validator');
const Wallet = require('../models/Wallet');
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

module.exports = {
    createWallet
}