const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/user');
const Task = require('../models/task');
const Team = require('../models/team');
const Project = require('../models/project');
const { sendVerificationEmail } = require('../utils/mailer');
const { validationResult } = require('express-validator');


exports.createUser = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const companyId = req.userId;  // from isAuth
    const { name, email, password, role } = req.body;

    // role validation handled by express-validator, no need for manual check

    User.findOne({ email })
        .then(existingUser => {
            if (existingUser) return res.status(400).json({ message: 'Email already registered' });

            return bcrypt.hash(password, 12);
        })
        .then(hashedPassword => {
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

            return user.save()
                .then(user => sendVerificationEmail(user.email, emailToken))
                .then(() => res.status(201).json({ message: 'User created. Verification email sent.' }));
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.setProjectManager = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.body;  // member to promote
    const companyId = req.userId;  // company account ID from JWT

    User.findById(userId)
        .then(user => {
            if (!user) return res.status(404).json({ message: 'User not found' });

            // Prevent promotion of users from other companies
            if (user.company && user.company.toString() !== companyId.toString()) {
                return res.status(403).json({ message: 'Cannot promote user from another company' });
            }

            user.role = 'projectManager';
            user.company = companyId; // assign company if missing
            return user.save();
        })
        .then(updatedUser => res.status(200).json({
            message: 'User promoted to Project Manager',
            user: updatedUser
        }))
        .catch(err => {
            console.error(err);
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
            if (!user) return res.status(404).json({ message: 'User not found' });

            // Ownership check: either the user belongs to this company OR is a member/PM of this company
            if (user.company && user.company.toString() !== companyId.toString()) {
                return res.status(403).json({ message: 'Cannot remove user from another company' });
            }

            // Delete tasks assigned to the user
            return Task.deleteMany({ assignedTo: userId }).then(() => user);
        })
        .then(user => {
            // Remove user from all teams
            return Team.updateMany(
                { members: userId },
                { $pull: { members: userId } }
            ).then(() => user);
        })
        .then(user => {
            // Remove user's teams from projects if necessary
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
            // Finally, remove the user
            return User.findByIdAndDelete(userId); // safer than user.remove()
        })
        .then(() => res.status(200).json({ message: 'User deleted successfully along with their tasks and references' }))
        .catch(err => {
            console.error(err);
            res.status(500).json({ message: err.message });
        });
};

exports.getCompanyDashboard = (req, res, next) => {
    const companyId = req.userId; // company _id itself

    const projectsPromise = Project.find({ company: companyId });
    const teamsPromise = Team.find({ company: companyId })
        .populate('project projectManager members');
    const tasksPromise = Task.find({ company: companyId })
        .populate('team project assignedTo createdBy');
    const usersPromise = User.find({ company: companyId }).select('-password'); // no passwords in the dashboard

    Promise.all([projectsPromise, teamsPromise, tasksPromise, usersPromise])
        .then(([projects, teams, tasks, users]) => {
            res.status(200).json({
                message: 'Company dashboard data fetched successfully.',
                projects,
                teams,
                tasks,
                users
            });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

