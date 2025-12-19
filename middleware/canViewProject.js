const Project = require("../models/project");
const Task = require("../models/task");

module.exports = function canViewProject(req, res, next) {
    const projectId = req.params.id;
    const user = req.user; // set by auth middleware

    Project.findById(projectId)
        .select("company projectManager")
        .then(function (project) {
            if (!project) return res.status(404).json({ message: "Project not found" });

            // company owner can view their own project
            if (user.role === "company" && String(project.company) === String(user._id)) {
                req.project = project; // reuse if you want
                return next();
            }

            // project manager can view their own project
            if (
                user.role === "projectManager" &&
                String(project.projectManager) === String(user._id)
            ) {
                req.project = project;
                return next();
            }

            // optional: tasks role can view if assigned to a task in this project
            if (user.role === "tasks") {
                return Task.exists({ project: projectId, assignedTo: user._id })
                    .then(function (exists) {
                        if (!exists) return res.status(403).json({ message: "Forbidden" });
                        req.project = project;
                        next();
                    });
            }

            return res.status(403).json({ message: "Forbidden" });
        })
        .catch(function (err) {
            res.status(500).json({ message: err.message });
        });
};
