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

    const { name, description, startDate, dueDate } = req.body;
    const pmId = req.userId;
    const companyId = req.companyId;

    const project = new Project({
        name,
        description,
        startDate,
        dueDate,
        projectManager: pmId,
        company: companyId
    });


    project.save()
        .then(proj => res.status(201).json({ message: 'Project created successfully', project: proj }))
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

// Create a new team
exports.createTeam = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, members, projectName } = req.body;

    // extra check: duplicate member names
    const uniqueMembers = new Set(members);
    if (uniqueMembers.size !== members.length) {
        return res
            .status(400)
            .json({ message: "Duplicate members are not allowed in the same team." });
    }

    const pmId = req.userId;
    const companyId = req.companyId;

    let foundProject = null;

    // 1) Find project by NAME
    Project.findOne({
        company: companyId,
        projectManager: pmId,
        name: projectName
    })
        .then((project) => {
            if (!project) {
                res.status(403).json({ message: "Project not found or not yours." });
                return null;
            }

            foundProject = project;

            // 2) Find users by NAMES
            return User.find({
                company: companyId,
                name: { $in: members }
            }).select("_id name");
        })
        .then((foundUsers) => {
            if (!foundUsers) return null;

            if (foundUsers.length !== members.length) {
                res
                    .status(403)
                    .json({ message: "Some members do not belong to your company." });
                return null;
            }

            const memberIds = foundUsers.map((u) => u._id);

            // 3) Create team
            const team = new Team({
                name,
                members: memberIds,
                projectManager: pmId,
                company: companyId,
                project: foundProject._id
            });

            return team.save().then((savedTeam) => {
                foundProject.teams.push(savedTeam._id);
                return foundProject.save().then(() => savedTeam);
            });
        })
        .then((team) => {
            if (!team) return;
            res.status(201).json({
                message: "Team created successfully",
                team
            });
        })
        .catch((err) => {
            if (res.headersSent) return;

            // handle duplicate team name (unique index)
            if (err && err.code === 11000) {
                return res.status(400).json({
                    message: "Duplicate key error",
                    details: err.keyValue || err.message
                });
            }


            res.status(500).json({ message: err.message });
        });
};


exports.updateProjectStatus = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({
            errors: errors.array()
        });
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
                res.status(404).json({ message: 'Project not found or not yours.' });
                return null; // ✅ stop chain
            }

            project.status = status;
            return project.save();
        })
        .then(updatedProject => {
            if (!updatedProject) return; // ✅ already responded
            res.status(200).json({ message: 'Project status updated successfully', project: updatedProject });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

// Create a new task under a team
exports.createTask = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const {
        title,
        description,
        teamName,
        assignedToName,
        dueDate,
        estimatedHours,
        priority
    } = req.body;

    const pmId = req.userId;
    const companyId = req.companyId;

    let foundTeam = null;
    let foundUser = null;

    // 1) Find team by EXACT name
    Team.findOne({
        company: companyId,
        projectManager: pmId,
        name: teamName
    })
        .select("_id project members")
        .then((team) => {
            if (!team) {
                res.status(403).json({ message: "Team not found or not yours." });
                return null;
            }
            foundTeam = team;

            // 2) Find user by EXACT name
            return User.findOne({
                company: companyId,
                name: assignedToName
            }).select("_id");
        })
        .then((user) => {
            if (!user) {
                if (!res.headersSent)
                    res.status(404).json({ message: "Member not found." });
                return null;
            }

            foundUser = user;

            // 3) Check member is in team
            const isMember = foundTeam.members.some(
                (m) => String(m) === String(foundUser._id)
            );

            if (!isMember) {
                res
                    .status(403)
                    .json({ message: "Assigned member is not in this team." });
                return null;
            }

            // 4) Create task
            const task = new Task({
                title,
                description,
                team: foundTeam._id,
                project: foundTeam.project,
                assignedTo: foundUser._id,
                createdBy: pmId,
                company: companyId,
                dueDate,
                estimatedHours: typeof estimatedHours === "number" ? estimatedHours : 0,
                priority: ["low", "medium", "high"].includes(priority)
                    ? priority
                    : "medium",
                status: "pending",
                progress: 0
            });

            return task.save();
        })
        .then((task) => {
            if (!task) return;
            res.status(201).json({
                message: "Task created successfully",
                task
            });
        })
        .catch((err) => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};



exports.updateTaskByPM = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
        const { taskId } = req.params;
        const companyId = req.companyId;
        const pmId = req.userId;

        const { assignedToName } = req.body;

        // 1) Load task (company scoped)
        const task = await Task.findOne({ _id: taskId, company: companyId });
        if (!task) {
            return res.status(404).json({ message: "Task not found." });
        }

        // 2) PM must manage the task's team
        const isPmOfTeam = await Team.exists({
            _id: task.team,
            company: companyId,
            projectManager: pmId
        });

        if (!isPmOfTeam) {
            return res.status(403).json({ message: "Not allowed." });
        }

        // 3) If assignedToName is provided → resolve by NAME
        if (assignedToName !== undefined) {
            const user = await User.findOne({
                name: assignedToName,
                company: companyId
            }).select("_id");

            if (!user) {
                return res.status(404).json({ message: "Assigned user not found." });
            }

            // ensure user is in the same team
            const isMember = await Team.exists({
                _id: task.team,
                members: user._id
            });

            if (!isMember) {
                return res
                    .status(403)
                    .json({ message: "Assigned user is not in this team." });
            }

            task.assignedTo = user._id;
        }

        // 4) Update allowed fields only
        const allowed = [
            "title",
            "description",
            "dueDate",
            "status",
            "progress",
            "estimatedHours",
            "priority"
        ];

        for (const key of allowed) {
            if (req.body[key] !== undefined) {
                task[key] = req.body[key];
            }
        }

        await task.save();

        return res.status(200).json({
            message: "Task updated successfully",
            task
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};




exports.editTeam = (req, res) => {
    const { teamId } = req.params;
    const { newName, membersToAdd, membersToRemove } = req.body;

    const pmId = req.userId;
    const companyId = req.companyId;

    let foundTeam = null;

    Team.findOne({
        _id: teamId,
        projectManager: pmId,
        company: companyId
    })
        .then((team) => {
            if (!team) {
                res.status(404).json({ message: "Team not found or not yours." });
                return null;
            }

            foundTeam = team;

            // Rename team
            if (newName) {
                foundTeam.name = newName;
            }

            const addArr = Array.isArray(membersToAdd) ? membersToAdd : [];
            const removeArr = Array.isArray(membersToRemove) ? membersToRemove : [];

            // ✅ NOTHING to add/remove → just save and STOP
            if (addArr.length === 0 && removeArr.length === 0) {
                return foundTeam.save().then((saved) => {
                    res.status(200).json({
                        message: "Team updated successfully.",
                        team: saved
                    });
                    return null; // ⛔ stop chain
                });
            }

            // Fetch users by NAME
            return User.find({
                company: companyId,
                name: { $in: [...addArr, ...removeArr] }
            }).select("_id name");
        })
        .then((users) => {
            if (!users) return null; // chain already handled

            const addArr = Array.isArray(membersToAdd) ? membersToAdd : [];
            const removeArr = Array.isArray(membersToRemove) ? membersToRemove : [];

            const userMap = new Map(users.map((u) => [u.name, u]));

            // Validate names
            const missingAdd = addArr.filter((n) => !userMap.has(n));
            const missingRemove = removeArr.filter((n) => !userMap.has(n));

            if (missingAdd.length || missingRemove.length) {
                res.status(404).json({
                    message: "Some member names were not found in your company.",
                    missingAdd,
                    missingRemove
                });
                return null;
            }

            // Add members
            addArr.forEach((name) => {
                const user = userMap.get(name);
                const exists = foundTeam.members.some(
                    (m) => String(m) === String(user._id)
                );
                if (!exists) foundTeam.members.push(user._id);
            });

            // Remove members
            const removeIds = removeArr.map((n) =>
                String(userMap.get(n)._id)
            );

            if (removeIds.length > 0) {
                foundTeam.members = foundTeam.members.filter(
                    (m) => !removeIds.includes(String(m))
                );

                return Task.deleteMany({
                    assignedTo: { $in: removeIds },
                    team: foundTeam._id,
                    company: companyId
                }).then(() => foundTeam.save());
            }

            return foundTeam.save();
        })
        .then((updatedTeam) => {
            if (!updatedTeam) return;
            res.status(200).json({
                message: "Team updated successfully.",
                team: updatedTeam
            });
        })
        .catch((err) => {
            if (res.headersSent) return;

            if (err.code === 11000) {
                return res
                    .status(400)
                    .json({ message: "Team name already exists in this company." });
            }

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
                res.status(404).json({
                    message: 'Project not found or not under your management.'
                });
                return null; // ✅ stop chain
            }

            project.status = 'completed';
            return project.save();
        })
        .then(project => {
            if (!project) return null; // ✅ already responded
            closedProject = project;

            // Mark all tasks completed
            return Task.updateMany(
                { project: projectId },
                { $set: { status: 'completed' } }
            ).then(() => project); // ✅ pass project along
        })
        .then(project => {
            if (!project) return null;

            // find company owner (companyId is the user who owns the company)
            return User.findById(project.company);
        })
        .then(companyUser => {
            if (!companyUser) {
                res.status(500).json({
                    message: 'Project closed but company owner not found.'
                });
                return null; // ✅ stop chain
            }

            // send closure email
            return sendProjectClosedEmail(
                companyUser.email,
                closedProject.name,
                pmUser.name
            );
        })
        .then(result => {
            if (!result && res.headersSent) return;
            // If email send returns void/undefined, that's fine—still respond once.
            res.status(200).json({
                message: 'Project closed, tasks completed, company notified.',
                project: closedProject
            });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getPMDashboard = (req, res) => {
    const pmId = req.userId;
    const companyId = req.companyId;

    const now = new Date();
    // Due soon window: 3 days (best practice for PMs)
    const dueSoonDays = 3;
    const soon = new Date(now);
    soon.setDate(soon.getDate() + dueSoonDays);

    Project.find({ projectManager: pmId, company: companyId })
        .select("name status dueDate createdAt")
        .lean()
        .then(function (projects) {
            const projectIds = projects.map((p) => p._id);

            // If PM manages no projects, return clean empty dashboard
            if (projectIds.length === 0) {
                return res.json({
                    summary: {
                        managedProjects: 0,
                        totalTasks: 0,
                        openTasks: 0,
                        overdueCount: 0,
                        dueSoonCount: 0,
                    },
                    projects: [],
                    overdueTasks: [],
                    dueSoonTasks: [],
                    dueSoonWindowDays: dueSoonDays,
                });
            }

            const base = { company: companyId, project: { $in: projectIds } };
            const openFilter = { ...base, status: { $ne: "completed" } };

            const summaryPromise = Promise.all([
                Task.countDocuments(base),
                Task.countDocuments(openFilter),
                Task.countDocuments({
                    ...openFilter,
                    dueDate: { $lt: now },
                }),
                Task.countDocuments({
                    ...openFilter,
                    // due soon means: dueDate exists and is between now and soon
                    dueDate: { $gte: now, $lte: soon },
                }),
            ]);

            const overdueTasksPromise = Task.find({
                ...openFilter,
                dueDate: { $lt: now },
            })
                .select("title status dueDate progress project assignedTo priority")
                .populate("project", "name")
                .populate("assignedTo", "name email")
                .sort({ dueDate: 1 })
                .limit(10)
                .lean();

            const dueSoonTasksPromise = Task.find({
                ...openFilter,
                dueDate: { $gte: now, $lte: soon },
            })
                .select("title status dueDate progress project assignedTo priority")
                .populate("project", "name")
                .populate("assignedTo", "name email")
                .sort({ dueDate: 1 })
                .limit(10)
                .lean();

            return Promise.all([summaryPromise, overdueTasksPromise, dueSoonTasksPromise]).then(
                function ([summaryCounts, overdueTasks, dueSoonTasks]) {
                    const [totalTasks, openTasks, overdueCount, dueSoonCount] = summaryCounts;

                    res.json({
                        summary: {
                            managedProjects: projects.length,
                            totalTasks,
                            openTasks,
                            overdueCount,
                            dueSoonCount,
                        },
                        projects: projects.slice(0, 10),
                        overdueTasks,
                        dueSoonTasks,
                        dueSoonWindowDays: dueSoonDays,
                    });
                }
            );
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};



exports.getPMProjects = (req, res) => {
    const pmId = req.userId;
    const companyId = req.companyId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    // Base scope: PM-managed projects
    const filter = { company: companyId, projectManager: pmId };

    // Status-based filtering ONLY (explicit)
    if (req.query.status) {
        filter.status = req.query.status;
    }

    const listPromise = Project.find(filter)
        .select("name description  status dueDate startDate")
        // Sensible default: newest projects first
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const countPromise = Project.countDocuments(filter);

    Promise.all([listPromise, countPromise])
        .then(function ([projects, total]) {
            res.json({
                page,
                limit,
                total,
                projects,
            });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};



exports.getPMTeams = (req, res) => {
    const pmId = req.userId;
    const companyId = req.companyId;

    Project.find({ company: companyId, projectManager: pmId })
        .select("_id")
        .lean()
        .then(function (projects) {
            const projectIds = projects.map(p => p._id);

            const page = Math.max(parseInt(req.query.page || "1", 10), 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
            const skip = (page - 1) * limit;

            const filter = { company: companyId, project: { $in: projectIds } };
            if (req.query.projectId) filter.project = req.query.projectId;

            const listPromise = Team.find(filter)
                .select("name description project members createdAt")
                .populate("project", "name status")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const countPromise = Team.countDocuments(filter);

            return Promise.all([listPromise, countPromise])
                .then(function ([teams, total]) {
                    res.json({ page, limit, total, teams });
                });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getPMTasks = (req, res) => {
    const pmId = req.userId;
    const companyId = req.companyId;

    Project.find({ company: companyId, projectManager: pmId })
        .select("_id")
        .lean()
        .then(function (projects) {
            const projectIds = projects.map((p) => p._id);

            const page = Math.max(parseInt(req.query.page || "1", 10), 1);
            const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
            const skip = (page - 1) * limit;

            // Base scope: only tasks in PM-managed projects
            const filter = { company: companyId, project: { $in: projectIds } };

            // Optional filters (but still enforce PM scope)
            if (req.query.projectId) {
                const allowed = projectIds.some((id) => String(id) === String(req.query.projectId));
                if (!allowed) return res.json({ page, limit, total: 0, tasks: [] });
                filter.project = req.query.projectId;
            }
            if (req.query.teamId) filter.team = req.query.teamId;
            if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

            // Default: unfinished tasks unless a specific status is requested
            if (req.query.status) {
                filter.status = req.query.status;
            } else {
                filter.status = { $ne: "completed" };
            }

            const now = new Date();
            const soon = new Date(now);
            soon.setDate(soon.getDate() + 3); // due soon window = 3 days

            // Mutually exclusive "overdue" vs "dueSoon"
            const overdue = req.query.overdue === "true";
            const dueSoon = req.query.dueSoon === "true";

            if (overdue && dueSoon) {
                return res.status(400).json({
                    message: "Choose either overdue=true or dueSoon=true (not both).",
                });
            }

            if (overdue) {
                // Overdue: strictly before now, unfinished
                filter.dueDate = { $lt: now };
                filter.status = { $ne: "completed" };
            }

            if (dueSoon) {
                // Due soon: between now and soon, unfinished (explicitly excludes overdue)
                filter.dueDate = { $gte: now, $lte: soon };
                filter.status = { $ne: "completed" };
            }

            if (req.query.blocked === "true") {
                // Blocked is a clear triage filter; keep it simple
                filter.status = "blocked";
            }

            const listPromise = Task.find(filter)
                .select("title status progress dueDate priority estimatedHours project team assignedTo createdAt")
                .populate("project", "name")
                .populate("assignedTo", "name email")
                // Best-practice: triage sort for PMs
                .sort({ dueDate: 1, priority: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            const countPromise = Task.countDocuments(filter);

            return Promise.all([listPromise, countPromise]).then(function ([tasks, total]) {
                res.json({
                    page,
                    limit,
                    total,
                    tasks,
                    meta: {
                        dueSoonWindowDays: 3,
                    },
                });
            });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};




exports.getPMMembers = (req, res) => {
    const pmId = req.userId;
    const companyId = req.companyId;

    Project.find({ company: companyId, projectManager: pmId })
        .select("_id")
        .lean()
        .then(function (projects) {
            const projectIds = projects.map(p => p._id);

            return Team.find({ company: companyId, project: { $in: projectIds } })
                .select("members")
                .lean()
                .then(function (teams) {
                    const memberIds = Array.from(
                        new Set(
                            teams
                                .reduce(function (acc, t) {
                                    return acc.concat(t.members || []);
                                }, [])
                                .map(function (id) {
                                    return String(id);
                                })
                        )
                    );

                    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
                    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
                    const skip = (page - 1) * limit;

                    const filter = { company: companyId, _id: { $in: memberIds } };
                    if (req.query.role) filter.role = req.query.role;

                    const listPromise = User.find(filter)
                        .select("name email role createdAt")
                        .sort({ createdAt: -1 })
                        .skip(skip)
                        .limit(limit)
                        .lean();

                    const countPromise = User.countDocuments(filter);

                    return Promise.all([listPromise, countPromise])
                        .then(function ([members, total]) {
                            res.json({ page, limit, total, members });
                        });
                });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getPMUsers = (req, res) => {
    if (req.userRole !== "projectManager") {
        return res.status(403).json({ message: "Access denied" });
    }

    const companyId = req.companyId;
    const pmId = req.userId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = {
        company: companyId,
        _id: { $ne: pmId }
    };

    const usersPromise = User.find(filter)
        .select("_id name email role team createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const countPromise = User.countDocuments(filter);

    Promise.all([usersPromise, countPromise])
        .then(([users, total]) => {
            res.json({
                page,
                limit,
                total,
                users
            });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

