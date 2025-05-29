const bcrypt = require('bcryptjs');
const User = require('../models/User');

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

    module.exports = { register };