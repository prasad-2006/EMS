const Project = require('../models/Project');
const User = require('../models/User');
const WorkItem = require('../models/WorkItem');
const Milestone = require('../models/Milestone');
const ProjectMember = require('../models/ProjectMember');
const { getProjectCapacity } = require('../services/capacityService');

const getProject = async (projectId, user) => {
  const project = await Project.findById(projectId).select('owner members createdBy assignedHr assignedManager assignedDepartment departmentId');
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }

  const userId = user._id.toString();
  const isMember = (project.members || []).some((id) => id.toString() === userId);
  const canView = user.role === 'admin' || [project.owner, project.createdBy, project.assignedHr, project.assignedManager].some((id) => id && id.toString() === userId) || (user.role === 'employee' && isMember);
  if (!canView) {
    const error = new Error('You are not allowed to access this project planning data');
    error.statusCode = 403;
    throw error;
  }
  return project;
};

const assertPlanner = (user, project) => {
  const userId = user._id.toString();
  const allowed = user.role === 'admin' || user.role === 'hr' || (project.assignedManager && project.assignedManager.toString() === userId);
  if (!allowed) {
    const error = new Error('Only the project planning team can change planning data');
    error.statusCode = 403;
    throw error;
  }
};

const listWorkItems = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const filter = { projectId: req.params.projectId };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.type) filter.type = req.query.type;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.q) filter.title = { $regex: req.query.q, $options: 'i' };
    const [workItems, total] = await Promise.all([
      WorkItem.find(filter)
      .populate('assignedTo reviewer', 'name email role')
      .populate('milestoneId', 'name status dueDate')
      .sort({ priority: -1, deadline: 1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
      WorkItem.countDocuments(filter)
    ]);
    return res.json({ success: true, data: workItems, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const bulkUpdateWorkItems = async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? [...new Set(req.body.ids)] : [];
    if (ids.length === 0) return res.status(400).json({ success: false, error: 'At least one work item is required' });
    const workItems = await WorkItem.find({ _id: { $in: ids } }).select('projectId');
    if (workItems.length !== ids.length) return res.status(404).json({ success: false, error: 'One or more work items were not found' });
    const projects = await Promise.all(workItems.map((item) => getProject(item.projectId, req.user)));
    projects.forEach((project) => assertPlanner(req.user, project));
    const allowed = ['status', 'priority', 'assignedTo', 'reviewer', 'milestoneId', 'deadline'];
    const updates = Object.fromEntries(Object.entries(req.body.updates || {}).filter(([key]) => allowed.includes(key)));
    await WorkItem.updateMany({ _id: { $in: ids } }, { $set: updates });
    return res.json({ success: true, updated: ids.length });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const createWorkItem = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    assertPlanner(req.user, project);
    const workItem = await WorkItem.create({ ...req.body, projectId: project._id, createdBy: req.user._id });
    await workItem.populate('assignedTo reviewer', 'name email role');
    return res.status(201).json({ success: true, data: workItem });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const updateWorkItem = async (req, res) => {
  try {
    const workItem = await WorkItem.findById(req.params.id);
    if (!workItem) return res.status(404).json({ success: false, error: 'Work item not found' });
    const project = await getProject(workItem.projectId, req.user);
    assertPlanner(req.user, project);
    Object.assign(workItem, req.body);
    if (workItem.status === 'done' && !workItem.completedAt) workItem.completedAt = new Date();
    await workItem.save();
    await workItem.populate('assignedTo reviewer', 'name email role');
    return res.json({ success: true, data: workItem });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listMilestones = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const milestones = await Milestone.find({ projectId: req.params.projectId }).populate('owner', 'name email role').sort({ dueDate: 1, createdAt: 1 });
    return res.json({ success: true, data: milestones });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const createMilestone = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    assertPlanner(req.user, project);
    const milestone = await Milestone.create({ ...req.body, projectId: project._id });
    await milestone.populate('owner', 'name email role');
    return res.status(201).json({ success: true, data: milestone });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const updateMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ success: false, error: 'Milestone not found' });
    const project = await getProject(milestone.projectId, req.user);
    assertPlanner(req.user, project);
    Object.assign(milestone, req.body);
    if (milestone.status === 'completed' && !milestone.completedAt) milestone.completedAt = new Date();
    await milestone.save();
    await milestone.populate('owner', 'name email role');
    return res.json({ success: true, data: milestone });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listMembers = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const members = await ProjectMember.find({ projectId: req.params.projectId }).populate('userId', 'name email role department designation').sort({ status: 1, createdAt: 1 });
    return res.json({ success: true, data: members });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const assignMember = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    assertPlanner(req.user, project);
    const { userId, projectRole, allocationPercent, startDate, endDate, status } = req.body;
    const allowedRoles = ['sponsor', 'manager', 'lead', 'developer', 'designer', 'qa', 'stakeholder', 'member'];
    if (!userId) return res.status(400).json({ success: false, error: 'A project member is required' });
    if (projectRole && !allowedRoles.includes(projectRole)) {
      return res.status(400).json({ success: false, error: 'Invalid project member role' });
    }
    if (allocationPercent !== undefined && (!Number.isFinite(Number(allocationPercent)) || Number(allocationPercent) < 1 || Number(allocationPercent) > 100)) {
      return res.status(400).json({ success: false, error: 'Allocation must be between 1 and 100 percent' });
    }

    const user = await User.findOne({ _id: userId, status: { $in: ['approved', 'active'] } });
    if (!user) return res.status(400).json({ success: false, error: 'A valid active user is required' });
    const existing = await ProjectMember.findOne({ projectId: project._id, userId: user._id });
    const currentAllocation = existing && existing.status !== 'released' ? Number(existing.allocationPercent) : 0;
    const otherAllocations = await ProjectMember.aggregate([
      { $match: { projectId: project._id, userId: user._id, status: { $ne: 'released' } } },
      { $group: { _id: null, total: { $sum: '$allocationPercent' } } }
    ]);
    const requestedAllocation = allocationPercent === undefined ? 100 : Number(allocationPercent);
    const totalAllocation = (otherAllocations[0]?.total || 0) - currentAllocation + requestedAllocation;
    if (totalAllocation > 100) return res.status(409).json({ success: false, error: `Allocation would reach ${totalAllocation}%. Reduce the project allocation first.` });
    const memberUpdates = {
      projectId: project._id,
      userId: user._id,
      ...(projectRole ? { projectRole } : {}),
      ...(allocationPercent !== undefined ? { allocationPercent: requestedAllocation } : {}),
      ...(startDate !== undefined ? { startDate } : {}),
      ...(endDate !== undefined ? { endDate } : {}),
      ...(status !== undefined ? { status } : {})
    };
    const member = await ProjectMember.findOneAndUpdate(
      { projectId: project._id, userId: user._id },
      memberUpdates,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).populate('userId', 'name email role department designation');
    await Project.updateOne({ _id: project._id }, { $addToSet: { members: user._id } });
    return res.status(201).json({ success: true, data: member });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, error: 'This user is already assigned to the project' });
    }
    if (error?.name === 'ValidationError' || error?.name === 'CastError') {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const getCapacity = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const capacity = await getProjectCapacity(req.params.projectId);
    return res.json({ success: true, data: capacity });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const getCriticalPath = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const workItems = await WorkItem.find({ projectId: req.params.projectId }).select('title estimateHours dependencies status');
    const byId = new Map(workItems.map((item) => [item._id.toString(), item]));
    const memo = new Map();
    const visiting = new Set();

    const longestPath = (itemId) => {
      if (memo.has(itemId)) return memo.get(itemId);
      if (visiting.has(itemId)) {
        const error = new Error('Work-item dependency cycle detected');
        error.statusCode = 409;
        throw error;
      }
      visiting.add(itemId);
      const item = byId.get(itemId);
      const predecessors = (item?.dependencies || []).map((dependency) => byId.get(dependency.toString())).filter(Boolean);
      let best = { hours: 0, path: [] };
      predecessors.forEach((predecessor) => {
        const candidate = longestPath(predecessor._id.toString());
        if (candidate.hours > best.hours) best = candidate;
      });
      const result = { hours: best.hours + (Number(item?.estimateHours) || 0), path: [...best.path, itemId] };
      visiting.delete(itemId);
      memo.set(itemId, result);
      return result;
    };

    let critical = { hours: 0, path: [] };
    workItems.forEach((item) => {
      const candidate = longestPath(item._id.toString());
      if (candidate.hours > critical.hours) critical = candidate;
    });
    return res.json({ success: true, data: { totalHours: critical.hours, workItemIds: critical.path, workItems: critical.path.map((id) => byId.get(id)) } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

module.exports = {
  listWorkItems,
  createWorkItem,
  updateWorkItem,
  bulkUpdateWorkItems,
  listMilestones,
  createMilestone,
  updateMilestone,
  listMembers,
  assignMember,
  getCapacity,
  getCriticalPath
};
