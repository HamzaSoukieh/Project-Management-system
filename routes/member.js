const { body, param } = require('express-validator');
const memberController = require('../controllers/member');
const isAuth = require('../middleware/is_auth');
const checkRole = require('../middleware/checkRole');
const checkProjectOpen = require('../middleware/checkProjectOpen');

const express = require('express');
const router = express.Router();


router.put(
    '/tasks/:taskId/status',
    isAuth,
    checkRole('member'),
    [
        param('taskId')
            .isMongoId()
            .withMessage('Invalid task ID.'),

        body('status')
            .isIn(['pending', 'in progress', 'completed'])
            .withMessage('Status must be one of: pending, in progress, or completed.')
    ],
    checkProjectOpen,
    memberController.updateTaskStatus
);

router.get(
    '/dashboard',
    isAuth,
    checkRole('member'),
    memberController.getMemberDashboard
);

module.exports = router;