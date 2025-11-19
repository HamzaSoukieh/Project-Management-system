const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,

    fileUrl: String,            // if you store the file on disk / cloud
    fileType: String,

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Report', reportSchema);
