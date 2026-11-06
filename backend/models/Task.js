const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: [200, 'Task title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Assignee is required'],
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  latestSubmissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    index: true
  },
  parentTaskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    index: true,
    default: null
  },
  deadline: {
    type: Date,
    index: true
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurringFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', null],
    default: null
  },
  recurringDays: [{
    type: Number,
    min: 0,
    max: 6
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
    index: true
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'review', 'done', 'cancelled', 'rejected'],
    default: 'todo',
    index: true
  },
  reviewStatus: {
    type: String,
    enum: ['not_submitted', 'submitted', 'changes_requested', 'approved'],
    default: 'not_submitted',
    index: true
  },
  submission: {
    repositoryUrl: { type: String, trim: true },
    pullRequestUrl: { type: String, trim: true },
    documentationLinks: [{ type: String, trim: true }],
    completionNotes: { type: String, trim: true, maxlength: 5000 },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: Date
  },
  submissionHistory: [{
    repositoryUrl: { type: String, trim: true },
    pullRequestUrl: { type: String, trim: true },
    documentationLinks: [{ type: String, trim: true }],
    completionNotes: { type: String, trim: true, maxlength: 5000 },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    submittedAt: { type: Date, default: Date.now },
    reviewStatus: { type: String, enum: ['submitted', 'changes_requested', 'approved'] },
    reviewNote: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date
  }],
  category: {
    type: String,
    enum: ['development', 'design', 'testing', 'documentation', 'meeting', 'admin', 'other'],
    default: 'other'
  },
  tags: [{
    type: String,
    trim: true
  }],
  estimatedHours: {
    type: Number,
    min: 0
  },
  actualHours: {
    type: Number,
    min: 0,
    default: 0
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  watchers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }],
  rejectionFeedback: [{
    reason: { type: String, required: true },
    correctionsRequired: { type: String, required: true },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date, default: Date.now }
  }],
  attachments: [{
    filename: String,
    storedFilename: String,
    url: String,
    fileSize: Number,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Handover Fields
  handoverNote: {
    type: String,
    trim: true,
    maxlength: [1000, 'Handover note cannot exceed 1000 characters']
  },
  handedOverTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  handoverStatus: {
    type: String,
    enum: ['none', 'pending', 'accepted', 'rejected', 'completed', 'deferred'],
    default: 'none'
  },
  handoverRequestedAt: Date,
  handoverAcceptedAt: Date,
  handoverCompletedAt: Date,
  handoverRejectedReason: String,
  // For tracking if this is a task that was deferred to after leave
  deferredUntil: {
    type: Date
  },
  isDeferred: {
    type: Boolean,
    default: false
  },
  // Related leave for which this task was flagged
  relatedLeaveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
    index: true
  },
  // Leave coverage: a peer accepted to complete this task while the original
  // assignee is on leave. The covering employee is paid extra for the task.
  isCoverageTask: {
    type: Boolean,
    default: false,
    index: true
  },
  coverageBonus: {
    type: Number,
    default: 0,
    min: 0
  },
  coverageLeaveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest',
    index: true
  },
  coverageAcceptedAt: Date,
  coveredFor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedTo: 1, deadline: 1 });
taskSchema.index({ handedOverTo: 1, handoverStatus: 1 });
taskSchema.index({ relatedLeaveId: 1 });

// Virtual for checking if task is overdue
taskSchema.virtual('isOverdue').get(function() {
  if (!this.deadline || this.status === 'done' || this.status === 'cancelled') {
    return false;
  }
  return new Date() > this.deadline;
});

// Virtual for checking if deadline conflicts with a date range
taskSchema.virtual('conflictsWithLeave').get(function() {
  return function(startDate, endDate) {
    if (!this.deadline) return false;
    return this.deadline >= startDate && this.deadline <= endDate;
  };
});

// Static method to find tasks that conflict with leave period
taskSchema.statics.findConflictTasks = async function(userId, startDate, endDate) {
  return this.find({
    assignedTo: userId,
    status: { $nin: ['done', 'cancelled'] },
    $or: [
      {
        // Tasks with deadlines in the leave period
        deadline: { $gte: startDate, $lte: endDate }
      },
      {
        // Recurring tasks
        isRecurring: true
      }
    ]
  }).populate('assignedTo', 'name email').populate('handedOverTo', 'name email');
};

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;