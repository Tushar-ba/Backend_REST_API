const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateAccessToken = (userId, role) => {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || 3600 });
};

const generateRefreshToken = async (userId) => {
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || 3600,
  });
  await User.findByIdAndUpdate(userId, { $push: { refreshTokens: refreshToken } });
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
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
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
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
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