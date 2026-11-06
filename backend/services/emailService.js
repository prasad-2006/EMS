const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

// Initialize Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Send email function
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @param {string} text - Plain text alternative
 */
const sendEmail = async (to, subject, html, text = '') => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.warn('⚠️ Email service not configured - skipping email to:', to);
      return { success: false, message: 'Email service not configured' };
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '')
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${result.messageId}`);
    return { success: true, result };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Send leave request notification
 */
const sendLeaveRequestNotification = async (manager, employee, leaveData) => {
  const subject = `Leave Request from ${employee.name}`;
  const html = `
    <h2>New Leave Request</h2>
    <p><strong>Employee:</strong> ${employee.name}</p>
    <p><strong>Type:</strong> ${leaveData.leaveType}</p>
    <p><strong>Period:</strong> ${leaveData.startDate} to ${leaveData.endDate}</p>
    <p><strong>Reason:</strong> ${leaveData.reason || 'Not specified'}</p>
    <p><a href="${process.env.FRONTEND_URL}/admin/requests">View in Dashboard</a></p>
  `;
  return sendEmail(manager.email, subject, html);
};

/**
 * Send leave approved notification
 */
const sendLeaveApprovedNotification = async (employee, leaveData, approvedBy) => {
  const subject = 'Leave Request Approved';
  const html = `
    <h2>Your Leave Request has been Approved ✅</h2>
    <p><strong>Type:</strong> ${leaveData.leaveType}</p>
    <p><strong>Period:</strong> ${leaveData.startDate} to ${leaveData.endDate}</p>
    <p><strong>Approved by:</strong> ${approvedBy}</p>
    <p>Enjoy your leave!</p>
  `;
  return sendEmail(employee.email, subject, html);
};

/**
 * Send return tomorrow reminder
 */
const sendReturnTomorrowReminder = async (employee, backup) => {
  const subject = 'Return to Work Tomorrow';
  const html = `
    <h2>Welcome Back Tomorrow! 👋</h2>
    <p>Hi ${employee.name},</p>
    <p>You're returning to work tomorrow. Your colleague <strong>${backup.name}</strong> has been covering for you.</p>
    <p><a href="${process.env.FRONTEND_URL}/employee/return">View your return summary</a></p>
  `;
  return sendEmail(employee.email, subject, html);
};

/**
 * Send daily digest to covering persons
 */
const sendCoveringDigest = async (backup, coveringTasks) => {
  const taskList = coveringTasks
    .map(t => `<li><strong>${t.title}</strong> - Priority: ${t.priority}</li>`)
    .join('');

  const subject = `Daily Digest: You\'re covering ${coveringTasks.length} task(s)`;
  const html = `
    <h2>Tasks You're Covering</h2>
    <ul>${taskList}</ul>
    <p><a href="${process.env.FRONTEND_URL}/employee/backup">View all covered tasks</a></p>
  `;
  return sendEmail(backup.email, subject, html);
};

/**
 * Send low balance warning
 */
const sendLowBalanceWarning = async (employee, balanceData) => {
  const subject = `⚠️ Low Leave Balance: ${balanceData.remaining} days left`;
  const html = `
    <h2>Low Leave Balance Warning</h2>
    <p>Hi ${employee.name},</p>
    <p>You have <strong>${balanceData.remaining} days</strong> of leave remaining.</p>
    <p>Balance breakdown:</p>
    <ul>
      <li>Annual: ${balanceData.annual} days</li>
      <li>Sick: ${balanceData.sick} days</li>
      <li>Casual: ${balanceData.casual} days</li>
    </ul>
    <p><a href="${process.env.FRONTEND_URL}/dashboard">View your dashboard</a></p>
  `;
  return sendEmail(employee.email, subject, html);
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (user, resetUrl) => {
  const subject = 'Reset your Vacation Tracking System password';
  const html = `
    <h2>Password Reset Request</h2>
    <p>Hi ${user.name},</p>
    <p>We received a request to reset your password. Use the link below to choose a new password:</p>
    <p><a href="${resetUrl}">Reset Password</a></p>
    <p>This link expires in 1 hour. If you did not request this, you can safely ignore this email.</p>
  `;

  return sendEmail(user.email, subject, html);
};

module.exports = {
  sendEmail,
  sendLeaveRequestNotification,
  sendLeaveApprovedNotification,
  sendReturnTomorrowReminder,
  sendCoveringDigest,
  sendLowBalanceWarning,
  sendPasswordResetEmail
};
