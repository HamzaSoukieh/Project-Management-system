const express = require('express');
const isAuth = require('../middleware/is_auth');
const userController = require('../controllers/user');
const router = express.Router();

router.get('/profile', isAuth, userController.getMyProfile);

module.exports = router;
