const Project = require("../models/project");
const Task = require("../models/task");

module.exports = async (req, res, next) => {
    try {
        const projectId = req.body.projectId || req.params.projectId;
        const projectName = req.body.projectName || req.params.projectName;

        // 1) If projectId exists -> normal flow
        if (projectId) {
            const project = await Project.findById(projectId);
            if (!project) return res.status(404).json({ message: "Project not found." });

            if (project.status === "completed") {
                return res.status(403).json({ message: "Cannot modify a closed project." });
            }

            return next();
        }

        // 2) If projectName exists -> resolve it then check status
        if (projectName) {
            // If you have company scoping, use it (recommended)
            // If you DON'T have company in Project schema, remove "company: req.companyId"
            const query = { name: projectName };
            if (req.companyId) query.company = req.companyId;

            const project = await Project.findOne(query);
            if (!project) return res.status(404).json({ message: "Project not found." });

            if (project.status === "completed") {
                return res.status(403).json({ message: "Cannot modify a closed project." });
            }

            // Make downstream code happy (convert name flow -> id flow)
            req.body.projectId = project._id;

            return next();
        }

        // 3) If no project provided, maybe it's a task update (old behavior)
        if (req.params.taskId) {
            const task = await Task.findById(req.params.taskId);
            if (!task) return res.status(404).json({ message: "Task not found." });

            const project = await Project.findById(task.project);
            if (!project) return res.status(404).json({ message: "Project not found." });

            if (project.status === "completed") {
                return res.status(403).json({ message: "Cannot modify a closed project." });
            }

            return next();
        }

        // 4) Nothing provided
        return res.status(400).json({ message: "Project ID or projectName required." });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};
