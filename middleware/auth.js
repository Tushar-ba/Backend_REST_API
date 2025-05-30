const jwt = require ('jsonwebtoken');
const Wallet = require('../models/Wallet');

const authenticateToken = (req, res, next) =>{
    const authHeader = req.headers['authorization'];
    const token = authHeader.split(' ')[1];
    if(!token){
        return res.status(401).json({error:'Access token required'});
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {userId: decoded.userId, role:decoded.role};
        next();
    } catch (error) {
        return res.status(403).json({error: 'Invalid or expired token'});
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
  };

const checkWalletOwnership = async (req, res, next) => {
  try {
    const wallet = await Wallet.findById(req.params.walletId);
    if (!wallet) {
      return res.status(404).json({ success: false, error: 'Wallet not found' });
    }
    if (wallet.userId.toString() !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Access denied: Not your wallet' });
    }
    next();
  } catch (error) {
    console.error('Check wallet ownership error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

module.exports = {authenticateToken, requireAdmin, checkWalletOwnership};
