const Team = require('../models/team');
const Task = require('../models/task');
const User = require('../models/user');
const Project = require('../models/project');
const { validationResult } = require('express-validator');

exports.createProject = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, description } = req.body;
    const pmId = req.userId;
    const companyId = req.companyId;

    const project = new Project({
        name,
        description,
        projectManager: pmId,
        company: companyId
    });

    project.save()
        .then(proj => res.status(201).json({ message: 'Project created successfully', project: proj }))
        .catch(err => res.status(500).json({ message: err.message }));
};

// Create a new team
exports.createTeam = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, members, projectId } = req.body;
    const pmId = req.userId;
    const companyId = req.companyId;

    Project.findOne({ _id: projectId, projectManager: pmId, company: companyId })
        .then(project => {
            if (!project) return res.status(403).json({ message: 'Project not found or not yours.' });

            return User.find({ _id: { $in: members }, company: companyId })
                .then(validMembers => {
                    if (validMembers.length !== members.length) {
                        return res.status(403).json({ message: 'Some members do not belong to your company.' });
                    }

                    const team = new Team({
                        name,
                        members,
                        projectManager: pmId,
                        company: companyId,
                        project: projectId
                    });

                    return team.save()
                        .then(team => {
                            project.teams.push(team._id);
                            return project.save().then(() => team);
                        });
                });
        })
        .then(team => res.status(201).json({ message: 'Team created successfully', team }))
        .catch(err => res.status(500).json({ message: err.message }));
};
// Create a new task under a team

exports.createTask = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, teamId, assignedTo, dueDate } = req.body;
    const pmId = req.userId;
    const companyId = req.companyId;

    Team.findOne({ _id: teamId, projectManager: pmId, company: companyId })
        .populate('project') // so we can grab project ID easily
        .then(team => {
            if (!team)
                return res.status(403).json({ message: 'Team not found or not yours.' });

            if (!team.members.includes(assignedTo))
                return res.status(403).json({ message: 'Assigned user is not in this team.' });

            const task = new Task({
                title,
                description,
                team: teamId,
                project: team.project, // keep it clean
                assignedTo,
                createdBy: pmId,
                company: companyId,
                dueDate
            });

            return task.save();
        })
        .then(task => res.status(201).json({ message: 'Task created successfully', task }))
        .catch(err => res.status(500).json({ message: err.message }));
};

