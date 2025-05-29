const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateAccessToken = async (userId) => {
    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    await User.findByIdAndUpdate(userId,{$push : {refreshTokens: refreshToken}});

    return refreshToken;
};

const verifyAccessToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired access token');
    }
};

const verifyRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.refreshTokens.includes(token)) {
      throw new Error('Invalid or expired refresh token');
    }
    
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};

const invalidateRefreshToken = async (token) => {
  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    await User.findByIdAndUpdate(decoded.userId, { $pull: { refreshTokens: token } });
  } catch (error) {
    // Ignore invalid tokens
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  invalidateRefreshToken,
};