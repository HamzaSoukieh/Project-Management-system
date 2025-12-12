const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Shared storage for all uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Filter for images (profile photos)
const imageFilter = (req, file, cb) => {
    const allowed = ['image/png', 'image/jpg', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
};

// Filter for reports (PDF/DOCX)
const reportFilter = (req, file, cb) => {
    const allowed = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF or Word documents allowed'), false);
};

// Two different multer middlewares
const uploadUserPhoto = multer({
    storage,
    fileFilter: imageFilter
}).single('photo');

const uploadReport = multer({
    storage,
    fileFilter: reportFilter
}).single('file');

module.exports = {
    uploadUserPhoto,
    uploadReport
};
