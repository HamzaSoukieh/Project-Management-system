const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user');
const { sendVerificationEmail } = require('../utils/mailer');

exports.createUser = (req, res, next) => {
    const companyId = req.userId;  // from isAuth
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    // Only allow company to create member or PM
    if (role && role === 'company') {
        return res.status(403).json({ message: 'Cannot create another company' });
    }

    User.findOne({ email })
        .then(existingUser => {
            if (existingUser) return res.status(400).json({ message: 'Email already registered' });

            return bcrypt.hash(password, 12);
        })
        .then(hashedPassword => {
            // Generate email verification token
            const emailToken = crypto.randomBytes(32).toString('hex');
            const emailTokenExpires = Date.now() + 3600000; // 1 hour

            const user = new User({
                name,
                email,
                password: hashedPassword,
                role: role || 'member',
                company: companyId,
                isVerified: false,           // initially unverified
                emailToken,
                emailTokenExpires
            });

            return user.save()
                .then(user => sendVerificationEmail(user.email, emailToken))
                .then(() => res.status(201).json({ message: 'User created. Verification email sent.' }));
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.setProjectManager = (req, res, next) => {
    const { userId } = req.body;  // member to promote
    const companyId = req.companyId; // ✅ use the company ID from JWT
    // company making the promotion

    if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
    }

    if (!companyId) {
        return res.status(400).json({ message: 'Missing company ID for logged-in user' });
    }

    User.findById(userId)
        .then(user => {
            if (!user) return res.status(404).json({ message: 'User not found' });

            // Debugging logs (check the console)
            console.log('Target user company:', user.company ? user.company.toString() : null);
            console.log('Logged-in company:', companyId ? companyId.toString() : null);

            // Prevent promotion from another company
            if (user.company && user.company.toString() !== companyId.toString()) {
                return res.status(403).json({ message: 'Cannot promote user from another company' });
            }

            user.role = 'projectManager';
            user.company = companyId; // assign company if missing
            return user.save();
        })
        .then(updatedUser => res.status(200).json({
            message: 'User promoted to Project Manager',
            user: updatedUser
        }))
        .catch(err => {
            console.error(err);
            res.status(500).json({ message: err.message });
        });
};

