const Team = require('../models/team');
const Task = require('../models/task');
const User = require('../models/user');
const Project = require('../models/project');

exports.getMyProfile = (req, res, next) => {
    const userId = req.userId;

    User.findById(userId)
        .select('name email role company team createdAt updatedAt')
        .populate('company', 'name email role')
        .populate('team', 'name members')
        .then(user => {
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.status(200).json({
                message: 'Profile data loaded',
                user
            });
        })
        .catch(err => {
            console.error(err);
            res.status(500).json({ message: err.message });
        });
};
