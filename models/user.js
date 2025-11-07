// models/user.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['company', 'projectManager', 'member'], default: 'member' },
    company: { type: Schema.Types.ObjectId, ref: 'User' },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    isVerified: { type: Boolean, default: false },
    verificationToken: { type: String },
    emailTokenExpires: Date,
    emailToken: String,
    resetToken: { type: String },
    resetTokenExpiration: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
