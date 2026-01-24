const express = require('express');
const router = express.Router();
const pmsController = require('../controllers/project-manager');
const trackingController = require('../controllers/trackingController');
const isAuth = require('../middleware/is_auth');
const checkRole = require('../middleware/checkRole');
const { body, param } = require('express-validator');
const sendProjectClosedEmail = require('../utils/mailer');
const reportController = require('../controllers/report');

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
            .isLength({ max: 500 }).withMessage('Project description can be max 500 characters.'),
        body("dueDate")
            .notEmpty().withMessage("Deadline is required")
            .isISO8601().withMessage("Invalid deadline format")
            .toDate(),
        body("startDate")
            .optional()
            .isISO8601().withMessage("Invalid start date format")
            .toDate()

    ],
    pmsController.createProject
);

// Teams
router.post(
    "/team/create",
    isAuth,
    checkRole("projectManager"),
    [
        body("name")
            .trim()
            .notEmpty().withMessage("Team name is required.")
            .isLength({ max: 100 }).withMessage("Team name can be max 100 characters."),

        body("projectId")
            .isMongoId()
            .withMessage("Valid projectId is required."),

        body("members")
            .isArray({ min: 1 })
            .withMessage("Members must be a non-empty array of user IDs.")
            .custom((arr) => {
                const allValid = arr.every(
                    (id) => /^[0-9a-fA-F]{24}$/.test(id)
                );
                if (!allValid) throw new Error("Each member must be a valid userId.");
                return true;
            })
            .custom((arr) => {
                const set = new Set(arr);
                if (set.size !== arr.length) {
                    throw new Error("Duplicate members are not allowed.");
                }
                return true;
            })
    ],
    pmsController.createTeam
);

// Tasks
router.post(
    "/task/create",
    isAuth,
    checkRole("projectManager"),
    [
        body("title")
            .trim()
            .notEmpty().withMessage("Task title is required.")
            .isLength({ max: 100 }).withMessage("Task title can be max 100 characters."),

        body("description")
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage("Task description can be max 500 characters."),

        body("teamId")
            .isMongoId()
            .withMessage("Valid teamId is required."),

        body("assignedToId")
            .isMongoId()
            .withMessage("Valid assignedToId is required."),

        body("dueDate")
            .optional()
            .isISO8601().withMessage("Due date must be a valid date."),

        body("estimatedHours")
            .optional()
            .isNumeric().withMessage("Estimated hours must be a number.")
            .toFloat(),

        body("priority")
            .optional()
            .isIn(["low", "medium", "high"])
            .withMessage("Priority must be low, medium, or high.")
    ],
    pmsController.createTask
);


router.put(
    '/projects/:projectId/status',
    isAuth,
    checkRole('projectManager'),
    [
        body('status')
            .isIn(['active', 'on hold'])
            .withMessage('Status must be one of: active, completed, on hold')
    ],
    pmsController.updateProjectStatus
);

router.put(
    "/tasks/:taskId",
    isAuth,
    checkRole("projectManager"),
    [
        body("title").optional().isLength({ min: 1 }).withMessage("Title cannot be empty."),
        body("status")
            .optional()
            .isIn(["pending", "in progress", "completed"])
            .withMessage("Invalid status value."),
        body("description").optional().isString(),
        body("dueDate").optional().isISO8601().toDate(),

        // NEW: assignedToId instead of assignedToName
        body("assignedToId")
            .optional()
            .isMongoId()
            .withMessage("Invalid assignedToId."),
    ],
    pmsController.updateTaskByPM
);


router.put(
    "/teams/:teamId",
    isAuth,
    checkRole("projectManager"),
    [
        param("teamId").isMongoId().withMessage("Invalid teamId."),

        body("newName")
            .optional()
            .isString()
            .trim()
            .notEmpty()
            .withMessage("newName cannot be empty."),

        body("membersToAdd")
            .optional()
            .isArray()
            .withMessage("membersToAdd must be an array."),
        body("membersToAdd.*")
            .optional()
            .isMongoId()
            .withMessage("Each membersToAdd item must be a valid MongoId."),

        body("membersToRemove")
            .optional()
            .isArray()
            .withMessage("membersToRemove must be an array."),
        body("membersToRemove.*")
            .optional()
            .isMongoId()
            .withMessage("Each membersToRemove item must be a valid MongoId."),
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
    '/projects/:projectId/reports',
    isAuth,
    checkRole('projectManager'),
    reportController.getProjectReports
);


router.delete(
    '/reports/:reportId',
    isAuth,
    checkRole('projectManager'),
    reportController.deleteReportByPm
);

router.get(
    '/dashboard',
    isAuth,
    checkRole('projectManager'),
    pmsController.getPMDashboard
);

router.get("/projects", isAuth, checkRole("projectManager"), pmsController.getPMProjects);

// TEAMS (only teams under PM projects)
router.get("/teams", isAuth, checkRole("projectManager"), pmsController.getPMTeams);

// TASKS (only tasks under PM projects)
router.get("/tasks", isAuth, checkRole("projectManager"), pmsController.getPMTasks);

// MEMBERS (only members in PM teams/projects) - optional
router.get("/team-members", isAuth, checkRole("projectManager"), pmsController.getPMMembers);

router.get("/projects/tracking", isAuth, checkRole("projectManager"), trackingController.getPMProjectsTracking);

router.get("/all-members", isAuth, checkRole("projectManager"), pmsController.getPMUsers);

module.exports = router;