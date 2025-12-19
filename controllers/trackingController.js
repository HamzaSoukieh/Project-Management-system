const Project = require("../models/project");
const Task = require("../models/task");

exports.getPMProjectsTracking = (req, res) => {
    const pmId = req.userId;
    const companyId = req.companyId;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const now = new Date();

    Project.aggregate([
        { $match: { company: companyId, projectManager: pmId } },

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        {
            $lookup: {
                from: "tasks",
                let: { pid: "$_id", cid: "$company" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$project", "$$pid"] },
                                    { $eq: ["$company", "$$cid"] }
                                ]
                            }
                        }
                    },
                    { $project: { status: 1, progress: 1, dueDate: 1, estimatedHours: 1 } }
                ],
                as: "tasks"
            }
        },

        {
            $addFields: {
                totalTasks: { $size: "$tasks" },

                completedTasks: {
                    $size: {
                        $filter: {
                            input: "$tasks",
                            as: "t",
                            cond: { $eq: ["$$t.status", "completed"] }
                        }
                    }
                },

                overdueTasks: {
                    $size: {
                        $filter: {
                            input: "$tasks",
                            as: "t",
                            cond: {
                                $and: [
                                    { $ne: ["$$t.status", "completed"] },
                                    { $ne: ["$$t.dueDate", null] },
                                    { $lt: ["$$t.dueDate", now] }
                                ]
                            }
                        }
                    }
                },

                // ✅ avgProgress but treat completed as 100 even if DB progress is 0
                avgProgress: {
                    $cond: [
                        { $eq: [{ $size: "$tasks" }, 0] },
                        0,
                        {
                            $round: [
                                {
                                    $avg: {
                                        $map: {
                                            input: "$tasks",
                                            as: "t",
                                            in: {
                                                $cond: [
                                                    { $eq: ["$$t.status", "completed"] },
                                                    100,
                                                    { $ifNull: ["$$t.progress", 0] }
                                                ]
                                            }
                                        }
                                    }
                                },
                                0
                            ]
                        }
                    ]
                },

                totalEst: {
                    $sum: {
                        $map: {
                            input: "$tasks",
                            as: "t",
                            in: { $ifNull: ["$$t.estimatedHours", 0] }
                        }
                    }
                },

                // ✅ weightedProgress also treats completed as 100
                weightedProgress: {
                    $let: {
                        vars: {
                            totalEst: {
                                $sum: {
                                    $map: {
                                        input: "$tasks",
                                        as: "t",
                                        in: { $ifNull: ["$$t.estimatedHours", 0] }
                                    }
                                }
                            },
                            weightedSum: {
                                $sum: {
                                    $map: {
                                        input: "$tasks",
                                        as: "t",
                                        in: {
                                            $multiply: [
                                                {
                                                    $cond: [
                                                        { $eq: ["$$t.status", "completed"] },
                                                        100,
                                                        { $ifNull: ["$$t.progress", 0] }
                                                    ]
                                                },
                                                { $ifNull: ["$$t.estimatedHours", 0] }
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        in: {
                            $cond: [
                                { $eq: ["$$totalEst", 0] },
                                "$avgProgress",
                                { $round: [{ $divide: ["$$weightedSum", "$$totalEst"] }, 0] }
                            ]
                        }
                    }
                },

                // ✅ one clear percent for frontend
                progressPercent: {
                    $cond: [
                        { $gt: ["$totalEst", 0] },
                        "$weightedProgress",
                        "$avgProgress"
                    ]
                }
            }
        },

        {
            $project: {
                _id: 0,
                projectId: "$_id",
                name: 1,
                status: 1,
                projectDueDate: { $ifNull: ["$dueDate", null] },

                totalTasks: 1,
                completedTasks: 1,
                overdueTasks: 1,

                progressPercent: 1,   // ✅ use this in UI
                avgProgress: 1,
                weightedProgress: 1
            }
        }
    ])
        .then(function (tracking) {
            return Project.countDocuments({ company: companyId, projectManager: pmId })
                .then(function (totalProjects) {
                    res.json({
                        page,
                        limit,
                        totalProjects,
                        tracking
                    });
                });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getCompanyProjectsTracking = (req, res) => {
    const companyId = req.userId; // company account id (based on your controllers)

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const now = new Date();

    Project.aggregate([
        { $match: { company: companyId } },

        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },

        {
            $lookup: {
                from: "tasks",
                let: { pid: "$_id", cid: "$company" },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ["$project", "$$pid"] },
                                    { $eq: ["$company", "$$cid"] }
                                ]
                            }
                        }
                    },
                    { $project: { status: 1, progress: 1, dueDate: 1, estimatedHours: 1 } }
                ],
                as: "tasks"
            }
        },

        {
            $addFields: {
                totalTasks: { $size: "$tasks" },

                completedTasks: {
                    $size: {
                        $filter: {
                            input: "$tasks",
                            as: "t",
                            cond: { $eq: ["$$t.status", "completed"] }
                        }
                    }
                },

                overdueTasks: {
                    $size: {
                        $filter: {
                            input: "$tasks",
                            as: "t",
                            cond: {
                                $and: [
                                    { $ne: ["$$t.status", "completed"] },
                                    { $ne: ["$$t.dueDate", null] },
                                    { $lt: ["$$t.dueDate", now] }
                                ]
                            }
                        }
                    }
                },

                // ✅ average progress (completed counts as 100)
                avgProgress: {
                    $cond: [
                        { $eq: [{ $size: "$tasks" }, 0] },
                        0,
                        {
                            $round: [
                                {
                                    $avg: {
                                        $map: {
                                            input: "$tasks",
                                            as: "t",
                                            in: {
                                                $cond: [
                                                    { $eq: ["$$t.status", "completed"] },
                                                    100,
                                                    { $ifNull: ["$$t.progress", 0] }
                                                ]
                                            }
                                        }
                                    }
                                },
                                0
                            ]
                        }
                    ]
                },

                totalEst: {
                    $sum: {
                        $map: {
                            input: "$tasks",
                            as: "t",
                            in: { $ifNull: ["$$t.estimatedHours", 0] }
                        }
                    }
                },

                // ✅ weighted progress (completed counts as 100)
                weightedProgress: {
                    $let: {
                        vars: {
                            totalEst: {
                                $sum: {
                                    $map: {
                                        input: "$tasks",
                                        as: "t",
                                        in: { $ifNull: ["$$t.estimatedHours", 0] }
                                    }
                                }
                            },
                            weightedSum: {
                                $sum: {
                                    $map: {
                                        input: "$tasks",
                                        as: "t",
                                        in: {
                                            $multiply: [
                                                {
                                                    $cond: [
                                                        { $eq: ["$$t.status", "completed"] },
                                                        100,
                                                        { $ifNull: ["$$t.progress", 0] }
                                                    ]
                                                },
                                                { $ifNull: ["$$t.estimatedHours", 0] }
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        in: {
                            $cond: [
                                { $eq: ["$$totalEst", 0] },
                                "$avgProgress",
                                { $round: [{ $divide: ["$$weightedSum", "$$totalEst"] }, 0] }
                            ]
                        }
                    }
                },

                // ✅ one clear percent for frontend
                progressPercent: {
                    $cond: [
                        { $gt: ["$totalEst", 0] },
                        "$weightedProgress",
                        "$avgProgress"
                    ]
                }
            }
        },

        {
            $project: {
                _id: 0,
                projectId: "$_id",
                name: 1,
                status: 1,
                projectDueDate: { $ifNull: ["$dueDate", null] },

                totalTasks: 1,
                completedTasks: 1,
                overdueTasks: 1,

                progressPercent: 1,
                avgProgress: 1,
                weightedProgress: 1
            }
        }
    ])
        .then(function (tracking) {
            return Project.countDocuments({ company: companyId })
                .then(function (totalProjects) {
                    res.json({
                        page,
                        limit,
                        totalProjects,
                        tracking
                    });
                });
        })
        .catch(function (err) {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};
