const mongoose = require("mongoose");
const { Schema } = mongoose;

const projectSchema = new Schema(
    {
        name: { type: String, required: true },
        description: String,
        status: { type: String, enum: ["active", "completed", "on hold"], default: "active" },

        company: { type: Schema.Types.ObjectId, ref: "User", required: true },
        projectManager: { type: Schema.Types.ObjectId, ref: "User", required: true },

        teams: [{ type: Schema.Types.ObjectId, ref: "Team" }],

        startDate: Date,
        dueDate: Date,
    },
    { timestamps: true }
);

module.exports = mongoose.model("Project", projectSchema);
