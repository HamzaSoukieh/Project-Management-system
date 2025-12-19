const { validationResult } = require('express-validator');
const Team = require('../models/team');
const Task = require('../models/task');
const Project = require('../models/project');

exports.updateTaskStatus = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const taskId = req.params.taskId;
    const userId = req.userId;
    const companyId = req.companyId;

    if (!["pending", "in progress", "completed"].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
    }

    Task.findOne({ _id: taskId, assignedTo: userId, company: companyId })
        .then(task => {
            if (!task) {
                res.status(404).json({ message: "Task not found or not assigned to you." });
                return null; // ✅ stop chain
            }

            task.status = status;
            return task.save();
        })
        .then(updatedTask => {
            if (!updatedTask) return; // ✅ already responded
            res.status(200).json({
                message: "Task status updated successfully.",
                task: updatedTask
            });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getMemberDashboard = (req, res) => {
    const memberId = req.userId;
    const companyId = req.companyId;
    const now = new Date();

    Team.find({ members: memberId, company: companyId })
        .select("name project projectManager")
        .populate("projectManager", "name email")
        .populate("project", "name status dueDate")
        .lean()
        .then(function (teams) {
            if (!teams || teams.length === 0) {
                res.status(404).json({ message: "You are not assigned to any team yet." });
                return null; // ✅ stop chain
            }

            const teamIds = teams.map(t => t._id);

            const mySummaryPromise = Promise.all([
                Task.countDocuments({ company: companyId, assignedTo: memberId }),
                Task.countDocuments({ company: companyId, assignedTo: memberId, status: { $ne: "completed" } }),
                Task.countDocuments({
                    company: companyId,
                    assignedTo: memberId,
                    dueDate: { $lt: now },
                    status: { $ne: "completed" },
                }),
            ]);

            const myNextTasksPromise = Task.find({
                company: companyId,
                assignedTo: memberId,
                status: { $ne: "completed" },
            })
                .select("title status dueDate progress project priority")
                .populate("project", "name")
                .sort({ dueDate: 1 })
                .limit(10)
                .lean();

            // team tasks across ALL member teams (top 10 latest)
            const teamTasksPromise = Task.find({
                company: companyId,
                team: { $in: teamIds },
            })
                .select("title status dueDate progress assignedTo team")
                .populate("assignedTo", "name email")
                .sort({ updatedAt: -1 })
                .limit(10)
                .lean();

            return Promise.all([mySummaryPromise, myNextTasksPromise, teamTasksPromise])
                .then(function ([counts, myNextTasks, teamTasks]) {
                    const [myTotalTasks, myOpenTasks, myOverdue] = counts;

                    res.json({
                        summary: { myTotalTasks, myOpenTasks, myOverdue },
                        teams: teams.slice(0, 10),
                        myNextTasks,
                        teamTasks,
                    });

                    return true; // ✅ just to return something truthy
                });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getMemberTasks = (req, res) => {
    const memberId = req.userId;
    const companyId = req.companyId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const wantTeamTasks = req.query.teamTasks === "true"; // ✅ only if requested
    const together = req.query.together === "true";       // ✅ optional: return both

    const requestedTeamId = req.query.teamId || null;

    // Optional filters (apply to whichever mode we choose)
    const status = req.query.status || null;
    const projectId = req.query.projectId || null;

    // ------------------------
    // 1) DEFAULT: MY TASKS ONLY
    // ------------------------
    if (!wantTeamTasks && !together) {
        const filter = { company: companyId, assignedTo: memberId };
        if (status) filter.status = status;
        if (projectId) filter.project = projectId;
        if (requestedTeamId) filter.team = requestedTeamId; // (optional; still safe because it's my assigned tasks)

        const listPromise = Task.find(filter)
            .select("title status progress dueDate priority project team createdAt")
            .populate({ path: "project", select: "name company", match: { company: companyId } })
            .populate({ path: "team", select: "name company", match: { company: companyId } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const countPromise = Task.countDocuments(filter);

        return Promise.all([listPromise, countPromise])
            .then(([tasksRaw, total]) => {
                const tasks = tasksRaw.filter(t =>
                    (!t.project || String(t.project.company) === String(companyId)) &&
                    (!t.team || String(t.team.company) === String(companyId))
                );

                res.json({ page, limit, total, tasks });
            })
            .catch(err => {
                if (res.headersSent) return;
                res.status(500).json({ message: err.message });
            });
    }

    // ------------------------
    // 2) TEAM TASKS (only if requested) OR TOGETHER MODE
    // ------------------------
    Team.find({ company: companyId, members: memberId })
        .select("_id")
        .lean()
        .then(function (teams) {
            const teamIds = teams.map(t => t._id);

            // If teamId provided, must be one of his teams
            if (requestedTeamId) {
                const allowed = teamIds.some(id => String(id) === String(requestedTeamId));
                if (!allowed) {
                    return res.status(403).json({ message: "You are not a member of this team." });
                }
            }

            // team tasks filter (only his teams)
            const teamFilter = {
                company: companyId,
                team: requestedTeamId ? requestedTeamId : { $in: teamIds }
            };
            if (status) teamFilter.status = status;
            if (projectId) teamFilter.project = projectId;

            const teamListPromise = Task.find(teamFilter)
                .select("title status progress dueDate priority project team assignedTo createdAt")
                .populate({ path: "project", select: "name company", match: { company: companyId } })
                .populate({ path: "team", select: "name company", match: { company: companyId } })
                .populate({ path: "assignedTo", select: "name email company", match: { company: companyId } })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const teamCountPromise = Task.countDocuments(teamFilter);

            // If together=true, also fetch my tasks and return both arrays (but only when asked)
            if (together) {
                const myFilter = { company: companyId, assignedTo: memberId };
                if (status) myFilter.status = status;
                if (projectId) myFilter.project = projectId;
                if (requestedTeamId) myFilter.team = requestedTeamId;

                const myListPromise = Task.find(myFilter)
                    .select("title status progress dueDate priority project team createdAt")
                    .populate({ path: "project", select: "name company", match: { company: companyId } })
                    .populate({ path: "team", select: "name company", match: { company: companyId } })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean();

                const myCountPromise = Task.countDocuments(myFilter);

                return Promise.all([myListPromise, myCountPromise, teamListPromise, teamCountPromise])
                    .then(([myRaw, myTotal, teamRaw, teamTotal]) => {
                        const myTasks = myRaw.filter(t =>
                            (!t.project || String(t.project.company) === String(companyId)) &&
                            (!t.team || String(t.team.company) === String(companyId))
                        );

                        const teamTasks = teamRaw.filter(t =>
                            (!t.project || String(t.project.company) === String(companyId)) &&
                            (!t.team || String(t.team.company) === String(companyId)) &&
                            (!t.assignedTo || String(t.assignedTo.company) === String(companyId))
                        );

                        res.json({
                            page,
                            limit,
                            my: { total: myTotal, tasks: myTasks },
                            team: { total: teamTotal, tasks: teamTasks }
                        });
                    });
            }

            // Only team tasks requested
            return Promise.all([teamListPromise, teamCountPromise])
                .then(([teamRaw, total]) => {
                    const tasks = teamRaw.filter(t =>
                        (!t.project || String(t.project.company) === String(companyId)) &&
                        (!t.team || String(t.team.company) === String(companyId)) &&
                        (!t.assignedTo || String(t.assignedTo.company) === String(companyId))
                    );

                    res.json({ page, limit, total, tasks });
                });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};


// GET /member/teams
exports.getMemberTeams = (req, res) => {
    const memberId = req.userId;
    const companyId = req.companyId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {
        company: companyId,
        members: memberId
    };

    const listPromise = Team.find(filter)
        .select("name description project projectManager createdAt")
        .populate("project", "name status")
        .populate("projectManager", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const countPromise = Team.countDocuments(filter);

    Promise.all([listPromise, countPromise])
        .then(function ([teams, total]) {
            res.json({
                page,
                limit,
                total,
                teams
            });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

// GET /member/projects
exports.getMemberProjects = (req, res) => {
    const memberId = req.userId;
    const companyId = req.companyId;

    Team.find({ company: companyId, members: memberId })
        .select("project")
        .lean()
        .then(function (teams) {
            if (!teams.length) {
                // ✅ here we respond once and stop.
                res.json({ page: 1, limit: 0, total: 0, projects: [] });
                return null;
            }

            const projectIds = Array.from(
                new Set(
                    teams
                        .map(t => t.project)
                        .filter(Boolean)
                        .map(id => String(id))
                )
            );

            const page = Math.max(parseInt(req.query.page || "1", 10), 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
            const skip = (page - 1) * limit;

            const filter = {
                company: companyId,
                _id: { $in: projectIds }
            };

            if (req.query.status) filter.status = req.query.status;

            const listPromise = Project.find(filter)
                .select("name status dueDate startDate projectManager createdAt")
                .populate("projectManager", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const countPromise = Project.countDocuments(filter);

            return Promise.all([listPromise, countPromise])
                .then(function ([projects, total]) {
                    res.json({
                        page,
                        limit,
                        total,
                        projects
                    });
                    return true;
                });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};
