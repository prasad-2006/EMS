const Risk = require('../models/Risk');
const Issue = require('../models/Issue');
const Notification = require('../models/Notification');
const AuditEvent = require('../models/AuditEvent');

const escalateOverdueGovernanceItems = async () => {
  const now = new Date();
  const [risks, issues] = await Promise.all([
    Risk.find({ status: { $in: ['open', 'accepted'] }, dueDate: { $lt: now }, escalatedAt: null, ownerId: { $ne: null } }).limit(100),
    Issue.find({ status: { $in: ['open', 'in-progress', 'blocked'] }, dueDate: { $lt: now }, escalatedAt: null, ownerId: { $ne: null } }).limit(100)
  ]);
  for (const item of [...risks, ...issues]) {
    item.escalatedAt = now;
    await item.save();
    await Notification.create({
      userId: item.ownerId,
      type: 'alert',
      category: 'warning',
      priority: 'high',
      title: 'Governance item overdue',
      message: `${item.title} is overdue and requires attention`,
      actionUrl: `/projects/${item.projectId}`,
      sentBySystem: true
    });
  }
  return { escalatedRisks: risks.length, escalatedIssues: issues.length };
};

const pruneExpiredAuditEvents = async () => {
  const retentionDays = Math.max(Number(process.env.AUDIT_RETENTION_DAYS) || 3650, 30);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);
  const result = await AuditEvent.deleteMany({ createdAt: { $lt: cutoff } });
  return { deleted: result.deletedCount || 0, retentionDays };
};

module.exports = { escalateOverdueGovernanceItems, pruneExpiredAuditEvents };
