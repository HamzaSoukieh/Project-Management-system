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
        .catch(err => res.status(500).json({ message: err.message }));


};

exports.deleteReportByPm = (req, res, next) => {
    const reportId = req.params.reportId;
    const companyId = req.companyId;

    Report.findOne({ _id: reportId, company: companyId })
        .then(report => {
            if (!report) return res.status(404).json({ message: 'Report not found' });

            // Delete the report document from MongoDB
            return Report.deleteOne({ _id: reportId })
                .then(() => {
                    // Delete the file from uploads folder if it exists
                    if (report.fileUrl) {
                        const filename = path.basename(report.fileUrl); // get the filename from URL
                        const filePath = path.join(__dirname, '../uploads', filename);

                        fs.unlink(filePath, err => {
                            if (err) console.error('Failed to delete file:', err);
                        });
                    }

                    res.status(200).json({ message: 'Report deleted successfully' });
                });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.deleteReportByCompany = (req, res, next) => {
    const reportId = req.params.reportId;
    const companyUserId = req.userId; // the company user’s ID

    // Find the report and ensure it belongs to a project of this company
    Report.findOne({ _id: reportId })
        .populate('project', 'company') // get project’s company field
        .then(report => {
            if (!report) return res.status(404).json({ message: 'Report not found' });

            // Check that the project’s company matches the logged-in company
            if (report.project.company.toString() !== companyUserId.toString()) {
                return res.status(403).json({ message: 'Not authorized to delete this report' });
            }

            // Delete the report document
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

                    res.status(200).json({ message: 'Report deleted successfully' });
                });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.getMyTeamReports = (req, res, next) => {
    const memberId = req.userId;
    const companyId = req.companyId;

    Team.findOne({ members: memberId, company: companyId })
        .then(team => {
            if (!team) return res.status(404).json({ message: 'No team found' });

            return Report.find({ team: team._id, company: companyId })
                .populate('createdBy', 'name email')
                .populate('project', 'name')
                .then(reports => {
                    res.status(200).json({ team, reports });
                });
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.getProjectReports = (req, res, next) => {
    const projectId = req.params.projectId;
    const pmId = req.userId;
    const companyId = req.companyId;

    Project.findOne({ _id: projectId, projectManager: pmId, company: companyId })
        .then(project => {
            if (!project) return res.status(403).json({ message: 'Not your project.' });

            return Report.find({ project: projectId, company: companyId })
                .populate('createdBy', 'name email')
                .then(reports => res.status(200).json({ project, reports }));
        })
        .catch(err => res.status(500).json({ message: err.message }));
};

exports.getAllCompanyReports = (req, res, next) => {
    const companyId = req.userId; // company account id

    Report.find({ company: companyId })
        .populate('createdBy', 'name email')
        .populate('project', 'name')
        .populate('team', 'name')
        .then(reports => res.status(200).json({ reports }))
        .catch(err => res.status(500).json({ message: err.message }));
};
