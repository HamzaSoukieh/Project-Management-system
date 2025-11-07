const express = require('express');
const router = express.Router();
const pmsController = require('../controllers/project-manager');
const isAuth = require('../middleware/is_auth');
const checkRole = require('../middleware/checkRole');

// only project managers (or company roles, depending on your setup) can create teams
// Projects
router.post('/project/create', isAuth, checkRole('projectManager'), pmsController.createProject);

// Teams
router.post('/team/create', isAuth, checkRole('projectManager'), pmsController.createTeam);

// Tasks
router.post('/task/create', isAuth, checkRole('projectManager'), pmsController.createTask)
module.exports = router;