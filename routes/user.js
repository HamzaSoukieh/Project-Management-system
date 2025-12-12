const express = require('express');
const isAuth = require('../middleware/is_auth');
const userController = require('../controllers/user');
const { uploadUserPhoto, uploadReport } = require('../config/multer');
// <-- correct
const { body } = require('express-validator');

const router = express.Router();

router.get('/profile', isAuth, userController.getMyProfile);

router.put(
    '/profile',
    isAuth,
    uploadUserPhoto,  // only images allowed
    [
        body('name')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 2 }),

        body('email')
            .optional()
            .isEmail()
            .withMessage('Invalid email format')
            .custom(async (value, { req }) => {
                const existing = await User.findOne({ email: value });

                // If someone else has this email, reject
                if (existing && existing._id.toString() !== req.userId) {
                    throw new Error('Email is already in use');
                }

                return true;
            })
    ],
    userController.updateMyProfile
);


module.exports = router;
