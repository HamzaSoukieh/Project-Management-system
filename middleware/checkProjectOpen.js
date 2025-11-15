const Project = require('../models/project');
const Task = require('../models/task');

module.exports = (req, res, next) => {
    const projectId = req.body.projectId || req.params.projectId;

    if (projectId) {
        return Project.findById(projectId)
            .then(project => {
                if (!project) return res.status(404).json({ message: 'Project not found.' });
                if (project.status === 'completed') {
                    return res.status(403).json({ message: 'Cannot modify a closed project.' });
                }
                next();
            })
            .catch(err => res.status(500).json({ message: err.message }));
    }

    // If no projectId was provided, check if this is a task update
    if (req.params.taskId) {
        return Task.findById(req.params.taskId)
            .then(task => {
                if (!task) return res.status(404).json({ message: 'Task not found.' });

                return Project.findById(task.project)
                    .then(project => {
                        if (!project) return res.status(404).json({ message: 'Project not found.' });
                        if (project.status === 'completed') {
                            return res.status(403).json({ message: 'Cannot modify a closed project.' });
                        }
                        next();
                    });
            })
            .catch(err => res.status(500).json({ message: err.message }));
    }

    return res.status(400).json({ message: 'Project ID required.' });
};