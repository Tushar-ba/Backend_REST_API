const express = require('express');
const router = express.Router();
const {register, login, getProfile, updateProfile, refreshToken} = require('../controller/authController');
const {authenticateToken} = require('../middleware/auth')

router.post('/register', register);
router.post('/login',login);
router.post('/refreshToken', refreshToken)

router.get('/profile', authenticateToken, getProfile);
router.post('/updateProfile', authenticateToken, updateProfile);
module.exports = router;