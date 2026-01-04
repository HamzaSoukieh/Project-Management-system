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

exports.sendCompanyInviteEmail = (to, data) => {
    const {
        inviteeName,
        companyName,
        inviterName,
        role,
        loginLink,
        password
    } = data;

    const roleLabel =
        role === "projectManager" ? "Project Manager" :
            role === "member" ? "Member" :
                "User";

    return transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to,
        subject: `Your ${companyName} account credentials`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>${companyName} Account Created</h2>

        <p>Hi ${inviteeName || ""},</p>

        <p><strong>${inviterName || "An admin"}</strong> created an account for you at <strong>${companyName}</strong> as a <strong>${roleLabel}</strong>.</p>

        <p><strong>Login credentials:</strong></p>
        <div style="background:#f3f4f6;padding:14px;border-radius:10px;">
          <p style="margin:0;"><strong>Email:</strong> ${to}</p>
          <p style="margin:6px 0 0;"><strong>Password:</strong> ${password}</p>
        </div>

        <p style="margin-top:16px;">Login here:</p>

        <p style="margin: 20px 0;">
          <a href="${loginLink}"
             style="background:#111827;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
            Go to Login
          </a>
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

        <p style="color:#6b7280;font-size:12px;">
          If the button doesn’t work, copy and paste:<br/>
          ${loginLink}
        </p>
      </div>
    `
    });
};

exports.sendReportCreatedEmail = ({ to, companyName, projectName, teamName, memberName, reportTitle, reportDescription, reportLink }) => {
    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to].filter(Boolean);

    if (!recipients.length) return Promise.resolve(); // no recipients -> skip safely

    return transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipients.join(","),
        subject: `New report created: ${reportTitle}`,
        html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>New Report Created</h2>

        <p><strong>${memberName}</strong> created a new report in <strong>${companyName}</strong>.</p>

        <ul>
          ${projectName ? `<li><strong>Project:</strong> ${projectName}</li>` : ""}
          ${teamName ? `<li><strong>Team:</strong> ${teamName}</li>` : ""}
          <li><strong>Title:</strong> ${reportTitle}</li>
          ${reportDescription ? `<li><strong>Description:</strong> ${reportDescription}</li>` : ""}
        </ul>

        ${reportLink ? `
          <p style="margin: 20px 0;">
            <a href="${reportLink}"
               style="background:#111827;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">
              View Report
            </a>
          </p>
        ` : ""}

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

        <p style="color:#6b7280;font-size:12px;">
          This is an automated notification.
        </p>
      </div>
    `
    });
};
