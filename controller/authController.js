const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const jwtService = require('../services/jwtService');

const register = [
  // Input validation
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const { username, email, password, role, firstName, lastName, avatar } = req.body;

      // Check for existing user
      const existingUser = await User.findOne({ $or: [{ email }, { username }] });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: existingUser.email === email ? 'Email already registered' : 'Username already taken',
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(12); // Updated to 12 rounds
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create user
      const user = new User({
        username,
        email,
        password: hashedPassword,
        role: role || 'user',
        profile: {
          firstName: firstName || '',
          lastName: lastName || '',
          avatar: avatar || '',
        },
      });

      await user.save();

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: { id: user._id, username, email, role: user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' },
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  },
];

const login = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, error: errors.array().map(e => e.msg).join(', ') });
      }

      const { email, password } = req.body;

      // Find user
      const user = await User.findOne({ email });
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      // Check password
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }

      // Generate tokens
      const accessToken = jwtService.generateAccessToken(user._id, user.role);
      const refreshToken = await jwtService.generateRefreshToken(user._id);

      res.json({
        success: true,
        data: { accessToken, refreshToken },
        user: { id: user._id, username: user.username, email, role: user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' },
      });
      console.log('User logged in:', user.username);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  },
];

const getProfile = async (req, res) => {
    try {
      if (!req.user || !req.user.userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized: No user data' });
      }
  
      const user = await User.findById(req.user.userId).select('-password -refreshTokens');
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
  
      res.json({
        success: true,
        data: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          profile: user.profile,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        user: { id: user._id, username: user.username, email: user.email, role: user.role },
        meta: { timestamp: new Date().toISOString(), version: '1.0' },
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  };
  

module.exports = { register, login, getProfile};