const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/user');
const { sendVerificationEmail, sendResetEmail } = require('../utils/mailer');
require('dotenv').config();

// SIGNUP
exports.signup = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });

    const { name, email, password } = req.body;

    bcrypt.hash(password, 12)
        .then(hashedPassword => {
            return new Promise((resolve, reject) => {
                crypto.randomBytes(32, (err, buffer) => {
                    if (err) return reject(err);
                    resolve(buffer.toString('hex')); // generate one token
                });
            }).then(token => {
                const user = new User({
                    name,
                    email,
                    password: hashedPassword,
                    role: 'company',           // force company role for self-signup
                    isVerified: false,
                    emailToken: token,
                    emailTokenExpires: Date.now() + 3600000
                });

                return user.save()
                    .then(user => sendVerificationEmail(user.email, token))
                    .then(() => {
                        return res.status(201).json({ message: 'User created. Check email to verify your account.' });
                    });
            });
        })
        .catch(err => {
            if (!err.statusCode) err.statusCode = 500;
            next(err);
        });
};



exports.verifyEmail = (req, res, next) => {
    const token = req.params.token;

    User.findOne({
        emailToken: req.params.token,
        emailTokenExpires: { $gt: Date.now() } // token still valid
    })
        .then(user => {
            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired token.' });
            }

            user.isVerified = true;
            user.emailToken = undefined;
            user.emailTokenExpires = undefined;
            return user.save();
        })
        .then(() => res.status(200).json({ message: 'Email verified successfully.' }))
        .catch(err => {
            if (!err.statusCode) err.statusCode = 500;
            next(err);
        });

};

// LOGIN
exports.login = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    let foundUser;

    User.findOne({ email })
        .then(user => {
            if (!user) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }
            foundUser = user;
            return bcrypt.compare(password, user.password);
        })
        .then(isMatch => {
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid email or password' });
            }

            if (!foundUser.isVerified) {
                return res.status(403).json({ message: 'Please verify your email before logging in.' });
            }

            const token = jwt.sign(
                {
                    userId: foundUser._id,
                    role: foundUser.role,
                    company: foundUser.company // important for multi-company checks
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.status(200).json({
                token,
                userId: foundUser._id,
                role: foundUser.role
            });
        })
        .catch(err => {
            res.status(500).json({ message: err.message });
        });
};


exports.postReset = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed');
        error.statusCode = 422;
        error.data = errors.array();
        return next(error);
    }

    crypto.randomBytes(32, (err, buffer) => {
        if (err) {
            err.statusCode = 500;
            return next(err);
        }

        const token = buffer.toString('hex');

        User.findOne({ email: req.body.email })
            .then(user => {
                if (!user) {
                    const error = new Error('No account with that email found.');
                    error.statusCode = 404;
                    throw error;
                }

                user.resetToken = token;
                user.resetTokenExpiration = Date.now() + 3600000; // 1 hour expiry
                return user.save();
            })
            .then(user => sendResetEmail(user.email, token))
            .then(() => {
                res.status(200).json({ message: 'Password reset email sent.' });
            })
            .catch(err => {
                if (!err.statusCode) err.statusCode = 500;
                next(err);
            });
    });
};

// --- Reset password using token ---
exports.postNewPassword = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const error = new Error('Validation failed');
        error.statusCode = 422;
        error.data = errors.array();
        return next(error);
    }

    const newPassword = req.body.password;
    const passwordToken = req.body.token;
    let resetUser;

    User.findOne({
        resetToken: passwordToken,
        resetTokenExpiration: { $gt: Date.now() }
    })
        .then(user => {
            if (!user) {
                const error = new Error('Invalid or expired token.');
                error.statusCode = 400;
                throw error;
            }
            resetUser = user;
            return bcrypt.hash(newPassword, 12);
        })
        .then(hashedPassword => {
            resetUser.password = hashedPassword;
            resetUser.resetToken = undefined;
            resetUser.resetTokenExpiration = undefined;
            return resetUser.save();
        })
        .then(() => {
            res.status(200).json({ message: 'Password has been reset successfully.' });
        })
        .catch(err => {
            if (!err.statusCode) err.statusCode = 500;
            next(err);
        });
};
