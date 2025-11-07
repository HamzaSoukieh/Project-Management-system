const transporter = require('nodemailer').createTransport(
    require('nodemailer-sendgrid-transport')({
        auth: { api_key: process.env.SENDGRID_API_KEY }
    })
);

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
      <a href="http://localhost:8080/auth/reset/${token}">Reset Password</a>
    `
    });
};
