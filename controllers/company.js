const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user');
const Task = require('../models/task');
const Team = require('../models/team');
const Company = require('../models/company');
const Project = require('../models/project');
const { sendVerificationEmail } = require('../utils/mailer');
const { validationResult } = require('express-validator');

exports.createCompany = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).json({ errors: errors.array() });
    }

    const userId = req.userId;
    const { name, description } = req.body;

    User.findById(userId)
        .then(user => {
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return null; // ✅ stop chain
            }

            if (user.company) {
                res.status(400).json({ message: 'Company already created' });
                return null; // ✅ stop chain
            }

            const company = new Company({
                name,
                description,
                owner: userId
            });

            return company.save().then(savedCompany => {
                user.company = savedCompany._id;
                return user.save().then(() => savedCompany);
            });
        })
        .then(company => {
            if (!company) return; // ✅ already responded
            res.status(201).json({
                message: 'Company created successfully',
                company
            });
        })
        .catch(err => {
            console.error(err);
            if (res.headersSent) return;
            res.status(500).json({ message: 'Something went wrong', error: err.message });
        });
};

exports.createUser = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const companyId = req.userId; // from isAuth
    const { name, email, password, role } = req.body;

    User.findOne({ email })
        .then(existingUser => {
            if (existingUser) {
                res.status(400).json({ message: 'Email already registered' });
                return null; // ✅ stop chain
            }
            return bcrypt.hash(password, 12);
        })
        .then(hashedPassword => {
            if (!hashedPassword) return null; // ✅ already responded above

            const emailToken = crypto.randomBytes(32).toString('hex');
            const emailTokenExpires = Date.now() + 3600000; // 1 hour

            const user = new User({
                name,
                email,
                password: hashedPassword,
                role: role || 'member',
                company: companyId,
                isVerified: false,
                emailToken,
                emailTokenExpires
            });

            // IMPORTANT: don't send response inside here; return something and respond in the next .then
            return user.save()
                .then(saved => sendVerificationEmail(saved.email, emailToken).then(() => saved));
        })
        .then(savedUser => {
            if (!savedUser) return; // ✅ already responded
            res.status(201).json({ message: 'User created. Verification email sent.' });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.setProjectManager = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;  // member to promote
    const companyId = req.userId; // company account ID from JWT

    User.findById(userId)
        .then(user => {
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return null; // ✅ stop chain
            }

            // Prevent promotion of users from other companies
            if (!user.company || user.company.toString() !== companyId.toString()) {
                res.status(403).json({ message: 'Cannot promote a user without a company or from another company' });
                return null; // ✅ stop chain
            }

            user.role = 'projectManager';
            return user.save();
        })
        .then(updatedUser => {
            if (!updatedUser) return; // ✅ already responded
            res.status(200).json({
                message: 'User promoted to Project Manager',
                user: updatedUser
            });
        })
        .catch(err => {
            console.error(err);
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.deleteUser = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const companyId = req.userId; // company account _id from JWT
    const { userId } = req.body;

    User.findById(userId)
        .then(user => {
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return null; // ✅ stop chain
            }

            // Ownership check: user must belong to this company
            if (user.company && user.company.toString() !== companyId.toString()) {
                res.status(403).json({ message: 'Cannot remove user from another company' });
                return null; // ✅ stop chain
            }

            // Delete tasks assigned to the user
            return Task.deleteMany({ assignedTo: userId }).then(() => user);
        })
        .then(user => {
            if (!user) return null; // ✅ already responded

            // Remove user from all teams
            return Team.updateMany(
                { members: userId },
                { $pull: { members: userId } }
            ).then(() => user);
        })
        .then(user => {
            if (!user) return null;

            // NOTE: after updateMany above, user might no longer be in teams.
            // Keeping your logic but making it safe:
            return Team.find({ members: userId }).distinct('_id')
                .then(teamIds => {
                    if (teamIds.length === 0) return user;

                    return Project.updateMany(
                        { teams: { $in: teamIds } },
                        { $pull: { teams: { $in: teamIds } } }
                    ).then(() => user);
                });
        })
        .then(user => {
            if (!user) return null;

            // Finally, remove the user
            return User.findByIdAndDelete(userId);
        })
        .then(deleted => {
            if (!deleted) return; // ✅ if we stopped earlier
            res.status(200).json({ message: 'User deleted successfully along with their tasks and references' });
        })
        .catch(err => {
            console.error(err);
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

// companyController.deleteProjectAfterClose
exports.deleteProjectAfterClose = (req, res, next) => {
    const { projectId } = req.params;
    const companyId = req.userId; // company is the owner

    // Company can only delete projects that belong to them
    Project.findOne({ _id: projectId, company: companyId })
        .then(project => {
            if (!project) {
                res.status(404).json({ message: 'Project not found or not yours.' });
                return null; // ✅ stop chain
            }

            // Only allow deletion if PM closed it
            if (project.status !== 'completed') {
                res.status(403).json({
                    message: 'Project must be closed by the project manager before deletion.'
                });
                return null; // ✅ stop chain
            }

            // Delete all related teams and tasks
            return Promise.all([
                Team.deleteMany({ project: projectId }),
                Task.deleteMany({ project: projectId }),
                Project.findByIdAndDelete(projectId)
            ]);
        })
        .then(result => {
            if (!result) return; // ✅ already responded
            res.status(200).json({
                message: 'Project, teams, and tasks deleted successfully by company.'
            });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getCompanyDashboard = async (req, res) => {
    try {
        const companyId = req.userId;
        const now = new Date();
        const soon = new Date();
        soon.setDate(soon.getDate() + 7); // next 7 days

        const [
            totalProjects,
            activeProjects,
            totalTeams,
            totalUsers,
            totalTasks,
            overdueTasksCount,
            dueSoonCount,
            latestProjects,
            overdueTasks,
            dueSoonTasks,
        ] = await Promise.all([
            Project.countDocuments({ company: companyId }),
            Project.countDocuments({ company: companyId, status: "active" }),
            Team.countDocuments({ company: companyId }),
            User.countDocuments({ company: companyId }),
            Task.countDocuments({ company: companyId }),
            Task.countDocuments({ company: companyId, dueDate: { $lt: now }, status: { $ne: "completed" } }),
            Task.countDocuments({
                company: companyId,
                dueDate: { $gte: now, $lte: soon },
                status: { $ne: "completed" },
            }),
            Project.find({ company: companyId })
                .select("name status dueDate createdAt")
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
            Task.find({ company: companyId, dueDate: { $lt: now }, status: { $ne: "completed" } })
                .select("title status dueDate progress project assignedTo")
                .populate("project", "name")
                .populate("assignedTo", "name email")
                .sort({ dueDate: 1 })
                .limit(10)
                .lean(),
            Task.find({ company: companyId, dueDate: { $gte: now, $lte: soon }, status: { $ne: "completed" } })
                .select("title status dueDate progress project assignedTo")
                .populate("project", "name")
                .populate("assignedTo", "name email")
                .sort({ dueDate: 1 })
                .limit(10)
                .lean(),
        ]);

        res.json({
            summary: {
                totalProjects,
                activeProjects,
                totalTeams,
                totalUsers,
                totalTasks,
                overdueTasksCount,
                dueSoonCount,
            },
            latestProjects,
            overdueTasks,
            dueSoonTasks,
        });
    } catch (err) {
        if (res.headersSent) return;
        res.status(500).json({ message: err.message });
    }
};


exports.getCompanyProjects = (req, res) => {
    const companyId = req.userId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = { company: companyId };

    const active = req.query.active === "true";
    const onHold = req.query.onHold === "true" || req.query.onhold === "true";
    const completed = req.query.completed === "true";

    const flags = [active, onHold, completed].filter(Boolean);
    if (flags.length > 1) {
        return res.status(400).json({
            message: "Choose only one of: active=true, onHold=true, completed=true",
        });
    }

    if (completed) filter.status = "completed";
    else if (onHold) filter.status = "on hold";
    else if (active) filter.status = "active";

    const listPromise = Project.find(filter)
        .select("name description status dueDate startDate projectManager company")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const countPromise = Project.countDocuments(filter);

    Promise.all([listPromise, countPromise])
        .then(([projects, total]) => {
            res.json({ page, limit, total, projects });
        })
        .catch((err) => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};



exports.getCompanyTasks = (req, res) => {
    const companyId = req.userId; // company account id

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    // ✅ Base scope: ONLY this company's tasks
    const filter = { company: companyId };

    // Optional filters (still company-scoped)
    if (req.query.projectId) filter.project = req.query.projectId;
    if (req.query.teamId) filter.team = req.query.teamId;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

    // Default: unfinished unless explicitly asked for status
    if (req.query.status) {
        filter.status = req.query.status;
    } else {
        filter.status = { $ne: "completed" };
    }

    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 3); // due soon window = 3 days

    // Mutually exclusive filters
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
        // Due soon: between now and soon, unfinished (excludes overdue)
        filter.dueDate = { $gte: now, $lte: soon };
        filter.status = { $ne: "completed" };
    }

    if (req.query.blocked === "true") {
        // Blocked is a clear triage filter
        filter.status = "blocked";
    }

    const listPromise = Task.find(filter)
        .select("title status progress dueDate priority estimatedHours project team assignedTo createdAt")
        .populate({
            path: "project",
            select: "name status company",
            match: { company: companyId } // ✅ prevent cross-company populate
        })
        .populate({
            path: "team",
            select: "name company",
            match: { company: companyId }
        })
        .populate({
            path: "assignedTo",
            select: "name email company",
            match: { company: companyId }
        })
        // PM-style triage sort
        .sort({ dueDate: 1, priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    const countPromise = Task.countDocuments(filter);

    return Promise.all([listPromise, countPromise])
        .then(function ([tasks, total]) {
            // 🧼 extra safety: remove tasks where populate got nulled due to match
            const safeTasks = tasks.filter(function (t) {
                const okProject = !t.project || String(t.project.company) === String(companyId);
                const okTeam = !t.team || String(t.team.company) === String(companyId);
                const okUser = !t.assignedTo || String(t.assignedTo.company) === String(companyId);
                return okProject && okTeam && okUser;
            });

            res.json({
                page,
                limit,
                total,
                tasks: safeTasks,
                meta: {
                    dueSoonWindowDays: 3,
                },
            });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getCompanyUsers = (req, res) => {
    const companyId = req.userId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const filter = { company: companyId };

    const usersPromise = User.find(filter)
        .select("_id name email role team isVerified createdAt")
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

