// models/user.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema(
    {
        name: { type: String, required: true, trim: true },

        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        password: { type: String, required: true },

        role: {
            type: String,
            enum: ["company", "projectManager", "member"],
            default: "member"
        },

        company: { type: Schema.Types.ObjectId, ref: "User" },
        team: { type: mongoose.Schema.Types.ObjectId, ref: "Team" },

        isVerified: { type: Boolean, default: false },
        verificationToken: { type: String },
        emailTokenExpires: Date,
        emailToken: String,

        resetToken: { type: String },
        resetTokenExpiration: { type: Date },

        photo: { type: String, default: null }
    },
    { timestamps: true }
);

/**
 * Unique user name PER company (exact match)
 */
userSchema.index({ company: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);