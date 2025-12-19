const { validationResult } = require('express-validator');
const Report = require('../models/report');
const Project = require('../models/project');
const Team = require('../models/team');
const fs = require('fs');
const path = require('path');

exports.createReport = (req, res, next) => {
    const { title, description, teamId, projectId } = req.body;
    const memberId = req.userId;
    const companyId = req.companyId;

    let fileUrl = null;
    let fileType = null;

    if (req.file) {
        fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        fileType = req.file.mimetype;
    }

    const report = new Report({
        title,
        description,
        fileUrl,
        fileType,
        createdBy: memberId,
        team: teamId,
        project: projectId,
        company: companyId
    });

    report.save()
        .then(newReport => {
            res.status(201).json({
                message: 'Report created successfully',
                report: newReport
            });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.deleteReportByPm = (req, res, next) => {
    const reportId = req.params.reportId;
    const companyId = req.companyId;

    Report.findOne({ _id: reportId, company: companyId })
        .then(report => {
            if (!report) {
                res.status(404).json({ message: 'Report not found' });
                return null; // ✅ stop chain
            }

            // Delete the report document from MongoDB
            return Report.deleteOne({ _id: reportId })
                .then(() => {
                    // Delete the file from uploads folder if it exists
                    if (report.fileUrl) {
                        const filename = path.basename(report.fileUrl);
                        const filePath = path.join(__dirname, '../uploads', filename);

                        fs.unlink(filePath, err => {
                            if (err) console.error('Failed to delete file:', err);
                        });
                    }

                    return true;
                });
        })
        .then(done => {
            if (!done) return; // ✅ already responded
            res.status(200).json({ message: 'Report deleted successfully' });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.deleteReportByCompany = (req, res, next) => {
    const reportId = req.params.reportId;
    const companyUserId = req.userId; // the company user’s ID

    // Find the report and ensure it belongs to a project of this company
    Report.findOne({ _id: reportId })
        .populate('project', 'company')
        .then(report => {
            if (!report) {
                res.status(404).json({ message: 'Report not found' });
                return null; // ✅ stop chain
            }

            // Check that the project’s company matches the logged-in company
            if (!report.project || report.project.company.toString() !== companyUserId.toString()) {
                res.status(403).json({ message: 'Not authorized to delete this report' });
                return null; // ✅ stop chain
            }

            return Report.deleteOne({ _id: reportId })
                .then(() => {
                    if (report.fileUrl) {
                        const filename = path.basename(report.fileUrl);
                        const filePath = path.join(__dirname, '../uploads', filename);

                        fs.unlink(filePath, err => {
                            if (err) console.error('Failed to delete file:', err);
                        });
                    }
                    return true;
                });
        })
        .then(done => {
            if (!done) return; // ✅ already responded
            res.status(200).json({ message: 'Report deleted successfully' });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getMyTeamReports = (req, res, next) => {
    const memberId = req.userId;
    const companyId = req.companyId;

    Team.findOne({ members: memberId, company: companyId })
        .then(team => {
            if (!team) {
                res.status(404).json({ message: 'No team found' });
                return null; // ✅ stop chain
            }

            return Report.find({ team: team._id, company: companyId })
                .populate('createdBy', 'name email')
                .populate('project', 'name')
                .then(reports => {
                    res.status(200).json({ team, reports });
                    return true;
                });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getProjectReports = (req, res, next) => {
    const projectId = req.params.projectId;
    const pmId = req.userId;
    const companyId = req.companyId;

    Project.findOne({ _id: projectId, projectManager: pmId, company: companyId })
        .then(project => {
            if (!project) {
                res.status(403).json({ message: 'Not your project.' });
                return null; // ✅ stop chain
            }

            return Report.find({ project: projectId, company: companyId })
                .populate('createdBy', 'name email')
                .then(reports => {
                    res.status(200).json({ project, reports });
                    return true;
                });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

exports.getAllCompanyReports = (req, res) => {
    const companyId = req.userId; // company account id

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    // ✅ Always scope by company
    const filter = { company: companyId };

    // ✅ Optional filters (still company scoped by base filter)
    if (req.query.projectId) filter.project = req.query.projectId;
    if (req.query.teamId) filter.team = req.query.teamId;
    if (req.query.memberId) filter.createdBy = req.query.memberId;

    // optional sort
    const sort = req.query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

    const listPromise = Report.find(filter)
        .populate({
            path: "createdBy",
            select: "name email company",
            match: { company: companyId } // ✅ prevent cross-company populate
        })
        .populate({
            path: "project",
            select: "name company",
            match: { company: companyId }
        })
        .populate({
            path: "team",
            select: "name company",
            match: { company: companyId }
        })
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean();

    const countPromise = Report.countDocuments(filter);

    Promise.all([listPromise, countPromise])
        .then(([reportsRaw, total]) => {
            // 🧼 If populate match fails, fields become null. Filter out any weird cross-company refs.
            const reports = reportsRaw.filter(r => {
                const okUser = !r.createdBy || String(r.createdBy.company) === String(companyId);
                const okProject = !r.project || String(r.project.company) === String(companyId);
                const okTeam = !r.team || String(r.team.company) === String(companyId);
                return okUser && okProject && okTeam;
            });

            res.status(200).json({
                page,
                limit,
                total,
                filters: {
                    projectId: req.query.projectId || null,
                    teamId: req.query.teamId || null,
                    memberId: req.query.memberId || null,
                    sort: req.query.sort === "oldest" ? "oldest" : "latest"
                },
                reports
            });
        })
        .catch(err => {
            if (res.headersSent) return;
            res.status(500).json({ message: err.message });
        });
};

