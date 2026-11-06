const Project = require('../models/Project');
const Submission = require('../models/Submission');
const Review = require('../models/Review');
const ApprovalGate = require('../models/ApprovalGate');
const ReviewTemplate = require('../models/ReviewTemplate');
const { recordAuditEvent } = require('../services/auditService');

const getProject = async (projectId, user) => {
  const project = await Project.findById(projectId).select('owner members createdBy assignedHr assignedManager');
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  const userId = user._id.toString();
  const allowed = user.role === 'admin' || [project.owner, project.createdBy, project.assignedHr, project.assignedManager].some((id) => id && id.toString() === userId) || (user.role === 'employee' && project.members.some((id) => id.toString() === userId));
  if (!allowed) {
    const error = new Error('You are not allowed to access project reviews');
    error.statusCode = 403;
    throw error;
  }
  return project;
};

const listSubmissions = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const submissions = await Submission.find({ projectId: req.params.projectId })
      .populate('submittedBy', 'name email role')
      .populate('taskId', 'title status reviewStatus')
      .sort({ submittedAt: -1 });
    return res.json({ success: true, data: submissions });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listReviews = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const reviews = await Review.find({ projectId: req.params.projectId })
      .populate('reviewerId', 'name email role')
      .populate('submissionId', 'version status submittedAt')
      .sort({ reviewedAt: -1 });
    return res.json({ success: true, data: reviews });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listGates = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const gates = await ApprovalGate.find({ projectId: req.params.projectId }).populate('decidedBy', 'name email role').sort({ stage: 1, createdAt: 1 });
    return res.json({ success: true, data: gates });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const canManageGate = (project, user) => user.role === 'admin' || user.role === 'hr' || (project.assignedManager && project.assignedManager.toString() === user._id.toString());

const canDecideGate = (project, gate, user) => {
  if (user.role === 'admin') return gate.approverRole === 'admin' || gate.approverRole === 'stakeholder';
  if (gate.approverRole === 'manager') return project.assignedManager && project.assignedManager.toString() === user._id.toString();
  if (gate.approverRole === 'hr') return project.assignedHr && project.assignedHr.toString() === user._id.toString();
  if (['qa', 'stakeholder'].includes(gate.approverRole)) return project.members.some((id) => id.toString() === user._id.toString());
  return false;
};

const createGate = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    if (!canManageGate(project, req.user)) return res.status(403).json({ success: false, error: 'Only project governance owners can create approval gates' });
    const gate = await ApprovalGate.create({ ...req.body, projectId: project._id });
    await recordAuditEvent({ req, action: 'approval_gate_created', resourceType: 'Project', resourceId: project._id, after: { gateId: gate._id, name: gate.name, stage: gate.stage } });
    return res.status(201).json({ success: true, data: gate });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const updateGate = async (req, res) => {
  try {
    const gate = await ApprovalGate.findById(req.params.id);
    if (!gate) return res.status(404).json({ success: false, error: 'Approval gate not found' });
    const project = await getProject(gate.projectId, req.user);
    if (!canDecideGate(project, gate, req.user)) return res.status(403).json({ success: false, error: 'Only the configured gate approver can update this approval gate' });
    Object.assign(gate, req.body);
    if (['approved', 'rejected', 'skipped'].includes(gate.status)) {
      gate.decidedBy = req.user._id;
      gate.decidedAt = new Date();
    }
    await gate.save();
    await recordAuditEvent({ req, action: `approval_gate_${gate.status}`, resourceType: 'Project', resourceId: project._id, after: { gateId: gate._id, status: gate.status, note: gate.decisionNote } });
    return res.json({ success: true, data: gate });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listReviewTemplates = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.projectType) filter.projectType = req.query.projectType;
    if (req.query.workItemType) filter.workItemType = req.query.workItemType;
    const templates = await ReviewTemplate.find(filter).sort({ projectType: 1, workItemType: 1, name: 1 });
    return res.json({ success: true, data: templates });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch review templates' });
  }
};

const createReviewTemplate = async (req, res) => {
  try {
    const template = await ReviewTemplate.create({ ...req.body, createdBy: req.user._id });
    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

const listApprovalQueue = async (req, res) => {
  try {
    const roles = req.user.role === 'admin' ? ['admin', 'stakeholder'] : [req.user.role];
    const gates = await ApprovalGate.find({ approverRole: { $in: roles }, status: 'pending' })
      .populate('projectId', 'name code workflowStatus assignedManager assignedHr')
      .sort({ dueDate: 1, createdAt: 1 });
    const filtered = gates.filter((gate) => {
      if (req.user.role === 'admin') return true;
      const project = gate.projectId;
      return req.user.role === 'manager'
        ? project?.assignedManager?.toString() === req.user._id.toString()
        : req.user.role === 'hr'
          ? project?.assignedHr?.toString() === req.user._id.toString()
          : true;
    });
    return res.json({ success: true, data: filtered });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch approval queue' });
  }
};

module.exports = { listSubmissions, listReviews, listGates, createGate, updateGate, listReviewTemplates, createReviewTemplate, listApprovalQueue };
