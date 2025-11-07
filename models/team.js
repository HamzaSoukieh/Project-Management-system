// models/team.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    projectManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    project: { type: Schema.Types.ObjectId, ref: 'Project' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Team', teamSchema);
