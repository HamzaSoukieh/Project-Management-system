// models/team.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const teamSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },
        description: String,

        members: [{ type: Schema.Types.ObjectId, ref: "User" }],

        projectManager: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        project: { type: Schema.Types.ObjectId, ref: "Project" },

        company: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

/**
 * Unique team name PER company (exact match)
 */
teamSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Team', teamSchema);
