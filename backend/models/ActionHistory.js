const mongoose = require('mongoose');

const actionHistorySchema = new mongoose.Schema({
  actionType: {
    type: String,
    enum: ['approve', 'reject', 'undo_approve', 'undo_reject', 'leave_approved', 'leave_rejected', 'leave_cancelled'],
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUserName: {
    type: String,
    required: true
  },
  targetUserEmail: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedByName: {
    type: String,
    required: true
  },
  previousStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    required: true
  },
  newStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    required: true
  },
  isUndone: {
    type: Boolean,
    default: false
  },
  leaveRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeaveRequest'
  },
  reason: {
    type: String,
    trim: true,
    maxlength: [2000, 'Reason cannot exceed 2000 characters']
  },
  comments: {
    type: String,
    trim: true,
    maxlength: [2000, 'Comments cannot exceed 2000 characters']
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    departmentAtTime: String,
    roleAtTime: String,
    customFields: mongoose.Schema.Types.Mixed
  },
  attachment: {
    fileName: String,
    fileUrl: String,
    uploadedAt: Date
  },
  relatedActions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ActionHistory'
  }],
  isArchived: {
    type: Boolean,
    default: false
  },
  archivedAt: Date,
  complianceDetails: {
    requiresAudit: { type: Boolean, default: false },
    auditedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    auditedAt: Date,
    auditComments: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
actionHistorySchema.index({ createdAt: -1 });
actionHistorySchema.index({ targetUser: 1, createdAt: -1 });
actionHistorySchema.index({ performedBy: 1, createdAt: -1 });
actionHistorySchema.index({ actionType: 1, createdAt: -1 });
actionHistorySchema.index({ leaveRequestId: 1 });
actionHistorySchema.index({ 'complianceDetails.requiresAudit': 1, 'complianceDetails.auditedAt': 1 });

// Virtual: Hours since action
actionHistorySchema.virtual('hoursSinceAction').get(function() {
  const diff = Date.now() - this.createdAt;
  return Math.floor(diff / (1000 * 60 * 60));
});

// Virtual: Days since action
actionHistorySchema.virtual('daysSinceAction').get(function() {
  const diff = Date.now() - this.createdAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Instance method: Archive action
actionHistorySchema.methods.archive = async function() {
  this.isArchived = true;
  this.archivedAt = new Date();
  return this.save();
};

// Instance method: Mark for audit
actionHistorySchema.methods.markForAudit = async function() {
  this.complianceDetails.requiresAudit = true;
  return this.save();
};

// Instance method: Complete audit
actionHistorySchema.methods.completeAudit = async function(auditedBy, comments) {
  this.complianceDetails.auditedBy = auditedBy;
  this.complianceDetails.auditedAt = new Date();
  this.complianceDetails.auditComments = comments;
  this.complianceDetails.requiresAudit = false;
  return this.save();
};

// Instance method: Link related actions
actionHistorySchema.methods.linkRelatedActions = async function(actionIds) {
  this.relatedActions = [...new Set([...this.relatedActions, ...actionIds])];
  return this.save();
};

// Instance method: Get approval chain
actionHistorySchema.methods.getApprovalChain = async function() {
  if (!this.relatedActions || this.relatedActions.length === 0) {
    return [this];
  }
  
  return ActionHistory.find({
    _id: { $in: [...this.relatedActions, this._id] }
  }).sort({ createdAt: 1 }).populate('performedBy', 'name email role');
};

// Static method: Get user timeline
actionHistorySchema.statics.getTimeline = async function(userId, options = {}) {
  const limit = options.limit || 100;
  const offset = options.offset || 0;
  const startDate = options.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Last 1 year
  const endDate = options.endDate || new Date();
  
  const query = {
    targetUser: userId,
    createdAt: { $gte: startDate, $lte: endDate }
  };
  
  if (options.actionType) {
    query.actionType = options.actionType;
  }
  
  const actions = await this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .populate('performedBy', 'name email role')
    .populate('leaveRequestId', 'leaveType startDate endDate');
  
  const total = await this.countDocuments(query);
  
  return {
    actions,
    total,
    pages: Math.ceil(total / limit)
  };
};

// Static method: Get approval history for leave request
actionHistorySchema.statics.getApprovalHistory = async function(leaveRequestId) {
  return this.find({
    leaveRequestId,
    actionType: { $in: ['approve', 'reject', 'undo_approve', 'undo_reject'] }
  })
  .sort({ createdAt: 1 })
  .populate('performedBy', 'name email role department');
};

// Static method: Generate user audit report
actionHistorySchema.statics.generateAuditReport = async function(userId, startDate, endDate) {
  const actions = await this.find({
    targetUser: userId,
    createdAt: { $gte: startDate, $lte: endDate }
  })
  .sort({ createdAt: 1 })
  .populate('performedBy', 'name email role')
  .populate('leaveRequestId', 'leaveType startDate endDate totalDays');
  
  const summary = await this.aggregate([
    {
      $match: {
        targetUser: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: '$actionType',
        count: { $sum: 1 }
      }
    }
  ]);
  
  return {
    userId,
    period: { startDate, endDate },
    totalActions: actions.length,
    actions,
    summary
  };
};

// Static method: Get actions by type
actionHistorySchema.statics.getByActionType = async function(actionType, options = {}) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
  
  return this.find({
    actionType,
    createdAt: { $gte: startDate }
  })
  .sort({ createdAt: -1 })
  .skip(offset)
  .limit(limit)
  .populate('targetUser', 'name email')
  .populate('performedBy', 'name email role');
};

// Static method: Get all modifications affecting user
actionHistorySchema.statics.getUserModifications = async function(userId) {
  return this.find({
    $or: [
      { targetUser: userId },
      { performedBy: userId }
    ]
  })
  .sort({ createdAt: -1 })
  .populate('targetUser', 'name email')
  .populate('performedBy', 'name email role');
};

// Static method: Get actions requiring audit
actionHistorySchema.statics.getUnauditedActions = function() {
  return this.find({
    'complianceDetails.requiresAudit': true,
    'complianceDetails.auditedAt': null
  })
  .sort({ createdAt: 1 })
  .populate('performedBy', 'name email')
  .populate('targetUser', 'name email');
};

// Static method: Bulk archive old actions
actionHistorySchema.statics.bulkArchiveOld = async function(olderThanDays = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  return this.updateMany(
    { createdAt: { $lte: cutoffDate }, isArchived: false },
    { $set: { isArchived: true, archivedAt: new Date() } }
  );
};

// Static method: Get performance timeline
actionHistorySchema.statics.getPerformanceTimeline = async function(userId, startDate, endDate) {
  const actions = await this.aggregate([
    {
      $match: {
        targetUser: mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m', date: '$createdAt' }
        },
        approved: {
          $sum: { $cond: [{ $eq: ['$newStatus', 'approved'] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$newStatus', 'rejected'] }, 1, 0] }
        },
        total: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  return actions;
};

// Static method: Get action statistics
actionHistorySchema.statics.getStatistics = async function(options = {}) {
  const startDate = options.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const endDate = options.endDate || new Date();
  
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $facet: {
        byType: [
          { $group: { _id: '$actionType', count: { $sum: 1 } } }
        ],
        byPerformer: [
          { $group: { _id: '$performedBy', count: { $sum: 1 } } },
          { $limit: 10 }
        ],
        undoOperations: [
          {
            $match: {
              actionType: { $in: ['undo_approve', 'undo_reject'] }
            }
          },
          { $group: { _id: '$actionType', count: { $sum: 1 } } }
        ]
      }
    }
  ]);
};

// Static method: Compliance report
actionHistorySchema.statics.getComplianceReport = async function(startDate, endDate) {
  const unauditedCount = await this.countDocuments({
    'complianceDetails.requiresAudit': true,
    'complianceDetails.auditedAt': null,
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  const auditedCount = await this.countDocuments({
    'complianceDetails.auditedAt': { $ne: null },
    createdAt: { $gte: startDate, $lte: endDate }
  });
  
  const criticalActions = await this.find({
    actionType: { $in: ['approve', 'reject'] },
    createdAt: { $gte: startDate, $lte: endDate }
  }).limit(100);
  
  return {
    period: { startDate, endDate },
    auditingStatus: {
      unaudited: unauditedCount,
      audited: auditedCount,
      complianceRate: auditedCount / (auditedCount + unauditedCount)
    },
    criticalActions
  };
};

// Static method: Export audit trail
actionHistorySchema.statics.exportAuditTrail = async function(userId, startDate, endDate) {
  return this.find({
    targetUser: userId,
    createdAt: { $gte: startDate, $lte: endDate }
  })
  .sort({ createdAt: 1 })
  .populate('performedBy', 'name email role')
  .populate('leaveRequestId')
  .lean();
};

module.exports = mongoose.model('ActionHistory', actionHistorySchema);
