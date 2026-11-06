const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  leaveType: {
    type: String,
    enum: ['casual', 'sick', 'earned', 'wfh', 'emergency'],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  halfDayType: {
    type: String,
    enum: ['first_half', 'second_half', 'full_day'],
    default: 'full_day'
  },
  attachments: [{
    filename: String,
    url: String,
    fileSize: Number,
    mimeType: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  approvalLevel: {
    type: String,
    enum: ['manager', 'hr', 'admin'],
    default: 'manager'
  },
  approvalWorkflow: [{
    stage: { type: String, enum: ['manager', 'hr', 'admin'] },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'skipped'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    comment: String,
    escalatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    completedAt: Date
  }],
  workflowStage: {
    type: String,
    enum: [
      'draft',
      'submitted',
      'validation',
      'manager_review',
      'approved',
      'impact_analysis',
      'handover_pending',
      'handover_completed',
      'backup_assigned',
      'tasks_reassigned',
      'leave_active',
      'employee_returned',
      'tasks_restored',
      'closed'
    ],
    default: 'submitted',
    index: true
  },
  workflowStageHistory: [{
    stage: {
      type: String,
      enum: [
        'draft',
        'submitted',
        'validation',
        'manager_review',
        'approved',
        'impact_analysis',
        'handover_pending',
        'handover_completed',
        'backup_assigned',
        'tasks_reassigned',
        'leave_active',
        'employee_returned',
        'tasks_restored',
        'closed'
      ]
    },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: String
  }],
  managerApproval: {
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    comment: String,
    delegatedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reminderSentAt: Date
  },
  hrApproval: {
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'not_required'], default: 'not_required' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    comment: String,
    reminderSentAt: Date
  },
  startDate: {
    type: Date,
    required: true,
    index: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true,
    validate: {
      validator: function(value) {
        return value >= this.startDate;
      },
      message: 'End date must be after or equal to start date'
    }
  },
  totalDays: {
    type: Number,
    required: true,
    min: [0.5, 'Leave duration must be at least 0.5 days'],
    max: [90, 'Leave duration cannot exceed 90 days']
  },
  dayCalculation: {
    calendarDays: { type: Number, default: 0 },
    chargeableDays: { type: Number, default: 0 },
    weekendsExcluded: { type: Number, default: 0 },
    holidaysExcluded: { type: Number, default: 0 },
    weekendCountedAsLeave: { type: Boolean, default: false },
    holidayCountedAsLeave: { type: Boolean, default: false }
  },
  coverageAssessment: {
    riskLevel: { type: String, enum: ['safe', 'risky', 'blocked'], default: 'safe' },
    projectedCoveragePercentage: { type: Number, default: 0 },
    warningThreshold: { type: Number, default: 30 },
    blockThreshold: { type: Number, default: 50 },
    evaluatedAt: Date,
    reason: String
  },
  taskConflictSummary: {
    total: { type: Number, default: 0 },
    urgentCount: { type: Number, default: 0 },
    nonUrgentCount: { type: Number, default: 0 },
    requiresReplacement: { type: Boolean, default: false },
    evaluatedAt: Date
  },
  requiresAdminTaskApproval: {
    type: Boolean,
    default: false
  },
  reason: {
    type: String,
    required: [true, 'Reason is required'],
    trim: true,
    minlength: [10, 'Reason must be at least 10 characters'],
    maxlength: [1000, 'Reason cannot exceed 1000 characters']
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected', 'cancelled', 'expired', 'withdrawn'],
    default: 'pending',
    index: true
  },
  previousStatus: String,
  statusHistory: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    reason: String
  }],
  adminComment: {
    type: String,
    trim: true,
    maxlength: [1000, 'Admin comment cannot exceed 1000 characters']
  },
  internalNotes: [{
    note: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now },
    visibility: { type: String, enum: ['admin_only', 'approvers', 'all'], default: 'admin_only' }
  }],
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  cancelledAt: Date,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancellationReason: String,
  handoverTo: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    description: String,
    confirmedAt: Date
  },
  emergencyContactDuringLeave: {
    name: String,
    relationship: String,
    phoneNumber: String
  },
  returnDate: Date,
  actualReturnDate: Date,
  extendedDays: { type: Number, default: 0 },
  extensionRequests: [{
    additionalDays: Number,
    newEndDate: Date,
    reason: String,
    requestedAt: { type: Date, default: Date.now },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  }],
  conflictsWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest'
  }],
  replacementArranged: {
    type: Boolean,
    default: false
  },
  replacementUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Total deduction amount for this leave (calculated when distributions are evaluated)
  deductionTotal: {
    type: Number,
    default: 0
  },
  // Distribution of the leave deduction to covering users.
  // Each entry: who receives how much and which tasks contributed.
  deductionDistribution: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: { type: Number, default: 0 },
    taskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }]
  }],
  deductionDistributedAt: Date,
  isRecurring: { type: Boolean, default: false },
  recurringPattern: {
    frequency: { type: String, enum: ['weekly', 'monthly', 'yearly'] },
    endDate: Date
  },
  tags: [String],
  appliedVia: {
    type: String,
    enum: ['web', 'mobile', 'email', 'admin'],
    default: 'web'
  },
  ipAddress: String,
  deviceInfo: String,
  version: { type: Number, default: 1 },
  isDeleted: { type: Boolean, default: false, select: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for performance
leaveRequestSchema.index({ userId: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });
leaveRequestSchema.index({ status: 1, startDate: 1 });
leaveRequestSchema.index({ leaveType: 1, status: 1 });
leaveRequestSchema.index({ 'managerApproval.approvedBy': 1, 'managerApproval.status': 1 });
leaveRequestSchema.index({ createdAt: -1 });

// Virtual: Calculate business days
leaveRequestSchema.virtual('businessDays').get(function() {
  let count = 0;
  const start = new Date(this.startDate);
  const end = new Date(this.endDate);
  
  while (start <= end) {
    const dayOfWeek = start.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    start.setDate(start.getDate() + 1);
  }
  
  return count;
});

// Virtual: Check if leave is upcoming
leaveRequestSchema.virtual('isUpcoming').get(function() {
  return this.status === 'approved' && new Date(this.startDate) > new Date();
});

// Virtual: Check if leave is active/ongoing
leaveRequestSchema.virtual('isOngoing').get(function() {
  const now = new Date();
  return this.status === 'approved' && 
         new Date(this.startDate) <= now && 
         new Date(this.endDate) >= now;
});

// Virtual: Check if leave has expired (pending too long)
leaveRequestSchema.virtual('isExpired').get(function() {
  if (this.status !== 'pending') return false;
  const daysSinceApplication = (new Date() - this.createdAt) / (1000 * 60 * 60 * 24);
  return daysSinceApplication > 30; // Expire after 30 days
});

// Virtual: Days until leave starts
leaveRequestSchema.virtual('daysUntilStart').get(function() {
  return Math.ceil((new Date(this.startDate) - new Date()) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware: Track status changes
leaveRequestSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date(),
      reason: this.adminComment
    });
    this.previousStatus = this.statusHistory[this.statusHistory.length - 2]?.status || 'pending';
  }
  next();
});

leaveRequestSchema.methods.advanceWorkflowStage = function(stage, changedBy, note) {
  if (!stage) return;

  this.workflowStage = stage;
  this.workflowStageHistory = this.workflowStageHistory || [];
  this.workflowStageHistory.push({
    stage,
    changedBy,
    note,
    changedAt: new Date()
  });
};

// Pre-save middleware: Validate against overlapping leaves
leaveRequestSchema.pre('save', async function(next) {
  if (!this.isNew && !this.isModified('startDate') && !this.isModified('endDate')) {
    return next();
  }
  
  const overlapping = await this.constructor.findOne({
    _id: { $ne: this._id },
    userId: this.userId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: this.endDate }, endDate: { $gte: this.startDate } }
    ]
  });
  
  if (overlapping) {
    const err = new Error('Leave request overlaps with existing leave');
    err.code = 'LEAVE_OVERLAP';
    return next(err);
  }
  
  next();
});

// Soft delete query middleware
leaveRequestSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Instance method: Approve leave
leaveRequestSchema.methods.approve = async function(approverId, comment, session) {
  this.status = 'approved';
  this.reviewedBy = approverId;
  this.reviewedAt = new Date();
  if (comment) this.adminComment = comment;
  
  this.managerApproval.status = 'approved';
  this.managerApproval.approvedBy = approverId;
  this.managerApproval.approvedAt = new Date();
  
  return this.save({ session });
};

// Instance method: Reject leave
leaveRequestSchema.methods.reject = async function(approverId, reason, session) {
  this.status = 'rejected';
  this.reviewedBy = approverId;
  this.reviewedAt = new Date();
  this.adminComment = reason;
  
  this.managerApproval.status = 'rejected';
  this.managerApproval.approvedBy = approverId;
  this.managerApproval.approvedAt = new Date();
  this.managerApproval.comment = reason;
  
  return this.save({ session });
};

// Instance method: Cancel leave
leaveRequestSchema.methods.cancel = async function(userId, reason) {
  this.status = 'cancelled';
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

// Instance method: Check for conflicts
leaveRequestSchema.methods.checkConflicts = async function(threshold = 3) {
  const conflicts = await this.constructor.find({
    _id: { $ne: this._id },
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: this.endDate },
    endDate: { $gte: this.startDate }
  }).populate('userId', 'name department');
  
  const conflictCount = conflicts.length;
  this.conflictsWith = conflicts.map(c => c._id);
  
  return {
    hasConflict: conflictCount >= threshold,
    count: conflictCount,
    requests: conflicts
  };
};

// Static method: Find overlapping leaves
leaveRequestSchema.statics.findOverlapping = function(startDate, endDate, excludeIds = []) {
  return this.find({
    _id: { $nin: excludeIds },
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ]
  }).populate('userId', 'name email department');
};

// Static method: Get leave statistics
leaveRequestSchema.statics.getStatistics = async function(filters = {}) {
  const match = { isDeleted: false };
  if (filters.startDate) match.startDate = { $gte: new Date(filters.startDate) };
  if (filters.endDate) match.endDate = { $lte: new Date(filters.endDate) };
  if (filters.status) match.status = filters.status;
  if (filters.leaveType) match.leaveType = filters.leaveType;
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$leaveType',
        count: { $sum: 1 },
        totalDays: { $sum: '$totalDays' },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        }
      }
    }
  ]);
};

// Instance method: Request extension
leaveRequestSchema.methods.requestExtension = async function(additionalDays, reason) {
  if (['rejected', 'cancelled', 'withdrawn'].includes(this.status)) {
    throw new Error('Cannot extend cancelled or rejected leave');
  }
  
  if (!this.isOngoing && !this.isUpcoming) {
    throw new Error('Can only extend ongoing or upcoming leaves');
  }
  
  const newEndDate = new Date(this.endDate);
  newEndDate.setDate(newEndDate.getDate() + additionalDays);
  
  this.extensionRequests.push({
    additionalDays,
    newEndDate,
    reason,
    status: 'pending'
  });
  
  return this.save();
};

// Instance method: Add internal note
leaveRequestSchema.methods.addInternalNote = async function(note, userId, visibility = 'admin_only') {
  this.internalNotes.push({
    note,
    addedBy: userId,
    visibility
  });
  return this.save();
};

// Instance method: Check if can be withdrawn
leaveRequestSchema.methods.canBeWithdrawn = function() {
  if (!['pending', 'approved'].includes(this.status)) return false;
  // Cannot withdraw if leave starts within 48 hours
  const hoursUntilStart = (new Date(this.startDate) - new Date()) / (1000 * 60 * 60);
  return hoursUntilStart > 48;
};

// Instance method: Withdraw request
leaveRequestSchema.methods.withdraw = async function(userId, reason) {
  if (!this.canBeWithdrawn()) {
    throw new Error('Cannot withdraw leave request');
  }
  this.status = 'withdrawn';
  this.cancelledBy = userId;
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.save();
};

// Instance method: Get approval status summary
leaveRequestSchema.methods.getApprovalSummary = function() {
  return {
    overall: this.status,
    manager: this.managerApproval.status,
    hr: this.hrApproval.status,
    timeline: {
      applied: this.createdAt,
      approved: this.reviewedAt,
      daysSinceApplied: Math.ceil((new Date() - this.createdAt) / (1000 * 60 * 60 * 24))
    },
    approvers: {
      manager: this.managerApproval.approvedBy,
      hr: this.hrApproval.approvedBy
    }
  };
};

// Instance method: Archive leave request
leaveRequestSchema.methods.archive = async function(archivedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = archivedBy;
  return this.save();
};

// Instance method: Validate against policy
leaveRequestSchema.methods.validateAgainstPolicy = async function(policy) {
  const violations = [];
  
  const leavePolicy = policy.leaveTypes[this.leaveType];
  if (!leavePolicy) {
    violations.push(`No policy defined for ${this.leaveType} leave`);
    return { valid: false, violations };
  }
  
  if (this.totalDays > leavePolicy.maxConsecutive) {
    violations.push(`Cannot take more than ${leavePolicy.maxConsecutive} consecutive ${this.leaveType} days`);
  }
  
  if (leavePolicy.requiresApproval && !this.managerApproval.approvedBy) {
    violations.push(`${this.leaveType} leave requires approval`);
  }
  
  if (leavePolicy.noticePeriodDays && this.daysUntilStart < leavePolicy.noticePeriodDays) {
    violations.push(`Minimum notice period of ${leavePolicy.noticePeriodDays} days required`);
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
};

// Static method: Get pending approvals for user
leaveRequestSchema.statics.getPendingApprovals = function(managerId) {
  return this.find({
    $or: [
      { 'managerApproval.approvedBy': managerId, 'managerApproval.status': 'pending' },
      { 'hrApproval.approvedBy': managerId, 'hrApproval.status': 'pending' }
    ]
  }).sort({ createdAt: 1 });
};

// Static method: Get overdue approvals
leaveRequestSchema.statics.getOverdueApprovals = function(dayThreshold = 3) {
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - dayThreshold);
  
  return this.find({
    status: 'pending',
    createdAt: { $lt: threshold }
  }).populate('userId', 'name email');
};

// Static method: Bulk approve
leaveRequestSchema.statics.bulkApprove = async function(requestIds, approverId, comment) {
  return this.updateMany(
    { _id: { $in: requestIds } },
    {
      status: 'approved',
      'managerApproval.status': 'approved',
      'managerApproval.approvedBy': approverId,
      'managerApproval.approvedAt': new Date(),
      'managerApproval.comment': comment,
      reviewedBy: approverId,
      reviewedAt: new Date()
    }
  );
};

// Static method: Bulk reject
leaveRequestSchema.statics.bulkReject = async function(requestIds, approverId, reason) {
  return this.updateMany(
    { _id: { $in: requestIds } },
    {
      status: 'rejected',
      'managerApproval.status': 'rejected',
      'managerApproval.approvedBy': approverId,
      'managerApproval.approvedAt': new Date(),
      'managerApproval.comment': reason,
      adminComment: reason,
      reviewedBy: approverId,
      reviewedAt: new Date()
    }
  );
};

// Static method: Get leave summary for user
leaveRequestSchema.statics.getUserLeaveSummary = async function(userId, year = new Date().getFullYear()) {
  const startOfYear = new Date(`${year}-01-01`);
  const endOfYear = new Date(`${year}-12-31`);
  
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        startDate: { $gte: startOfYear, $lte: endOfYear },
        status: { $in: ['approved', 'pending'] }
      }
    },
    {
      $group: {
        _id: '$leaveType',
        totalDays: { $sum: '$totalDays' },
        count: { $sum: 1 },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$totalDays', 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$totalDays', 0] }
        }
      }
    }
  ]);
};

// Instance method: Can user return from leave
leaveRequestSchema.methods.canReturnFromLeave = function() {
  return this.status === 'approved' && this.isOngoing;
};

// Instance method: Mark return
leaveRequestSchema.methods.markReturn = async function(actualReturnDate) {
  if (!this.canReturnFromLeave()) {
    throw new Error('Cannot mark return for this leave');
  }
  this.actualReturnDate = actualReturnDate || new Date();
  return this.save();
};

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
