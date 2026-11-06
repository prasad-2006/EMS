const Project = require('../models/Project');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Comment = require('../models/Comment');
const Decision = require('../models/Decision');
const Notification = require('../models/Notification');
const { recordAuditEvent } = require('../services/auditService');

const getProject = async (projectId, user) => {
  const project = await Project.findById(projectId).select('owner members createdBy assignedHr assignedManager');
  if (!project) {
    const error = new Error('Project not found');
    error.statusCode = 404;
    throw error;
  }
  const userId = user._id.toString();
  const canView = user.role === 'admin' || [project.owner, project.createdBy, project.assignedHr, project.assignedManager].some((id) => id && id.toString() === userId) || (user.role === 'employee' && project.members.some((id) => id.toString() === userId));
  if (!canView) {
    const error = new Error('You are not allowed to access this project collaboration');
    error.statusCode = 403;
    throw error;
  }
  return project;
};

const notifyUsers = async ({ recipients, req, title, message, actionUrl, relatedEntity }) => {
  const ids = [...new Set(recipients.filter(Boolean).map((id) => id.toString()))].filter((id) => id !== req.user._id.toString());
  if (ids.length === 0) return;
  await Notification.insertMany(ids.map((userId) => ({
    userId,
    type: 'collaboration',
    category: 'info',
    priority: 'normal',
    title,
    message,
    actionUrl,
    relatedEntity,
    sentBy: req.user._id
  })));
};

const listConversations = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const conversations = await Conversation.find({ projectId: req.params.projectId, isArchived: false })
      .populate('createdBy participants', 'name email role')
      .sort({ updatedAt: -1 });
    return res.json({ success: true, data: conversations });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const createConversation = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    const conversation = await Conversation.create({
      projectId: project._id,
      workItemId: req.body.workItemId || null,
      title: req.body.title,
      createdBy: req.user._id,
      participants: [...new Set([req.user._id.toString(), ...(req.body.participants || []).map(String)])]
    });
    await recordAuditEvent({ req, action: 'conversation_created', resourceType: 'Project', resourceId: project._id, after: { conversationId: conversation._id, title: conversation.title } });
    return res.status(201).json({ success: true, data: conversation });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listComments = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    await getProject(conversation.projectId, req.user);
    const comments = await Comment.find({ conversationId: conversation._id, isDeleted: false })
      .populate('authorId mentions', 'name email role')
      .sort({ createdAt: 1 });
    return res.json({ success: true, data: comments });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const resolveMentions = async (body) => {
  const tokens = [...new Set((String(body).match(/@[A-Za-z0-9._-]+/g) || []).map((token) => token.slice(1).toLowerCase()))];
  if (tokens.length === 0) return [];
  return User.find({ $or: tokens.flatMap((token) => [{ email: token }, { name: { $regex: `^${token}$`, $options: 'i' } }]) }).select('_id name email');
};

const createComment = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });
    await getProject(conversation.projectId, req.user);
    const mentionedUsers = await resolveMentions(req.body.body);
    const comment = await Comment.create({
      conversationId: conversation._id,
      projectId: conversation.projectId,
      workItemId: conversation.workItemId || null,
      parentCommentId: req.body.parentCommentId || null,
      authorId: req.user._id,
      body: req.body.body,
      mentions: mentionedUsers.map((user) => user._id),
      attachments: req.body.attachments || []
    });
    await Conversation.updateOne({ _id: conversation._id }, { $set: { updatedAt: new Date() }, $addToSet: { participants: { $each: mentionedUsers.map((user) => user._id) } } });
    await notifyUsers({ recipients: [...conversation.participants, ...mentionedUsers.map((user) => user._id)], req, title: 'New project discussion', message: `${req.user.name} commented in ${conversation.title}`, actionUrl: `/projects/${conversation.projectId}`, relatedEntity: { entityType: 'Conversation', entityId: conversation._id } });
    await comment.populate('authorId mentions', 'name email role');
    return res.status(201).json({ success: true, data: comment });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const editComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });
    if (comment.authorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') return res.status(403).json({ success: false, error: 'Only the comment author can edit this comment' });
    comment.body = req.body.body;
    comment.editedAt = new Date();
    await comment.save();
    return res.json({ success: true, data: comment });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const listDecisions = async (req, res) => {
  try {
    await getProject(req.params.projectId, req.user);
    const decisions = await Decision.find({ projectId: req.params.projectId }).populate('proposedBy decidedBy', 'name email role').sort({ createdAt: -1 });
    return res.json({ success: true, data: decisions });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const createDecision = async (req, res) => {
  try {
    const project = await getProject(req.params.projectId, req.user);
    const decision = await Decision.create({ ...req.body, projectId: project._id, proposedBy: req.user._id });
    await recordAuditEvent({ req, action: 'decision_proposed', resourceType: 'Decision', resourceId: decision._id, after: { projectId: project._id, title: decision.title, status: decision.status } });
    await notifyUsers({ recipients: [project.assignedManager, project.assignedHr, ...project.members], req, title: 'Project decision proposed', message: `${req.user.name} proposed a decision: ${decision.title}`, actionUrl: `/projects/${project._id}`, relatedEntity: { entityType: 'Decision', entityId: decision._id } });
    return res.status(201).json({ success: true, data: decision });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

const updateDecision = async (req, res) => {
  try {
    const decision = await Decision.findById(req.params.id);
    if (!decision) return res.status(404).json({ success: false, error: 'Decision not found' });
    const project = await getProject(decision.projectId, req.user);
    const canDecide = req.user.role === 'admin' || (project.assignedManager && project.assignedManager.toString() === req.user._id.toString()) || (project.assignedHr && project.assignedHr.toString() === req.user._id.toString());
    if (!canDecide) return res.status(403).json({ success: false, error: 'Only the project decision owners can update this decision' });
    Object.assign(decision, req.body);
    if (['approved', 'rejected', 'superseded'].includes(decision.status)) {
      decision.decidedBy = req.user._id;
      decision.decidedAt = new Date();
    }
    await decision.save();
    await recordAuditEvent({ req, action: `decision_${decision.status}`, resourceType: 'Decision', resourceId: decision._id, after: { status: decision.status, decision: decision.decision } });
    return res.json({ success: true, data: decision });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
};

module.exports = { listConversations, createConversation, listComments, createComment, editComment, listDecisions, createDecision, updateDecision };
