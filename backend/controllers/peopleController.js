const Project = require('../models/Project');
const User = require('../models/User');
const Task = require('../models/Task');
const Skill = require('../models/Skill');
const UserSkill = require('../models/UserSkill');
const ResourceRequest = require('../models/ResourceRequest');
const ProjectFeedback = require('../models/ProjectFeedback');
const ProjectMember = require('../models/ProjectMember');
const { getProjectCapacity } = require('../services/capacityService');

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
    const error = new Error('You are not allowed to access this people data');
    error.statusCode = 403;
    throw error;
  }
  return project;
};

const canStaff = (project, user) => user.role === 'admin' || user.role === 'hr' || project.assignedManager?.toString() === user._id.toString();

const listSkills = async (req, res) => {
  try {
    const filter = { isActive: true };
    if (req.query.q) filter.name = { $regex: req.query.q, $options: 'i' };
    if (req.query.category) filter.category = req.query.category;
    return res.json({ success: true, data: await Skill.find(filter).sort({ name: 1 }) });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch skills' });
  }
};

const createSkill = async (req, res) => {
  try {
    const skill = await Skill.create({ ...req.body, createdBy: req.user._id });
    return res.status(201).json({ success: true, data: skill });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

const listUserSkills = async (req, res) => {
  try {
    const canView = ['admin', 'hr', 'manager'].includes(req.user.role) || req.user._id.toString() === req.params.userId;
    if (!canView) return res.status(403).json({ success: false, error: 'You are not allowed to view this capability profile' });
    const skills = await UserSkill.find({ userId: req.params.userId }).populate('skillId', 'name category description').populate('verifiedBy', 'name email');
    return res.json({ success: true, data: skills });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch user skills' });
  }
};

const upsertUserSkill = async (req, res) => {
  try {
    const canEdit = ['admin', 'hr'].includes(req.user.role) || req.user._id.toString() === req.params.userId;
    if (!canEdit) return res.status(403).json({ success: false, error: 'You are not allowed to edit this capability profile' });
    const skill = await Skill.findOne({ _id: req.body.skillId, isActive: true });
    if (!skill) return res.status(400).json({ success: false, error: 'Active skill is required' });
    const value = { ...req.body, userId: req.params.userId };
    if (['admin', 'hr'].includes(req.user.role)) value.verifiedBy = req.user._id;
    if (value.verifiedBy) value.verifiedAt = new Date();
    const userSkill = await UserSkill.findOneAndUpdate({ userId: req.params.userId, skillId: skill._id }, value, { new: true, upsert: true, runValidators: true }).populate('skillId', 'name category').populate('verifiedBy', 'name email');
    return res.status(201).json({ success: true, data: userSkill });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

const getManagerProfile = async (req, res) => {
  try {
    const manager = await User.findOne({ _id: req.params.userId, role: 'manager' }).select('name email department designation joiningDate');
    if (!manager) return res.status(404).json({ success: false, error: 'Manager not found' });
    const [projects, tasks, members, feedback] = await Promise.all([
      Project.find({ assignedManager: manager._id }).select('name workflowStatus status startDate endDate'),
      Task.find({ createdBy: manager._id }).select('reviewStatus status createdAt'),
      ProjectMember.countDocuments({ userId: manager._id, status: { $ne: 'released' } }),
      ProjectFeedback.find({ revieweeId: manager._id }).select('deliveryQuality communication reliability period createdAt').sort({ createdAt: -1 }).limit(20)
    ]);
    const reviewedTasks = tasks.filter((task) => ['approved', 'changes_requested'].includes(task.reviewStatus));
    return res.json({ success: true, data: { manager, projects, activeProjectCount: projects.filter((project) => !['completed', 'cancelled'].includes(project.status)).length, assignedProjectCount: members, tasksCreated: tasks.length, reviewDecisions: reviewedTasks.length, feedback } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch manager delivery profile' });
  }
};

const listResourceRequests = async (req, res) => {
  try {
    const filter = {};
    if (req.query.projectId) {
      await getProject(req.query.projectId, req.user);
      filter.projectId = req.query.projectId;
    } else if (!['admin', 'hr'].includes(req.user.role)) {
      filter.requestedBy = req.user._id;
    }
    if (req.query.status) filter.status = req.query.status;
    const requests = await ResourceRequest.find(filter).populate('projectId', 'name code').populate('requestedBy assignedUserId reviewedBy', 'name email role').populate('skillId', 'name category').sort({ createdAt: -1 });
    return res.json({ success: true, data: requests });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const createResourceRequest = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    if (!canStaff(project, req.user)) return res.status(403).json({ success: false, error: 'Only project staffing owners can request resources' });
    const request = await ResourceRequest.create({ ...req.body, projectId: project._id, requestedBy: req.user._id });
    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const updateResourceRequest = async (req, res) => {
  try {
    const request = await ResourceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, error: 'Resource request not found' });
    const project = await getProject(request.projectId, req.user);
    const canReview = req.user.role === 'admin' || req.user.role === 'hr';
    const canEdit = canStaff(project, req.user) && request.requestedBy.toString() === req.user._id.toString();
    if (!canReview && !canEdit) return res.status(403).json({ success: false, error: 'You are not allowed to update this resource request' });
    Object.assign(request, req.body);
    if (canReview && ['approved', 'rejected'].includes(request.status)) {
      request.reviewedBy = req.user._id;
      request.reviewedAt = new Date();
    }
    await request.save();
    return res.json({ success: true, data: request });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const getWeeklyCapacity = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const weekStart = req.query.weekStart ? new Date(req.query.weekStart) : new Date();
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return res.json({ success: true, data: { weekStart, weekEnd, members: await getProjectCapacity(req.params.projectId) } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const createFeedback = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    if (!canStaff(project, req.user)) return res.status(403).json({ success: false, error: 'Only project staffing owners can record feedback' });
    const feedback = await ProjectFeedback.create({ ...req.body, projectId: project._id, reviewerId: req.user._id });
    return res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listFeedback = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    const filter = { projectId: project._id };
    if (req.query.revieweeId) filter.revieweeId = req.query.revieweeId;
    if (req.user.role === 'employee') filter.privateToHr = false;
    const feedback = await ProjectFeedback.find(filter).populate('revieweeId reviewerId', 'name email role').sort({ createdAt: -1 });
    return res.json({ success: true, data: feedback });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

module.exports = { listSkills, createSkill, listUserSkills, upsertUserSkill, getManagerProfile, listResourceRequests, createResourceRequest, updateResourceRequest, getWeeklyCapacity, createFeedback, listFeedback };
