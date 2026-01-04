const express = require('express');
const router = express.Router();

const { body } = require('express-validator'); // ✅ ONLY HERE

const companyReports = require('../controllers/report');
const companyController = require('../controllers/company');
const trackinController = require('../controllers/trackingController');
const authController = require('../controllers/auth');

const checkRole = require('../middleware/checkRole');
const isAuth = require('../middleware/is_auth');
const checkProjectOpen = require('../middleware/checkProjectOpen');

const User = require("../models/user"); // adjust path if needed



router.post(
    '/create-company',
    isAuth,
    checkRole('company'),
    [
        body('name')
            .trim()
            .notEmpty().withMessage('Company name is required')
            .isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),

        body('description')
            .optional()
            .trim()
            .isLength({ max: 500 }).withMessage('Description too long')
    ],
    companyController.createCompany
);

router.post(
    "/create-user",
    isAuth,
    checkRole("company"),
    [
        body("name")
            .trim()
            .notEmpty().withMessage("Name is required.")
            .bail()
            .isLength({ min: 2, max: 100 }).withMessage("Name must be between 2 and 100 characters.")
            .bail()
            .custom((value, { req }) => {
                // unique per company
                return User.findOne({ name: value, company: req.userId }).then((user) => {
                    if (user) return Promise.reject("Name already exists in this company.");
                });
            }),

        body("email")
            .trim()
            .notEmpty().withMessage("Email is required.")
            .bail()
            .isEmail().withMessage("Email must be valid.")
            .bail()
            .customSanitizer((value) => value.toLowerCase())
            .custom((value) => {
                // global unique email
                return User.findOne({ email: value }).then((user) => {
                    if (user) return Promise.reject("Email already registered.");
                });
            }),

        body("role")
            .optional()
            .trim()
            .isIn(["member", "projectManager"])
            .withMessage("Role must be member or projectManager."),
        body("password")
            .notEmpty().withMessage("Password is required.")
            .bail()
            .isLength({ min: 6 }).withMessage("Password must be at least 6 characters."),

    ],
    companyController.createUser
);
// Only a company can assign project managers
router.put(
    "/set-manager",
    isAuth,
    checkRole("company"),
    [
        body("name")
            .trim()
            .notEmpty().withMessage("User name is required.")
            .isLength({ max: 100 }).withMessage("User name can be max 100 characters.")
    ],
    companyController.setProjectManager
);

router.delete(
    "/delete-user",
    isAuth,
    checkRole("company"),
    [
        body("name")
            .trim()
            .notEmpty().withMessage("User name is required.")
            .isLength({ max: 100 }).withMessage("User name can be max 100 characters.")
    ],
    companyController.deleteUser
);

router.delete(
    '/projects/:projectId',
    isAuth,
    checkRole('company'),
    companyController.deleteProjectAfterClose
);

router.delete(
    '/reports/:reportId',
    isAuth,
    checkRole('company'),
    companyReports.deleteReportByCompany
);

router.get(
    '/reports',
    isAuth,
    checkRole('company'),
    companyReports.getAllCompanyReports
);


router.get('/dashboard',
    isAuth,
    checkRole('company'),
    companyController.getCompanyDashboard
);

router.get("/projects", isAuth, checkRole("company"), companyController.getCompanyProjects);

router.get("/tasks", isAuth, checkRole("company"), companyController.getCompanyTasks);

router.get("/projects/tracking", isAuth, checkRole("company"), trackinController.getCompanyProjectsTracking);

router.get("/all-members", isAuth, checkRole("company"), companyController.getCompanyUsers);

module.exports = router;