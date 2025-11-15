const Team = require('../models/team');
const Task = require('../models/task');
const User = require('../models/user');
const Project = require('../models/project');
const { validationResult } = require('express-validator');
const { sendProjectClosedEmail } = require('../utils/mailer');

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


exports.updateProjectStatus = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { projectId } = req.params;
    const { status } = req.body;
    const pmId = req.userId;
    const companyId = req.companyId;

    if (!['active', 'on hold'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'active' or 'on hold'" });
    }

    Project.findOne({ _id: projectId, projectManager: pmId, company: companyId })
        .then(project => {
            if (!project) {
                return res.status(404).json({ message: 'Project not found or not yours.' });
            }

            project.status = status;
            return project.save();
        })
        .then(updatedProject =>
            res.status(200).json({
                message: 'Project status updated successfully',
                project: updatedProject
            })
        )
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.updateTaskByPM = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { taskId } = req.params;
    const { title, description, dueDate, status } = req.body;
    const pmId = req.userId;  // project manager ID
    const companyId = req.companyId;

    Task.findOne({ _id: taskId, createdBy: pmId, company: companyId })
        .then(task => {
            if (!task) return res.status(404).json({ message: 'Task not found or not yours.' });

            // Update only provided fields
            if (title) task.title = title;
            if (description) task.description = description;
            if (dueDate) task.dueDate = dueDate;
            if (status && ['pending', 'in progress', 'completed'].includes(status)) {
                task.status = status;
            }

            return task.save();
        })
        .then(updatedTask => res.status(200).json({ message: 'Task updated successfully', task: updatedTask }))
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.editTeam = (req, res, next) => {
    const { teamId } = req.params;
    const { name, membersToAdd, membersToRemove } = req.body;
    const pmId = req.userId;
    const companyId = req.companyId;

    Team.findOne({ _id: teamId, projectManager: pmId, company: companyId })
        .then(team => {
            if (!team) {
                return res.status(404).json({ message: 'Team not found or not yours.' });
            }

            // Rename team
            if (name) {
                team.name = name;
            }

            // Add members
            if (Array.isArray(membersToAdd) && membersToAdd.length > 0) {
                membersToAdd.forEach(member => {
                    // Only add if not already included
                    if (!team.members.includes(member)) {
                        team.members.push(member);
                    }
                });
            }

            // Remove members
            if (Array.isArray(membersToRemove) && membersToRemove.length > 0) {
                team.members = team.members.filter(
                    m => !membersToRemove.includes(m.toString())
                );
            }

            return team.save();
        })
        .then(updatedTeam => {
            res.status(200).json({
                message: 'Team updated successfully.',
                team: updatedTeam
            });
        })
        .catch(err => {
            res.status(500).json({ message: err.message });
        });
};


exports.closeProject = (req, res, next) => {
    const projectId = req.params.projectId;
    const pmId = req.userId;

    let closedProject;
    let pmUser;

    // 1. get PM info for the email
    User.findById(pmId)
        .then(pm => {
            pmUser = pm;
            return Project.findOne({ _id: projectId, projectManager: pmId });
        })
        .then(project => {
            if (!project) {
                return res.status(404).json({
                    message: 'Project not found or not under your management.'
                });
            }

            project.status = 'completed';
            return project.save();
        })
        .then(project => {
            closedProject = project;

            // Mark all tasks completed
            return Task.updateMany(
                { project: projectId },
                { $set: { status: 'completed' } }
            );
        })
        .then(() => {
            // find company owner (companyId is the user who owns the company)
            return User.findById(closedProject.company);
        })
        .then(companyUser => {
            if (!companyUser) {
                return res.status(500).json({
                    message: 'Project closed but company owner not found.'
                });
            }

            // send closure email
            return sendProjectClosedEmail(
                companyUser.email,
                closedProject.name,
                pmUser.name
            );
        })
        .then(() => {
            res.status(200).json({
                message: 'Project closed, tasks completed, company notified.',
                project: closedProject
            });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.getPMDashboard = (req, res, next) => {
    const pmId = req.userId;       // project manager ID
    const companyId = req.companyId; // company they belong to

    // 1. Find projects the PM manages
    Project.find({ projectManager: pmId, company: companyId })
        .then(projects => {
            const projectIds = projects.map(p => p._id);

            // 2. Find teams under these projects
            return Team.find({ project: { $in: projectIds }, projectManager: pmId, company: companyId })
                .populate('members', 'name email role')
                .populate('project', 'name status description')
                .then(teams => {
                    const teamIds = teams.map(t => t._id);

                    // 3. Find tasks for these teams
                    return Task.find({ team: { $in: teamIds }, company: companyId })
                        .populate('assignedTo', 'name email role')
                        .populate('createdBy', 'name email role')
                        .populate('project', 'name status')
                        .then(tasks => {
                            res.status(200).json({
                                message: 'PM dashboard loaded successfully',
                                projects,
                                teams,
                                tasks
                            });
                        });
                });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};