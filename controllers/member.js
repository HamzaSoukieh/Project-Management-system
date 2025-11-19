const { validationResult } = require('express-validator');
const Team = require('../models/team');
const Task = require('../models/task');
const Project = require('../models/project');

exports.updateTaskStatus = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const taskId = req.params.taskId;
    const userId = req.userId;
    const companyId = req.companyId;

    Task.findOne({ _id: taskId, assignedTo: userId, company: companyId })
        .then(task => {
            if (!task) {
                return res.status(404).json({ message: 'Task not found or not assigned to you.' });
            }

            task.status = status;
            return task.save();
        })
        .then(updatedTask =>
            res.status(200).json({
                message: 'Task status updated successfully.',
                task: updatedTask
            })
        )
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.getMemberDashboard = (req, res, next) => {
    const memberId = req.userId;
    const companyId = req.companyId;

    Team.findOne({ members: memberId, company: companyId })
        .populate('projectManager', 'name email')
        .populate('project', 'name status description')
        .then(team => {
            if (!team) {
                return res.status(404).json({ message: 'You are not assigned to any team yet.' });
            }

            return Project.findOne({ _id: team.project, company: companyId })
                .then(project => {
                    // Fetch ALL team tasks, not only member tasks
                    return Task.find({
                        team: team._id,
                        company: companyId
                    })
                        .populate('assignedTo', 'name email')
                        .populate('createdBy', 'name email')
                        .then(tasks => {
                            res.status(200).json({
                                message: 'Member dashboard loaded successfully',
                                project,
                                team,
                                tasks
                            });
                        });
                });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};
