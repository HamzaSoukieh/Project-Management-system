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


exports.updateProjectStatus = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { projectId } = req.params;
    const { status } = req.body;
    const pmId = req.userId;
    const companyId = req.companyId;

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

exports.deleteProject = (req, res, next) => {
    const projectId = req.params.projectId;
    const pmId = req.userId;
    const companyId = req.companyId;

    Project.findOneAndDelete({ _id: projectId, projectManager: pmId, company: companyId })
        .then(project => {
            if (!project) {
                return res.status(404).json({ message: 'Project not found or not yours.' });
            }
            return Promise.all([
                Team.deleteMany({ project: projectId }),
                Task.deleteMany({ project: projectId })
            ]);
        })
        .then(() => {
            res.status(200).json({ message: 'Project and all related teams and tasks deleted successfully' });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

