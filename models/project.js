// models/project.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const projectSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    status: {
        type: String,
        enum: ['active', 'completed', 'on hold'],
        default: 'active'
    },
    company: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    projectManager: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teams: [{ type: Schema.Types.ObjectId, ref: 'Team' }],
    tasks: [{ type: Schema.Types.ObjectId, ref: 'Task' }]
}, { timestamps: true });

module.exports = mongoose.model('Project', projectSchema);
