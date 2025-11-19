const { body, param } = require('express-validator');
const memberController = require('../controllers/member');
const reportController = require('../controllers/report');
const isAuth = require('../middleware/is_auth');
const checkRole = require('../middleware/checkRole');
const checkProjectOpen = require('../middleware/checkProjectOpen');
const upload = require('../config/multer');

const express = require('express');
const router = express.Router();

router.post(
    '/reports',
    isAuth,
    checkRole('member'),
    upload.single('file'),
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('description').optional(),
        body('teamId').notEmpty().withMessage('teamId required'),
        body('projectId').notEmpty().withMessage('projectId required')
    ],
    checkProjectOpen,
    reportController.createReport
);

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
    '/reports',
    isAuth,
    checkRole('member'),
    reportController.getMyTeamReports
);

// router.get(
//     '/reports/:reportId',
//     isAuth,
//     checkRole('member'),
//     memberController.getSingleReport
// );

router.get(
    '/dashboard',
    isAuth,
    checkRole('member'),
    memberController.getMemberDashboard
);

module.exports = router;