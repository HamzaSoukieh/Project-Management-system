// routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const User = require('../models/user');
const authController = require('../controllers/auth');

const router = express.Router();

// // Signup route with validation
// router.post(
//     '/signup',
//     [
//         body('name')
//             .trim()
//             .notEmpty()
//             .withMessage('Name is required.'),

//         body('email')
//             .isEmail()
//             .withMessage('Invalid email address.')
//             .custom(value => {
//                 return User.findOne({ email: value }).then(user => {
//                     if (user) {
//                         return Promise.reject('Email already exists.');
//                     }
//                 });
//             }),

//         body('password')
//             .isLength({ min: 6 })
//             .withMessage('Password must be at least 6 characters long.')
//     ],
//     authController.signup
// );

router.post(
    '/login',
    [
        body('email')
            .isEmail()
            .withMessage('Invalid email address.'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters')
    ],
    authController.login
);

router.get('/verify/:token', authController.verifyEmail);


// Request password reset
router.post(
    '/reset',
    body('email')
        .isEmail()
        .withMessage('Invalid email address.'),
    authController.postReset
);

// Reset password using token
router.post(
    '/new-password',
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long.'),
    body('token').notEmpty().withMessage('Token is required'),
    authController.postNewPassword
);

module.exports = router;
