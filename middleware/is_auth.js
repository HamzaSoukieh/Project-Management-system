const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async (req, res, next) => {
    const authHeader = req.get('Authorization');
    if (!authHeader) return res.status(401).json({ message: 'Not Authenticated' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token missing' });

    let decodedToken;
    try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(401).json({ message: 'Invalid token' });
    }

    try {
        const user = await User.findById(decodedToken.userId);
        if (!user) return res.status(401).json({ message: 'User not found' });
        if (!user.isVerified) return res.status(403).json({ message: 'Please verify your email first' });

        // ✅ now guaranteed to exist
        req.userId = user._id;
        req.userRole = user.role;
        req.companyId = user.company;

        console.log('isAuth middleware: req.userId=', req.userId, 'req.companyId=', req.companyId);

        next();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
