const mongoose = require("mongoose");
const { Schema } = mongoose;

const taskSchema = new Schema(
    {
        title: { type: String, required: true },
        description: String,

        project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
        team: { type: Schema.Types.ObjectId, ref: "Team", required: true },
        assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        company: { type: Schema.Types.ObjectId, ref: "User", required: true },

        status: {
            type: String,
            enum: ["pending", "in progress", "completed", "blocked"],
            default: "pending",
        },

        progress: { type: Number, min: 0, max: 100, default: 0 },

        startDate: Date,
        dueDate: Date,
        completedAt: Date,

        // Optional weighting
        estimatedHours: { type: Number, min: 0, default: 0 },
        priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    },
    { timestamps: true }
);

// keep status + progress consistent
taskSchema.pre("save", function (next) {
    if (this.status === "pending") {
        this.progress = 0;
        this.completedAt = undefined;
    }

    if (this.status === "in progress") {
        if (!this.startDate) this.startDate = new Date();
        if (this.progress === 0) this.progress = 1;
        this.completedAt = undefined;
    }

    if (this.status === "completed") {
        this.progress = 100;
        if (!this.startDate) this.startDate = new Date();
        if (!this.completedAt) this.completedAt = new Date();
    }

    if (this.status === "blocked") {
        if (!this.startDate && this.progress > 0) this.startDate = new Date();
        this.completedAt = undefined;
    }

    next();
});

module.exports = mongoose.model("Task", taskSchema);
