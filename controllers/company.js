const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user');
const { sendVerificationEmail } = require('../utils/mailer');
const { validationResult } = require('express-validator');

exports.createUser = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const companyId = req.userId;  // from isAuth
    const { name, email, password, role } = req.body;

    // role validation handled by express-validator, no need for manual check

    User.findOne({ email })
        .then(existingUser => {
            if (existingUser) return res.status(400).json({ message: 'Email already registered' });

            return bcrypt.hash(password, 12);
        })
        .then(hashedPassword => {
            const emailToken = crypto.randomBytes(32).toString('hex');
            const emailTokenExpires = Date.now() + 3600000; // 1 hour

            const user = new User({
                name,
                email,
                password: hashedPassword,
                role: role || 'member',
                company: companyId,
                isVerified: false,
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;  // member to promote
    const companyId = req.companyId; // from JWT

    if (!companyId) {
        return res.status(400).json({ message: 'Missing company ID for logged-in user' });
    }

    User.findById(userId)
        .then(user => {
            if (!user) return res.status(404).json({ message: 'User not found' });

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
