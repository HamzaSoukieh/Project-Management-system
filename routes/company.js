const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company');
const checkRole = require('../middleware/checkRole');
const isAuth = require('../middleware/is_auth'); // JWT middleware
const { body } = require('express-validator');

router.post(
    '/create-user',
    isAuth,
    checkRole('company'),
    [
        body('name')
            .notEmpty().withMessage('Name is required.')
            .isLength({ max: 100 }).withMessage('Name can be max 100 characters.'),
        body('email')
            .notEmpty().withMessage('Email is required.')
            .isEmail().withMessage('Email must be valid.'),
        body('password')
            .notEmpty().withMessage('Password is required.')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),
        body('role')
            .optional()
            .isIn(['member', 'projectManager']).withMessage('Role must be member or projectManager.')
    ],
    companyController.createUser
);
// Only a company can assign project managers
router.put(
    '/set-manager',
    isAuth,
    checkRole('company'),
    [
        body('userId')
            .notEmpty().withMessage('User ID is required.')
            .isMongoId().withMessage('User ID must be a valid Mongo ID.')
    ],
    companyController.setProjectManager
);

router.delete(
    '/delete-user',
    isAuth,
    checkRole('company'), // only company can delete its users
    [
        body('userId')
            .notEmpty().withMessage('User ID is required.')
            .isMongoId().withMessage('User ID must be a valid Mongo ID.')
    ],
    companyController.deleteUser
);

module.exports = router;
