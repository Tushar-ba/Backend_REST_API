const jwt = require ('jsonwebtoken');

const authenticateToken = (req, res, next) =>{
    const authHeader = req.headers['authentication'];
    const token = authHeader && authHeader.split('')[1];
    if(!token){
        return res.status(401).json({error:'Access token required'});
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {userId: decoded.userId};
        next();
    } catch (error) {
        return res.status(403).json({error: 'Invalid or expired token'});
    }
};

module.exports = authenticateToken;
