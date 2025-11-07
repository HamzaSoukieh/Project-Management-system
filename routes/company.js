const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company');
const checkRole = require('../middleware/checkRole');
const isAuth = require('../middleware/is_auth'); // JWT middleware

router.post(
    '/create-user',
    isAuth,
    checkRole('company'),
    companyController.createUser
);
// Only a company can assign project managers
router.put(
    '/set-manager',
    isAuth,
    checkRole('company'),
    companyController.setProjectManager
);

module.exports = router;
