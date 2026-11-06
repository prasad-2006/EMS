const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const AuditEvent = require('../models/AuditEvent');
const { recordAuditEvent } = require('../services/auditService');
const { transitionProject, assertProjectAssignment } = require('../services/projectWorkflowService');
const fs = require('fs');
const path = require('path');

const canViewProject = (project, user) => {
  if (user.role === 'admin') return true;
  const userId = user._id.toString();
  if ([project.owner, project.createdBy, project.assignedHr, project.assignedManager].some((id) => id && id.toString() === userId)) return true;
  return user.role === 'employee' && (project.members || []).some((id) => id && id.toString() === userId);
};

const setProtectedDocumentUrls = (project) => {
  (project.documents || []).forEach((document) => {
    document.url = `/api/projects/${project._id}/documents/${encodeURIComponent(document.filename)}`;
  });
  if (project.document?.filename) {
    project.document.url = `/api/projects/${project._id}/documents/${encodeURIComponent(project.document.filename)}`;
  }
};

const getProjectForWorkflow = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  return project;
};

// @desc Create a project
// @route POST /api/projects
// @access Private/Admin
const createProject = async (req, res) => {
  try {
    const { name, code, description, owner, members, startDate, endDate, status, departmentId } = req.body;
    const document = req.file ? {
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: null,
      uploadedAt: new Date()
    } : undefined;
    const project = await Project.create({
      name,
      code,
      description,
      owner,
      members,
      startDate,
      endDate,
      status,
      departmentId,
      assignedDepartment: departmentId,
      document,
      createdBy: req.user._id,
      workflowStatus: 'draft',
      documents: document ? [{ ...document, uploadedBy: req.user._id, uploadedByRole: req.user.role, stage: 'ceo_assignment' }] : [],
      workflowHistory: [{
        action: 'created',
        fromStatus: null,
        toStatus: 'draft',
        performedBy: req.user._id
      }]
    });
    if (document) {
      const protectedUrl = `/api/projects/${project._id}/documents/${encodeURIComponent(document.filename)}`;
      project.document.url = protectedUrl;
      project.documents[0].url = protectedUrl;
      await project.save();
    }
    await recordAuditEvent({
      req,
      action: 'project_created',
      resourceType: 'Project',
      resourceId: project._id,
      before: null,
      after: { workflowStatus: project.workflowStatus, status: project.status, name: project.name }
    });
    return res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error(error);
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ success: false, error: 'Server error while creating project' });
  }
};

// @desc Get projects list
// @route GET /api/projects
// @access Private
const getProjects = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);
    const skip = (page - 1) * limit;

    const query = { isDeleted: { $ne: true } };
    if (req.query.status) query.status = req.query.status;
    if (req.query.workflowStatus) query.workflowStatus = req.query.workflowStatus;
    if (req.user.role === 'hr') query.assignedHr = req.user._id;
    if (req.user.role === 'manager') query.assignedManager = req.user._id;
    if (req.user.role === 'employee') query.members = req.user._id;
    if (req.query.q) query.name = { $regex: req.query.q, $options: 'i' };

    const [projects, total] = await Promise.all([
      Project.find(query)
        .populate('assignedHr assignedManager currentReviewer', 'name email role department')
        .populate('assignedDepartment', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Project.countDocuments(query)
    ]);

    return res.status(200).json({ success: true, count: projects.length, data: projects, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while fetching projects' });
  }
};

// @desc Get project by id (with summary)
// @route GET /api/projects/:id
// @access Private
const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!canViewProject(project, req.user)) return res.status(403).json({ success: false, error: 'You are not allowed to view this project' });

    await project.populate([
      { path: 'owner', select: 'name email' },
      { path: 'members', select: 'name email role department' },
      { path: 'createdBy assignedHr assignedManager currentReviewer', select: 'name email role' },
      { path: 'assignedDepartment', select: 'name code' }
    ]);
    setProtectedDocumentUrls(project);

    const taskCounts = await Task.aggregate([
      { $match: { projectId: project._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    return res.status(200).json({ success: true, data: { project, taskCounts } });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while fetching project' });
  }
};

const getProjectAuditEvents = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).select('owner members createdBy assignedHr assignedManager');
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!canViewProject(project, req.user)) return res.status(403).json({ success: false, error: 'You are not allowed to view this project audit' });

    const events = await AuditEvent.find({ resourceType: 'Project', resourceId: project._id })
      .populate('actorId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(200);
    return res.status(200).json({ success: true, data: events });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while fetching project audit' });
  }
};

// @desc Update project
// @route PUT /api/projects/:id
// @access Private/Admin
const updateProject = async (req, res) => {
  try {
    const updates = req.body;
    const project = await Project.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while updating project' });
  }
};

// @desc Delete project
// @route DELETE /api/projects/:id
// @access Private/Admin
const deleteProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });

    // Optionally disassociate tasks
    await Task.updateMany({ projectId: project._id }, { $unset: { projectId: '' } });
    await project.remove();

    return res.status(200).json({ success: true, data: {} });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while deleting project' });
  }
};

// @desc Delete multiple projects permanently
// @route DELETE /api/projects/bulk
// @access Private/Admin
const bulkDeleteProjects = async (req, res) => {
  try {
    const projectIds = Array.isArray(req.body.projectIds) ? [...new Set(req.body.projectIds)] : [];
    if (projectIds.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one project is required' });
    }

    const selectedProjects = await Project.find({ _id: { $in: projectIds } }).select('_id');
    const foundIds = selectedProjects.map((project) => project._id.toString());
    const missing = projectIds
      .filter((projectId) => !foundIds.includes(String(projectId)))
      .map((projectId) => ({ projectId, success: false, error: 'Project not found' }));

    const descendantProjects = await Promise.all(
      selectedProjects.map((project) => Project.findNodeWithDescendants(project._id).select('_id'))
    );
    const idsToDelete = [...new Set(
      descendantProjects.flat().map((project) => project._id.toString())
    )];

    await Task.updateMany({ projectId: { $in: idsToDelete } }, { $unset: { projectId: '' } });
    const deleteResult = await Project.deleteMany({ _id: { $in: idsToDelete } });
    const deleted = deleteResult.deletedCount || 0;

    return res.status(missing.length > 0 ? 207 : 200).json({
      success: missing.length === 0,
      message: `${deleted} project${deleted === 1 ? '' : 's'} deleted`,
      deleted,
      failed: missing
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while deleting projects' });
  }
};

const assignProjectToHr = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    const hr = await User.findOne({ _id: req.body.hrId, role: 'hr', status: { $in: ['approved', 'active'] } });
    if (!hr) return res.status(400).json({ success: false, error: 'A valid active HR user is required' });

    project.assignedHr = hr._id;
    project.currentReviewer = hr._id;
    await transitionProject(project, req, 'assigned_to_hr', 'assigned_to_hr', ['draft', 'rejected'], req.body.note);
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const assignProjectToManager = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    assertProjectAssignment(project, 'assignedHr', req.user._id);
    const departmentId = req.body.departmentId || req.body.assignedDepartment;
    if (!departmentId) return res.status(400).json({ success: false, error: 'A project department is required' });
    const Department = require('../models/Department');
    const department = await Department.findOne({ _id: departmentId, isActive: true });
    if (!department) return res.status(400).json({ success: false, error: 'A valid active project department is required' });
    const manager = await User.findOne({ _id: req.body.managerId, role: 'manager', status: { $in: ['approved', 'active'] } });
    if (!manager) return res.status(400).json({ success: false, error: 'A valid active manager is required' });

    project.assignedManager = manager._id;
    project.assignedDepartment = department._id;
    project.departmentId = department._id;
    await transitionProject(project, req, 'assigned_to_manager', 'assigned_to_manager', ['assigned_to_hr', 'hr_review', 'changes_requested'], req.body.note);
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const submitProjectForManagerReview = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    assertProjectAssignment(project, 'assignedManager', req.user._id);
    const tasks = await Task.find({ projectId: project._id }).select('status reviewStatus');
    const incompleteTasks = tasks.filter((task) => task.reviewStatus !== 'approved');
    if (tasks.length === 0 || incompleteTasks.length > 0) {
      const error = new Error('All project tasks must be completed and approved before manager review');
      error.statusCode = 409;
      throw error;
    }
    await transitionProject(project, req, 'manager_review', 'submitted_to_manager_review', ['in_execution', 'changes_requested'], req.body.note);
    project.currentReviewer = req.user._id;
    await project.save();
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const startProjectExecution = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    assertProjectAssignment(project, 'assignedManager', req.user._id);
    await transitionProject(project, req, 'in_execution', 'started_execution', ['assigned_to_manager', 'changes_requested'], req.body.note);
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const requestProjectChanges = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    if (req.user.role === 'manager') assertProjectAssignment(project, 'assignedManager', req.user._id);
    if (req.user.role === 'hr') assertProjectAssignment(project, 'assignedHr', req.user._id);
    if (!['manager', 'hr'].includes(req.user.role)) return res.status(403).json({ success: false, error: 'Only the manager or HR can request project changes' });
    if (!req.body.note) return res.status(400).json({ success: false, error: 'A review note is required' });
    const returnStatus = req.user.role === 'manager' ? 'changes_requested' : 'changes_requested';
    await transitionProject(project, req, returnStatus, 'changes_requested', req.user.role === 'manager' ? ['manager_review'] : ['hr_review'], req.body.note);
    project.latestReview = { note: req.body.note, requestedBy: req.user._id, requestedAt: new Date() };
    await project.save();
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const forwardProjectToHr = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    assertProjectAssignment(project, 'assignedManager', req.user._id);
    await transitionProject(project, req, 'hr_review', 'forwarded_to_hr', ['manager_review'], req.body.note, 'manager_review');
    project.currentReviewer = project.assignedHr;
    await project.save();
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const forwardProjectToCeo = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    assertProjectAssignment(project, 'assignedHr', req.user._id);
    await transitionProject(project, req, 'ceo_review', 'forwarded_to_ceo', ['hr_review'], req.body.note, 'hr_review');
    project.currentReviewer = null;
    await project.save();
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const decideProject = async (req, res) => {
  try {
    const project = await getProjectForWorkflow(req.params.id);
    if (!['approved', 'rejected'].includes(req.body.decision)) return res.status(400).json({ success: false, error: 'Decision must be approved or rejected' });
    if (req.body.decision === 'rejected' && !req.body.note) return res.status(400).json({ success: false, error: 'A rejection note is required' });
    await transitionProject(project, req, req.body.decision, `ceo_${req.body.decision}`, ['ceo_review'], req.body.note);
    project.latestReview = { note: req.body.note, requestedBy: req.user._id, requestedAt: new Date() };
    await project.save();
    return res.status(200).json({ success: true, data: project });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const uploadProjectDocument = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'A document is required' });
    const project = await getProjectForWorkflow(req.params.id);
    const stageByRole = { admin: 'ceo_assignment', hr: 'hr_assignment', manager: 'manager_assignment', employee: 'employee_submission' };
    project.documents.push({
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: `/api/projects/${project._id}/documents/${encodeURIComponent(req.file.filename)}`,
      uploadedBy: req.user._id,
      uploadedByRole: req.user.role,
      stage: stageByRole[req.user.role],
      note: req.body.note
    });
    await project.save();
    await recordAuditEvent({
      req,
      action: 'project_document_uploaded',
      resourceType: 'Project',
      resourceId: project._id,
      after: { filename: req.file.originalname, stage: stageByRole[req.user.role] },
      note: req.body.note
    });
    return res.status(201).json({ success: true, data: project.documents[project.documents.length - 1] });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const downloadProjectDocument = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .select('owner members createdBy assignedHr assignedManager documents');
    if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
    if (!canViewProject(project, req.user)) {
      return res.status(403).json({ success: false, error: 'You are not allowed to access this document' });
    }

    const safeFilename = path.basename(req.params.filename);
    const document = (project.documents || []).find((item) => item.filename === safeFilename);
    if (!document) return res.status(404).json({ success: false, error: 'Document not found' });

    const filePath = path.join(__dirname, '../uploads/projects', safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Document file is unavailable' });
    }

    return res.download(filePath, document.originalName);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to access project document' });
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  getProjectAuditEvents,
  updateProject,
  deleteProject,
  bulkDeleteProjects,
  assignProjectToHr,
  assignProjectToManager,
  startProjectExecution,
  submitProjectForManagerReview,
  requestProjectChanges,
  forwardProjectToHr,
  forwardProjectToCeo,
  decideProject,
  uploadProjectDocument,
  downloadProjectDocument
};
