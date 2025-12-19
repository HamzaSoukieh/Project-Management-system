const Team = require('../models/team');
const Task = require('../models/task');
const User = require('../models/user');
const Project = require('../models/project');

const { validationResult } = require('express-validator');

exports.getMyProfile = (req, res, next) => {
    const userId = req.userId;

    User.findById(userId)
        .select('name email role company team photo createdAt updatedAt')
        .populate('company', 'name email role')
        .populate('team', 'name members')
        .then(user => {
            if (!user) {
                res.status(404).json({ message: 'User not found' });
                return null; // ✅ stop chain
            }

            res.status(200).json({
                message: 'Profile data loaded',
                user
            });

            return true;
        })
        .catch(err => {
            console.error(err);
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.updateMyProfile = (req, res, next) => {
    const userId = req.userId;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.email) updates.email = req.body.email;

    if (req.file) {
        // Fix Windows slashes
        updates.photo = req.file.path.replace(/\\/g, '/');
    }

    User.findByIdAndUpdate(userId, updates, { new: true })
        .select('name email role company team photo createdAt updatedAt')
        .populate('company', 'name email role')
        .populate('team', 'name members')
        .then(updated => {
            if (!updated) {
                res.status(404).json({ message: 'User not found' });
                return null; // ✅ stop chain
            }

            res.status(200).json({
                message: 'Profile updated',
                user: updated
            });

            return true;
        })
        .catch(err => {
            console.error(err);
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};
