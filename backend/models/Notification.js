const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  recipientGroup: {
    type: String,
    enum: ['individual', 'department', 'role', 'all', 'custom'],
    default: 'individual'
  },
  recipientFilter: {
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    roles: [{ type: String, enum: ['employee', 'manager', 'hr', 'admin', 'auditor'] }],
    locations: [String],
    customUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  type: {
    type: String,
    enum: ['account', 'leave', 'system', 'policy', 'holiday', 'alert', 'reminder', 'approval', 'announcement', 'project', 'collaboration', 'decision'],
    default: 'system',
    index: true
  },
  category: {
    type: String,
    enum: ['info', 'warning', 'error', 'success'],
    default: 'info'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  shortMessage: {
    type: String,
    trim: true,
    maxlength: [100, 'Short message cannot exceed 100 characters']
  },
  htmlContent: String, // Rich text HTML version
  isRead: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: Date,
  isClicked: {
    type: Boolean,
    default: false
  },
  clickedAt: Date,
  isDismissed: {
    type: Boolean,
    default: false
  },
  dismissedAt: Date,
  actionRequired: {
    type: Boolean,
    default: false
  },
  actionUrl: String, // Deep link or route path
  actionLabel: String, // e.g., "View Request", "Approve Now"
  actionData: mongoose.Schema.Types.Mixed, // Additional context for action
  actionCompleted: {
    type: Boolean,
    default: false
  },
  actionCompletedAt: Date,
  expiresAt: Date,
  scheduledFor: Date, // Future delivery time
  deliveryStatus: {
    status: {
      type: String,
      enum: ['scheduled', 'pending', 'delivered', 'read', 'clicked', 'expired', 'failed'],
      default: 'pending'
    },
    deliveredAt: Date,
    failedAt: Date,
    errorMessage: String
  },
  deliveryChannels: {
    web: { type: Boolean, default: true },
    email: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
    push: { type: Boolean, default: false }
  },
  emailStatus: {
    sent: { type: Boolean, default: false },
    sentAt: Date,
    opened: { type: Boolean, default: false },
    openedAt: Date,
    failed: { type: Boolean, default: false },
    error: String
  },
  smsStatus: {
    sent: { type: Boolean, default: false },
    sentAt: Date,
    delivered: { type: Boolean, default: false },
    deliveredAt: Date,
    failed: { type: Boolean, default: false },
    error: String
  },
  metadata: {
    leaveId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeaveRequest'
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicy'
    },
    holidayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Holiday'
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    customData: mongoose.Schema.Types.Mixed
  },
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['LeaveRequest', 'User', 'Department', 'Holiday', 'LeavePolicy', 'ActionHistory', 'Project', 'WorkItem', 'Conversation', 'Decision']
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedEntity.entityType'
    }
  },
  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  sentBySystem: {
    type: Boolean,
    default: false
  },
  templateId: String, // Reference to notification template
  templateData: mongoose.Schema.Types.Mixed, // Data for template rendering
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    fileSize: Number
  }],
  tags: [String],
  retryCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  lastRetryAt: Date,
  batchId: String, // For grouping bulk notifications
  parentNotificationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification'
  },
  isDeleted: {
    type: Boolean,
    default: false,
    select: false
  },
  deletedAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, type: 1, isRead: 1 });
notificationSchema.index({ userId: 1, priority: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ scheduledFor: 1, 'deliveryStatus.status': 1 });
notificationSchema.index({ batchId: 1 });
notificationSchema.index({ 'deliveryStatus.status': 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });

// Virtual: Check if notification is expired
notificationSchema.virtual('isExpired').get(function() {
  return this.expiresAt && this.expiresAt < new Date();
});

// Virtual: Check if notification is unread
notificationSchema.virtual('isUnread').get(function() {
  return !this.isRead;
});

// Virtual: Check if scheduled notification is pending
notificationSchema.virtual('isPending').get(function() {
  return this.scheduledFor && this.scheduledFor > new Date();
});

// Virtual: Days since notification was created
notificationSchema.virtual('daysSinceCreated').get(function() {
  const diff = Date.now() - this.createdAt;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// Virtual: Time until expiration
notificationSchema.virtual('timeUntilExpiration').get(function() {
  if (!this.expiresAt || this.isExpired) return 0;
  return this.expiresAt - new Date();
});

// Pre-save middleware: Set short message if not provided
notificationSchema.pre('save', function(next) {
  if (!this.shortMessage && this.message) {
    this.shortMessage = this.message.substring(0, 97) + (this.message.length > 97 ? '...' : '');
  }
  next();
});

// Pre-save middleware: Update delivery status
notificationSchema.pre('save', function(next) {
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
    this.deliveryStatus.status = 'read';
  }
  
  if (this.isModified('isClicked') && this.isClicked && !this.clickedAt) {
    this.clickedAt = new Date();
    this.deliveryStatus.status = 'clicked';
  }
  
  next();
});

// Soft delete query middleware
notificationSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Instance method: Mark as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    this.deliveryStatus.status = 'read';
    return this.save();
  }
  return this;
};

// Instance method: Mark as clicked
notificationSchema.methods.markAsClicked = async function() {
  this.isClicked = true;
  this.clickedAt = new Date();
  this.deliveryStatus.status = 'clicked';
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
  }
  return this.save();
};

// Instance method: Dismiss notification
notificationSchema.methods.dismiss = async function() {
  this.isDismissed = true;
  this.dismissedAt = new Date();
  return this.save();
};

// Instance method: Schedule notification
notificationSchema.methods.schedule = async function(scheduledTime) {
  this.scheduledFor = scheduledTime;
  this.deliveryStatus.status = 'scheduled';
  return this.save();
};

// Instance method: Retry failed notification
notificationSchema.methods.retry = async function() {
  if (this.retryCount >= 5) {
    throw new Error('Maximum retry attempts reached');
  }
  
  this.retryCount += 1;
  this.lastRetryAt = new Date();
  this.deliveryStatus.status = 'pending';
  this.deliveryStatus.failedAt = null;
  this.deliveryStatus.errorMessage = null;
  
  return this.save();
};

// Instance method: Mark as failed
notificationSchema.methods.markAsFailed = async function(errorMessage) {
  this.deliveryStatus.status = 'failed';
  this.deliveryStatus.failedAt = new Date();
  this.deliveryStatus.errorMessage = errorMessage;
  return this.save();
};

// Static method: Find unread notifications for user
notificationSchema.statics.findUnreadByUser = function(userId, limit = 50) {
  return this.find({
    userId,
    isRead: false,
    isDeleted: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gte: new Date() } }
    ]
  })
  .sort({ priority: -1, createdAt: -1 })
  .limit(limit);
};

// Static method: Get notification count by type
notificationSchema.statics.getCountByType = async function(userId) {
  return this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        isDeleted: false,
        isRead: false
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);
};

// Static method: Find group notifications (department/role/all)
notificationSchema.statics.findGroupNotifications = async function(user) {
  return this.find({
    isDeleted: false,
    $or: [
      { userId: user._id },
      {
        recipientGroup: 'all',
        createdAt: { $gte: user.createdAt } // Only show notifications created after user joined
      },
      {
        recipientGroup: 'department',
        'recipientFilter.departments': user.department
      },
      {
        recipientGroup: 'role',
        'recipientFilter.roles': user.role
      },
      {
        recipientGroup: 'custom',
        'recipientFilter.customUserIds': user._id
      }
    ]
  })
  .sort({ createdAt: -1 });
};

// Static method: Cleanup expired notifications
notificationSchema.statics.cleanupExpired = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.updateMany(
    {
      isRead: true,
      createdAt: { $lte: cutoffDate }
    },
    {
      $set: { isDeleted: true, deletedAt: new Date() }
    }
  );
};

// Static method: Get delivery statistics
notificationSchema.statics.getDeliveryStats = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$deliveryStatus.status',
        count: { $sum: 1 },
        avgRetries: { $avg: '$retryCount' }
      }
    }
  ]);
};

// Static method: Find scheduled notifications ready to send
notificationSchema.statics.findScheduledReady = function() {
  return this.find({
    'deliveryStatus.status': 'scheduled',
    scheduledFor: { $lte: new Date() },
    isDeleted: false
  });
};

// Static method: Bulk create notifications
notificationSchema.statics.createBulk = async function(notificationData, userIds) {
  const batchId = new mongoose.Types.ObjectId().toString();
  const notifications = userIds.map(userId => ({
    ...notificationData,
    userId,
    batchId,
    sentBySystem: true
  }));
  
  return this.insertMany(notifications);
};

// Instance method: Mark action completed
notificationSchema.methods.markActionCompleted = async function() {
  this.actionCompleted = true;
  this.actionCompletedAt = new Date();
  return this.save();
};

// Instance method: Get associated entity
notificationSchema.methods.getRelatedEntity = async function() {
  if (!this.relatedEntity || !this.relatedEntity.entityType) return null;
  const model = mongoose.model(this.relatedEntity.entityType);
  return model.findById(this.relatedEntity.entityId);
};

// Instance method: Archive notification (soft delete)
notificationSchema.methods.archive = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Static method: Mark all as read for user
notificationSchema.statics.markAllRead = async function(userId) {
  return this.updateMany(
    { userId, isRead: false, isDeleted: false },
    {
      $set: {
        isRead: true,
        readAt: new Date(),
        'deliveryStatus.status': 'read'
      }
    }
  );
};

// Static method: Delete notifications by batch
notificationSchema.statics.deleteByBatch = async function(batchId) {
  return this.updateMany(
    { batchId, isDeleted: false },
    {
      $set: { isDeleted: true, deletedAt: new Date() }
    }
  );
};

// Static method: Get unread count for user
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({
    userId,
    isRead: false,
    isDeleted: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $gte: new Date() } }
    ]
  });
};

// Static method: Find notifications with retry needed
notificationSchema.statics.findNeedingRetry = function() {
  return this.find({
    'deliveryStatus.status': 'failed',
    retryCount: { $lt: 5 },
    isDeleted: false,
    lastRetryAt: {
      $lt: new Date(Date.now() - 60 * 60 * 1000) // Retry after 1 hour
    }
  });
};

// Static method: Get notification feed for user
notificationSchema.statics.getFeedForUser = async function(userId, options = {}) {
  const limit = options.limit || 50;
  const offset = options.offset || 0;
  const filterType = options.type || null;
  const onlyUnread = options.onlyUnread || false;
  
  const query = { userId, isDeleted: false };
  
  if (filterType) {
    query.type = filterType;
  }
  
  if (onlyUnread) {
    query.isRead = false;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit);
};

// Static method: Summarize notifications for user
notificationSchema.statics.getSummaryForUser = async function(userId) {
  const unreadCount = await this.countDocuments({
    userId,
    isRead: false,
    isDeleted: false
  });
  
  const typeBreakdown = await this.aggregate([
    {
      $match: {
        userId: mongoose.Types.ObjectId(userId),
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const pendingActions = await this.countDocuments({
    userId,
    actionRequired: true,
    actionCompleted: false,
    isDeleted: false
  });
  
  return {
    unreadCount,
    typeBreakdown,
    pendingActions,
    totalCount: unreadCount + (await this.countDocuments({
      userId,
      isRead: true,
      isDeleted: false
    }))
  };
};

// Static method: Send bulk notification to users
notificationSchema.statics.sendBulkNotification = async function(title, message, userIds, options = {}) {
  const batchId = new mongoose.Types.ObjectId().toString();
  
  const notifications = userIds.map(userId => ({
    userId,
    type: options.type || 'announcement',
    category: options.category || 'info',
    priority: options.priority || 'normal',
    title,
    message,
    actionUrl: options.actionUrl || null,
    actionLabel: options.actionLabel || null,
    batchId,
    sentBySystem: true,
    sentBy: options.sentBy || null,
    expiresAt: options.expiresAt || null
  }));
  
  const result = await this.insertMany(notifications);
  return { batchId, count: result.length };
};

// Static method: Get notification statistics
notificationSchema.statics.getStatistics = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $facet: {
        totalByType: [
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ],
        readByType: [
          { $match: { isRead: true } },
          { $group: { _id: '$type', count: { $sum: 1 } } }
        ],
        readRate: [
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              read: {
                $sum: { $cond: [{ $eq: ['$isRead', true] }, 1, 0] }
              }
            }
          }
        ],
        averageTimeToRead: [
          { $match: { readAt: { $exists: true } } },
          {
            $group: {
              _id: null,
              avgTime: {
                $avg: {
                  $subtract: ['$readAt', '$createdAt']
                }
              }
            }
          }
        ]
      }
    }
  ]);
  
  return stats[0];
};

// Static method: Clean old notifications
notificationSchema.statics.cleanupOld = async function(olderThanDays = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
  
  return this.deleteMany({
    createdAt: { $lte: cutoffDate },
    isRead: true,
    isDeleted: false
  });
};

// Static method: Find critical notifications needing action
notificationSchema.statics.findCriticalPending = function(userId) {
  return this.find({
    userId,
    actionRequired: true,
    actionCompleted: false,
    priority: { $in: ['high', 'urgent'] },
    isDeleted: false
  }).sort({ priority: -1, createdAt: -1 });
};

module.exports = mongoose.model('Notification', notificationSchema);