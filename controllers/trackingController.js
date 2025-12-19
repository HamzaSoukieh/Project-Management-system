const Project = require("../models/project");
const Task = require("../models/task");

exports.getTracking = function (req, res) {
    const projectId = req.params.id;
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    Project.findById(projectId).lean()
        .then(function (project) {
            if (!project) return res.status(404).json({ message: "Project not found" });

            return Task.find({ project: projectId })
                .select("status progress dueDate estimatedHours")
                .lean()
                .then(function (tasks) {
                    const total = tasks.length;
                    const completed = tasks.filter(t => t.status === "completed").length;

                    const overdue = tasks.filter(function (t) {
                        return t.dueDate && t.dueDate < now && t.status !== "completed";
                    }).length;

                    const dueSoon = tasks.filter(function (t) {
                        return t.dueDate && t.dueDate >= now && t.dueDate <= threeDaysFromNow && t.status !== "completed";
                    }).length;

                    const avgProgress = total === 0
                        ? 0
                        : Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / total);

                    const totalEst = tasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);

                    const weightedProgress = totalEst === 0
                        ? avgProgress
                        : Math.round(
                            tasks.reduce((s, t) => s + (t.progress || 0) * (t.estimatedHours || 0), 0) / totalEst
                        );

                    res.json({
                        projectId,
                        projectDueDate: project.dueDate || null,
                        totalTasks: total,
                        completedTasks: completed,
                        overdueTasks: overdue,
                        dueSoonTasks: dueSoon,
                        avgProgress,
                        weightedProgress
                    });
                });
        })
        .catch(function (err) {
            res.status(500).json({ message: err.message });
        });
};
