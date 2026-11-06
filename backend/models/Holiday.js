const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Holiday name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  date: {
    type: Date,
    required: [true, 'Holiday date is required'],
    index: true
  },
  endDate: {
    type: Date // For multi-day holidays
  },
  type: {
    type: String,
    enum: ['national', 'state', 'regional', 'company', 'optional', 'floating', 'restricted'],
    default: 'company',
    index: true
  },
  category: {
    type: String,
    enum: ['public', 'religious', 'cultural', 'company_specific', 'local'],
    default: 'company_specific'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  recurrenceRule: {
    frequency: { type: String, enum: ['yearly', 'custom'] },
    customLogic: String, // e.g., "second Monday of September"
    nextOccurrence: Date
  },
  isOptional: {
    type: Boolean,
    default: false
  },
  maxOptionalAllowance: {
    type: Number, // How many optional holidays can be taken
    default: 0
  },
  observedBy: {
    departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    }],
    locations: [String], // City names
    employmentTypes: [{
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern']
    }]
  },
  substituteDate: Date, // If holiday falls on weekend, observed on
  affectsPayroll: {
    type: Boolean,
    default: true
  },
  paidHoliday: {
    type: Boolean,
    default: true
  },
  notifyBeforeDays: {
    type: Number,
    default: 7,
    min: 0,
    max: 90
  },
  notificationsSent: [{
    sentAt: Date,
    recipientCount: Number,
    type: { type: String, enum: ['announcement', 'reminder', 'update', 'cancellation'] }
  }],
  reminders: [{
    scheduledFor: Date,
    sent: { type: Boolean, default: false },
    sentAt: Date
  }],
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'cancelled', 'completed'],
    default: 'draft',
    index: true
  },
  publishedAt: Date,
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cancelledAt: Date,
  cancellationReason: String,
  visibility: {
    type: String,
    enum: ['all', 'specific_departments', 'specific_locations'],
    default: 'all'
  },
  color: {
    type: String,
    default: '#4CAF50' // For calendar display
  },
  tags: [String],
  metadata: {
    source: String, // e.g., "Government Notification 2024/01"
    referenceUrl: String,
    importancLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
  },
  impact: {
    estimatedAffectedEmployees: Number,
    businessImpact: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'medium' },
    notes: String
  },
  history: [{
    action: { type: String, enum: ['created', 'updated', 'published', 'cancelled', 'rescheduled'] },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    changes: mongoose.Schema.Types.Mixed,
    reason: String
  }],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isDeleted: {
    type: Boolean,
    default: false,
    select: false
  },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
holidaySchema.index({ date: 1, isActive: 1 });
holidaySchema.index({ type: 1, status: 1 });
holidaySchema.index({ 'observedBy.locations': 1, date: 1 });
holidaySchema.index({ isOptional: 1, date: 1 });
holidaySchema.index({ createdAt: -1 });

// Virtual: Check if holiday is upcoming
holidaySchema.virtual('isUpcoming').get(function() {
  return this.date > new Date() && this.status === 'published';
});

// Virtual: Check if holiday is past
holidaySchema.virtual('isPast').get(function() {
  return this.date < new Date();
});

// Virtual: Days until holiday
holidaySchema.virtual('daysUntil').get(function() {
  if (this.isPast) return 0;
  const diff = this.date - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual: Duration in days (for multi-day holidays)
holidaySchema.virtual('duration').get(function() {
  if (!this.endDate) return 1;
  const diff = this.endDate - this.date;
  return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
});

// Virtual: Check if should send reminder
holidaySchema.virtual('shouldSendReminder').get(function() {
  if (this.isPast || this.status !== 'published') return false;
  const daysDiff = this.daysUntil;
  return daysDiff <= this.notifyBeforeDays;
});

// Pre-save middleware: Set endDate if not provided
holidaySchema.pre('save', function(next) {
  if (!this.endDate) {
    this.endDate = this.date;
  }
  next();
});

// Pre-save middleware: Track history
holidaySchema.pre('save', function(next) {
  if (this.isModified('date') || this.isModified('status')) {
    this.history.push({
      action: this.isNew ? 'created' : this.isModified('status') ? 'updated' : 'rescheduled',
      timestamp: new Date(),
      changes: this.modifiedPaths()
    });
  }
  next();
});

// Soft delete query middleware
holidaySchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Instance method: Publish holiday
holidaySchema.methods.publish = async function(userId) {
  this.status = 'published';
  this.publishedAt = new Date();
  this.publishedBy = userId;
  this.history.push({
    action: 'published',
    performedBy: userId,
    timestamp: new Date()
  });
  return this.save();
};

// Instance method: Cancel holiday
holidaySchema.methods.cancel = async function(userId, reason) {
  this.status = 'cancelled';
  this.cancelledAt = new Date();
  this.cancelledBy = userId;
  this.cancellationReason = reason;
  this.history.push({
    action: 'cancelled',
    performedBy: userId,
    timestamp: new Date(),
    reason
  });
  return this.save();
};

// Instance method: Check if applicable to user
holidaySchema.methods.isApplicableToUser = function(user) {
  // If visibility is all, it's applicable
  if (this.visibility === 'all' && !this.observedBy.departments.length && !this.observedBy.locations.length) {
    return true;
  }
  
  // Check department
  if (this.observedBy.departments.length > 0) {
    if (!this.observedBy.departments.some(d => d.toString() === user.department.toString())) {
      return false;
    }
  }
  
  // Check location
  if (this.observedBy.locations.length > 0) {
    if (!this.observedBy.locations.includes(user.location)) {
      return false;
    }
  }
  
  // Check employment type
  if (this.observedBy.employmentTypes.length > 0) {
    if (!this.observedBy.employmentTypes.includes(user.employmentType)) {
      return false;
    }
  }
  
  return true;
};

// Instance method: Schedule reminder
holidaySchema.methods.scheduleReminder = async function() {
  const reminderDate = new Date(this.date);
  reminderDate.setDate(reminderDate.getDate() - this.notifyBeforeDays);
  
  this.reminders.push({
    scheduledFor: reminderDate,
    sent: false
  });
  
  return this.save();
};

// Static method: Find upcoming holidays
holidaySchema.statics.findUpcoming = function(days = 30, filters = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);
  
  const query = {
    date: { $gte: today, $lte: futureDate },
    status: 'published',
    isActive: true,
    isDeleted: false
  };
  
  if (filters.type) query.type = filters.type;
  if (filters.location) query['observedBy.locations'] = filters.location;
  
  return this.find(query).sort({ date: 1 });
};

// Static method: Find by year
holidaySchema.statics.findByYear = function(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  return this.find({
    date: { $gte: startDate, $lte: endDate },
    status: 'published',
    isActive: true,
    isDeleted: false
  }).sort({ date: 1 });
};

// Static method: Get calendar view
holidaySchema.statics.getCalendarView = async function(startDate, endDate, filters = {}) {
  const query = {
    date: { $gte: startDate, $lte: endDate },
    status: 'published',
    isDeleted: false
  };
  
  if (filters.type) query.type = filters.type;
  if (filters.location) query['observedBy.locations'] = filters.location;
  if (filters.department) query['observedBy.departments'] = filters.department;
  
  return this.find(query).sort({ date: 1 });
};

// Static method: Count holidays by type
holidaySchema.statics.getStatistics = async function(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  return this.aggregate([
    {
      $match: {
        date: { $gte: startDate, $lte: endDate },
        status: 'published',
        isDeleted: false
      }
    },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        holidays: { $push: { name: '$name', date: '$date' } }
      }
    }
  ]);
};

// Instance method: Send notification
holidaySchema.methods.sendNotifications = async function(recipientCount) {
  this.notificationsSent.push({
    sentAt: new Date(),
    recipientCount,
    type: 'announcement'
  });
  return this.save();
};

// Instance method: Add attachment
holidaySchema.methods.addAttachment = async function(fileName, fileUrl, fileType, userId) {
  this.attachments.push({
    fileName,
    fileUrl,
    fileType,
    uploadedBy: userId
  });
  return this.save();
};

// Instance method: Get employees affected by holiday
holidaySchema.methods.getAffectedEmployees = async function() {
  const User = require('./User');
  const query = { status: { $in: ['active', 'approved', 'on_leave'] }, isDeleted: false };
  
  if (this.observedBy.departments.length > 0) {
    query.department = { $in: this.observedBy.departments };
  }
  
  if (this.observedBy.employmentTypes.length > 0) {
    query.employmentType = { $in: this.observedBy.employmentTypes };
  }
  
  return User.find(query);
};

// Instance method: Check conflicts with leave requests
holidaySchema.methods.checkLeaveConflicts = async function() {
  const LeaveRequest = require('./LeaveRequest');
  const conflicts = await LeaveRequest.find({
    status: 'approved',
    $or: [
      { startDate: { $lte: this.endDate }, endDate: { $gte: this.date } }
    ]
  }).populate('userId', 'name email department');
  
  return {
    hasConflicts: conflicts.length > 0,
    affectedLeaves: conflicts,
    count: conflicts.length
  };
};

// Static method: Check date is holiday
holidaySchema.statics.isHoliday = async function(date, department = null) {
  const query = {
    date: { $lte: date },
    endDate: { $gte: date },
    status: 'published',
    isActive: true,
    isDeleted: false
  };
  
  if (department) {
    query.$or = [
      { 'observedBy.departments': { $size: 0 } },
      { 'observedBy.departments': department }
    ];
  }
  
  const holiday = await this.findOne(query);
  return !!holiday;
};

// Static method: Get next holiday
holidaySchema.statics.getNextHoliday = function() {
  return this.findOne({
    date: { $gte: new Date() },
    status: 'published',
    isActive: true,
    isDeleted: false
  }).sort({ date: 1 });
};

// Static method: Get holidays needing reminders
holidaySchema.statics.getHolidaysNeedingReminders = function() {
  const today = new Date();
  return this.find({
    date: { $gt: today },
    status: 'published',
    isActive: true,
    isDeleted: false,
    'reminders.sent': false
  });
};

// Static method: Bulk publish holidays
holidaySchema.statics.bulkPublish = async function(holidayIds, userId) {
  return this.updateMany(
    { _id: { $in: holidayIds } },
    {
      $set: {
        status: 'published',
        publishedAt: new Date(),
        publishedBy: userId
      }
    }
  );
};

module.exports = mongoose.model('Holiday', holidaySchema);
