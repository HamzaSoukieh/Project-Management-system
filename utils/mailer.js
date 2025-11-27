const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,  // your email address
        pass: process.env.EMAIL_PASS   // your email app password
    }
});

exports.sendVerificationEmail = async (to, token) => {
    return transporter.sendMail({
        from: process.env.EMAIL_FROM,  // <--- use env variable
        to,
        subject: 'Verify Your Email',
        html: `
      <h2>Verify Your Email</h2>
      <p>Click below to verify your email(valid for 1 hour):</p>
      <a href="http://localhost:8080/auth/verify/${token}">Verify</a>
    `
    });
};

exports.sendResetEmail = (to, token) => {
    return transporter.sendMail({
        from: process.env.EMAIL_FROM,  // <--- use env variable
        to,
        subject: 'Reset Your Password',
        html: `
      <h2>Password Reset</h2>
      <p>Click below to reset your password (valid for 1 hour):</p>
      <a href="http://localhost:3000/reset-password?token=${token}">Reset Password</a>
    `
    });
};

exports.sendProjectClosedEmail = (to, projectName, pmName) => {
    return transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: 'Project Closed Notification',
        html: `
        <h2>Project Closed</h2>
        <p>The project <strong>${projectName}</strong> has been officially closed by the project manager <strong>${pmName}</strong>.</p>
        <p>All related tasks have been marked as completed.</p>
        <p>If this was expected, no action is required.</p>
        `
    });
};