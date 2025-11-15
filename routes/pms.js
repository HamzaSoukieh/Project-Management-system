const express = require('express');
const router = express.Router();
const pmsController = require('../controllers/project-manager');
const isAuth = require('../middleware/is_auth');
const checkRole = require('../middleware/checkRole');
const { body } = require('express-validator');
const sendProjectClosedEmail = require('../utils/mailer');

// only project managers (or company roles, depending on your setup) can create teams
// Projects
router.post('/project/create',
    isAuth,
    checkRole('projectManager'),
    [
        body('name')
            .notEmpty().withMessage('Project name is required.')
            .isLength({ max: 100 }).withMessage('Project name can be max 100 characters.'),
        body('description')
            .notEmpty().withMessage('Project description is required.')
            .isLength({ max: 500 }).withMessage('Project description can be max 500 characters.')
    ],
    pmsController.createProject);

// Teams
router.post('/team/create',
    isAuth,
    checkRole('projectManager'),
    [
        body('name')
            .notEmpty().withMessage('Team name is required.')
            .isLength({ max: 100 }).withMessage('Team name can be max 100 characters.'),
        body('members')
            .isArray({ min: 1 }).withMessage('Members must be a non-empty array.'),
        body('projectId')
            .notEmpty().withMessage('Project ID is required.')
            .isMongoId().withMessage('Project ID must be a valid Mongo ID.')
    ],
    pmsController.createTeam);

// Tasks
router.post('/task/create',
    isAuth,
    checkRole('projectManager'),
    [
        body('title')
            .notEmpty().withMessage('Task title is required.')
            .isLength({ max: 100 }).withMessage('Task title can be max 100 characters.'),
        body('description')
            .optional()
            .isLength({ max: 500 }).withMessage('Task description can be max 500 characters.'),
        body('teamId')
            .notEmpty().withMessage('Team ID is required.')
            .isMongoId().withMessage('Team ID must be a valid Mongo ID.'),
        body('assignedTo')
            .notEmpty().withMessage('Assigned user is required.')
            .isMongoId().withMessage('Assigned user ID must be a valid Mongo ID.'),
        body('dueDate')
            .optional()
            .isISO8601().withMessage('Due date must be a valid date.')
    ],
    pmsController.createTask)

router.put(
    '/projects/:projectId/status',
    isAuth,
    checkRole('projectManager'),
    [
        body('status')
            .isIn(['active', 'completed', 'on hold'])
            .withMessage('Status must be one of: active, completed, on hold')
    ],
    pmsController.updateProjectStatus
);

router.put(
    '/tasks/:taskId',
    isAuth,
    checkRole('projectManager'),   // only PM can access
    [
        body('title').optional().isLength({ min: 1 }).withMessage('Title cannot be empty.'),
        body('status').optional().isIn(['pending', 'in progress', 'completed']).withMessage('Invalid status value.'),
        body('description').optional().isString(),
        body('dueDate').optional().isISO8601().toDate()
    ],
    pmsController.updateTaskByPM
);

router.put(
    '/teams/:teamId',
    isAuth,
    checkRole('projectManager'),
    [
        body('name').optional().isString().trim().notEmpty(),
        body('members').optional().isArray(),
        body('members.*').optional().isMongoId()
    ],
    pmsController.editTeam
);

router.patch(
    '/projects/:projectId/close',
    isAuth,
    checkRole('projectManager'),
    pmsController.closeProject
);

router.get(
    '/dashboard',
    isAuth,
    checkRole('projectManager'),
    pmsController.getPMDashboard
);

module.exports = router;