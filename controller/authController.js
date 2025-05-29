const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwtService = require('../services/jwtService');

const register = async (req,res) => {
    try {
        const {username, email, password, role, firstName, lastName, avatar} = req.body;

        if (!username || !email || !password){
            return res.status(400).json({error: "All details are required"});
        }

        const existingUser = await User.findOne({$or:[{email},{username}]});
        if(existingUser){
            return res.status(400).json({
                error: existingUser.email === email ? 'Email already registered':'Username already taken',
            });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);

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
        })
        await user.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
}

const login = async (req,res) =>{

    const {email,password} = req.body;
    try {
        if ( !email || !password){
            res.status(400).json({error:"All the fields are mandatory"})
        }

        const user = await User.findOne({$or:[{email}]});
        if(!user){
            res.status(400).json({success:false, error:"User not found Please register"});
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            res.status(401).json({success:false,error:"Invalide password"})
        }

        const generateToken = await jwtService.generateAccessToken(user._id);
        const refreshToken = await jwtService.generateAccessToken(user._id);

        res.json({
            success: true,
            data: { generateToken, refreshToken },
            user: { id: user._id, username: user.username, email, role: user.role },
            meta: { timestamp: new Date().toISOString(), version: '1.0' },
        });   
        console.log("user logged in ", user.username)
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
}

    module.exports = { register, login };