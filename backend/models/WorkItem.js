const mongoose = require('mongoose');

const workItemSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  legacyTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem', default: null, index: true },
  type: { type: String, enum: ['epic', 'feature', 'story', 'task', 'bug', 'subtask'], default: 'task', index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  status: { type: String, enum: ['backlog', 'ready', 'assigned', 'in-progress', 'blocked', 'review', 'changes_requested', 'approved', 'done', 'cancelled'], default: 'backlog', index: true },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  reviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  milestoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Milestone', index: true },
  acceptanceCriteria: [{ type: String, trim: true, maxlength: 1000 }],
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem' }],
  estimateHours: { type: Number, min: 0 },
  actualHours: { type: Number, min: 0, default: 0 },
  deadline: { type: Date, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  completedAt: Date
}, { timestamps: true });

workItemSchema.index({ projectId: 1, status: 1 });
workItemSchema.index({ projectId: 1, milestoneId: 1 });

module.exports = mongoose.model('WorkItem', workItemSchema);
