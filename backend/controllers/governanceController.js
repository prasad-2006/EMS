const Project = require('../models/Project');
const Risk = require('../models/Risk');
const Issue = require('../models/Issue');
const ChangeRequest = require('../models/ChangeRequest');
const WorkItem = require('../models/WorkItem');
const Decision = require('../models/Decision');
const Conversation = require('../models/Conversation');
const { recordAuditEvent } = require('../services/auditService');
const { getPortfolioSummary } = require('../services/portfolioService');

const getProject = async (projectId, user) => {
  const project = await Project.findById(projectId).select('owner members createdBy assignedHr assignedManager');
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  const userId = user._id.toString();
  const allowed = user.role === 'admin' || [project.owner, project.createdBy, project.assignedHr, project.assignedManager].some((id) => id && id.toString() === userId) || project.members.some((id) => id.toString() === userId);
  if (!allowed) {
    const error = new Error('You are not allowed to access project governance data');
    error.statusCode = 403;
    throw error;
  }
  return project;
};

const canManage = (project, user) => user.role === 'admin' || user.role === 'hr' || project.assignedManager?.toString() === user._id.toString();

const listRegister = (Model) => async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const filter = { projectId: req.params.projectId };
    if (req.query.status) filter.status = req.query.status;
    const rows = await Model.find(filter).populate('ownerId requestedBy decidedBy', 'name email role').sort({ createdAt: -1 });
    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const createRegister = (Model, action) => async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    if (!canManage(project, req.user)) return res.status(403).json({ success: false, error: 'Only project governance owners can create this record' });
    const row = await Model.create({ ...req.body, projectId: project._id, ownerId: req.body.ownerId || req.user._id, requestedBy: req.user._id });
    await recordAuditEvent({ req, action, resourceType: 'Project', resourceId: project._id, after: { recordId: row._id, title: row.title, status: row.status } });
    return res.status(201).json({ success: true, data: row });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const updateRegister = (Model, resourceName) => async (req, res) => {
  try {
    const row = await Model.findById(req.params.id);
    if (!row) return res.status(404).json({ success: false, error: `${resourceName} not found` });
    const project = await getProject(row.projectId, req.user);
    if (!canManage(project, req.user)) return res.status(403).json({ success: false, error: 'Only project governance owners can update this record' });
    Object.assign(row, req.body);
    if (['approved', 'rejected'].includes(row.status) && row.decidedBy === undefined) {
      row.decidedBy = req.user._id;
      row.decidedAt = new Date();
    }
    await row.save();
    await recordAuditEvent({ req, action: `${resourceName.toLowerCase()}_updated`, resourceType: 'Project', resourceId: project._id, after: { recordId: row._id, status: row.status } });
    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const getPortfolio = async (req, res) => {
  try {
    if (!['admin', 'hr'].includes(req.user.role)) return res.status(403).json({ success: false, error: 'Portfolio reporting is restricted' });
    return res.json({ success: true, data: await getPortfolioSummary() });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to build portfolio summary' });
  }
};

const searchGovernance = async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.status(400).json({ success: false, error: 'Search query must contain at least two characters' });
    const regex = { $regex: q, $options: 'i' };
    const [projects, workItems, decisions, conversations] = await Promise.all([
      Project.find({ $or: [{ name: regex }, { code: regex }, { description: regex }], isDeleted: { $ne: true } }).select('name code workflowStatus status').limit(25),
      WorkItem.find({ $or: [{ title: regex }, { description: regex }], }).populate('projectId', 'name code').select('title type status projectId').limit(25),
      Decision.find({ $or: [{ title: regex }, { context: regex }, { decision: regex }] }).populate('projectId', 'name code').select('title status projectId').limit(25),
      Conversation.find({ title: regex, isArchived: false }).populate('projectId', 'name code').select('title projectId updatedAt').limit(25)
    ]);
    return res.json({ success: true, data: { projects, workItems, decisions, conversations } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Governance search failed' });
  }
};

module.exports = {
  listRisks: listRegister(Risk),
  createRisk: createRegister(Risk, 'risk_created'),
  updateRisk: updateRegister(Risk, 'Risk'),
  listIssues: listRegister(Issue),
  createIssue: createRegister(Issue, 'issue_created'),
  updateIssue: updateRegister(Issue, 'Issue'),
  listChangeRequests: listRegister(ChangeRequest),
  createChangeRequest: createRegister(ChangeRequest, 'change_request_created'),
  updateChangeRequest: updateRegister(ChangeRequest, 'ChangeRequest'),
  getPortfolio,
  searchGovernance
};
