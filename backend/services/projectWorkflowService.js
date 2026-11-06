const { recordAuditEvent } = require('./auditService');
const Notification = require('../models/Notification');
const ApprovalGate = require('../models/ApprovalGate');

const transitionProject = async (project, req, toStatus, action, allowedFrom, note, requiredGateStage = null) => {
  if (!allowedFrom.includes(project.workflowStatus)) {
    const error = new Error(`Project cannot move from ${project.workflowStatus} to ${toStatus}`);
    error.statusCode = 409;
    throw error;
  }

  if (requiredGateStage) {
    const pendingGates = await ApprovalGate.countDocuments({ projectId: project._id, stage: requiredGateStage, required: true, status: { $ne: 'approved' } });
    if (pendingGates > 0) {
      const error = new Error(`Required ${requiredGateStage.replace(/_/g, ' ')} approval gates are incomplete`);
      error.statusCode = 409;
      throw error;
    }
  }

  const fromStatus = project.workflowStatus;
  project.workflowStatus = toStatus;
  project.workflowHistory.push({
    action,
    fromStatus,
    toStatus,
    performedBy: req.user._id,
    note
  });
  await project.save();
  await recordAuditEvent({
    req,
    action,
    resourceType: 'Project',
    resourceId: project._id,
    before: { workflowStatus: fromStatus },
    after: { workflowStatus: toStatus },
    note
  });

  const recipient = action === 'assigned_to_hr' || action === 'forwarded_to_hr'
    ? project.assignedHr
    : action === 'assigned_to_manager' || action === 'submitted_to_manager_review'
      ? project.assignedManager
      : null;
  if (recipient && recipient.toString() !== req.user._id.toString()) {
    await Notification.create({
      userId: recipient,
      type: 'project',
      category: 'info',
      title: 'Project workflow update',
      message: `Project ${project.name} moved to ${toStatus.replace(/_/g, ' ')}`,
      actionUrl: `/projects/${project._id}`,
      relatedEntity: { entityType: 'Project', entityId: project._id },
      sentBy: req.user._id
    });
  }
};

const assertProjectAssignment = (project, field, userId) => {
  if (!project[field] || project[field].toString() !== userId.toString()) {
    const error = new Error('You are not the assigned project owner for this action');
    error.statusCode = 403;
    throw error;
  }
};

module.exports = { transitionProject, assertProjectAssignment };
