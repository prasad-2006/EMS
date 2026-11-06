const mongoose = require('mongoose');

const leavePolicySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Policy name is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Name must be at least 3 characters'],
    maxlength: [200, 'Name cannot exceed 200 characters']
  },
  code: {
    type: String,
    unique: true,
    uppercase: true,
    trim: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  description: {
    type: String,
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  leaveTypes: {
    casual: {
      annual: { type: Number, default: 12, min: 0, max: 100 },
      maxConsecutive: { type: Number, default: 5, min: 0 },
      requiresApproval: { type: Boolean, default: true },
      noticePeriodDays: { type: Number, default: 2, min: 0 },
      carryForward: { type: Boolean, default: false },
      maxCarryForward: { type: Number, default: 0 },
      accrualRate: { type: Number, default: 1 } // Per month
    },
    sick: {
      annual: { type: Number, default: 10, min: 0, max: 100 },
      maxConsecutive: { type: Number, default: 7, min: 0 },
      requiresDocument: { type: Boolean, default: false },
      documentRequiredAfterDays: { type: Number, default: 3, min: 0 },
      requiresApproval: { type: Boolean, default: true },
      carryForward: { type: Boolean, default: false },
      maxCarryForward: { type: Number, default: 0 },
      accrualRate: { type: Number, default: 0.83 }
    },
    earned: {
      annual: { type: Number, default: 15, min: 0, max: 100 },
      maxConsecutive: { type: Number, default: 15, min: 0 },
      requiresApproval: { type: Boolean, default: true },
      noticePeriodDays: { type: Number, default: 7, min: 0 },
      carryForward: { type: Boolean, default: true },
      maxCarryForward: { type: Number, default: 10, min: 0 },
      accrualRate: { type: Number, default: 1.25 },
      canEncash: { type: Boolean, default: true },
      maxEncashment: { type: Number, default: 15 }
    },
    wfh: {
      annual: { type: Number, default: 24, min: 0, max: 100 },
      maxConsecutive: { type: Number, default: 10, min: 0 },
      requiresApproval: { type: Boolean, default: true },
      noticePeriodDays: { type: Number, default: 1, min: 0 },
      allowHybrid: { type: Boolean, default: true }
    },
    emergency: {
      annual: { type: Number, default: 5, min: 0, max: 100 },
      maxConsecutive: { type: Number, default: 2, min: 0 },
      requiresApproval: { type: Boolean, default: true },
      postApprovalAllowed: { type: Boolean, default: true },
      requiresJustification: { type: Boolean, default: true }
    }
  },
  rules: {
    sandwichRuleEnabled: { type: Boolean, default: false },
    holidayCountsAsLeave: { type: Boolean, default: false },
    weekendCountsAsLeave: { type: Boolean, default: false },
    coverageWarningPercentage: { type: Number, default: 30, min: 1, max: 100 },
    coverageBlockPercentage: { type: Number, default: 50, min: 1, max: 100 },
    minAdvanceBookingDays: { type: Number, default: 0 },
    maxAdvanceBookingDays: { type: Number, default: 90 },
    allowBackdatedRequests: { type: Boolean, default: false },
    backdatedRequestDaysLimit: { type: Number, default: 3 },
    blackoutDates: [{
      startDate: Date,
      endDate: Date,
      reason: String,
      exemptedRoles: [String]
    }],
    peakSeasonRestrictions: [{
      startDate: Date,
      endDate: Date,
      maxLeavePercentage: Number,
      affectedDepartments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }]
    }]
  },
  applicableRoles: [{
    type: String,
    enum: ['employee', 'manager', 'hr', 'admin', 'auditor']
  }],
  applicableDepartments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  }],
  applicableEmploymentTypes: [{
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'intern']
  }],
  applicableLocations: [String],
  exceptions: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: String,
    customAllowances: mongoose.Schema.Types.Mixed,
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
  }],
  approvalWorkflow: {
    requireManagerApproval: { type: Boolean, default: true },
    requireHRApproval: { type: Boolean, default: false },
    requireAdminApproval: { type: Boolean, default: false },
    hrApprovalThresholdDays: { type: Number, default: 7 },
    autoApprovalEnabled: { type: Boolean, default: false },
    autoApprovalRules: {
      maxDays: Number,
      leaveTypes: [String],
      excludeDepartments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }]
    },
    escalationEnabled: { type: Boolean, default: false },
    escalationAfterHours: { type: Number, default: 48 }
  },
  probationRules: {
    applyToProbation: { type: Boolean, default: false },
    probationRestrictions: {
      allowedLeaveTypes: [String],
      maxLeaveDays: Number,
      requireExtraApproval: Boolean
    }
  },
  resignationRules: {
    allowLeaveDuringNoticePeriod: { type: Boolean, default: false },
    maxDaysAllowed: Number,
    requireSpecialApproval: Boolean
  },
  complianceDetails: {
    legalReferences: [String],
    jurisdictions: [String],
    complianceNotes: String,
    lastReviewedDate: Date,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'archived'],
    default: 'draft',
    index: true
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  effectiveFrom: {
    type: Date,
    required: true,
    default: Date.now
  },
  effectiveTo: {
    type: Date
  },
  replacesPolicy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LeavePolicy'
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  impactAnalysis: {
    estimatedAffectedUsers: Number,
    impactSummary: String,
    budgetImpact: Number,
    calculatedAt: Date
  },
  notificationsSent: [{
    type: { type: String, enum: ['announcement', 'reminder', 'update', 'deprecation'] },
    sentAt: Date,
    recipientCount: Number
  }],
  attachments: [{
    fileName: String,
    fileUrl: String,
    fileType: String,
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  changeLog: [{
    version: Number,
    changes: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    reason: String
  }],
  tags: [String],
  metadata: {
    category: String,
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    customFields: mongoose.Schema.Types.Mixed
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
leavePolicySchema.index({ name: 1, status: 1 });
leavePolicySchema.index({ code: 1 }, { unique: true, sparse: true });
leavePolicySchema.index({ isDefault: 1, status: 1 });
leavePolicySchema.index({ effectiveFrom: 1, effectiveTo: 1 });
leavePolicySchema.index({ 'applicableDepartments': 1 });
leavePolicySchema.index({ createdAt: -1 });

// Virtual: Check if policy is currently effective
leavePolicySchema.virtual('isEffective').get(function() {
  const now = new Date();
  return this.effectiveFrom <= now && (!this.effectiveTo || this.effectiveTo >= now);
});

// Virtual: Days until effective
leavePolicySchema.virtual('daysUntilEffective').get(function() {
  if (this.isEffective) return 0;
  const diff = this.effectiveFrom - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// Virtual: Total annual leave days
leavePolicySchema.virtual('totalAnnualLeave').get(function() {
  return (this.leaveTypes.casual?.annual || 0) +
         (this.leaveTypes.sick?.annual || 0) +
         (this.leaveTypes.earned?.annual || 0) +
         (this.leaveTypes.wfh?.annual || 0) +
         (this.leaveTypes.emergency?.annual || 0);
});

// Virtual: Check if policy is active
leavePolicySchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.isEffective;
});

// Pre-save middleware: Auto-generate code
leavePolicySchema.pre('save', function(next) {
  if (!this.code && this.isNew) {
    this.code = this.name.toUpperCase().replace(/\s+/g, '_').substring(0, 10);
  }
  next();
});

// Pre-save middleware: Track version changes
leavePolicySchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.changeLog.push({
      version: this.version,
      changes: this.modifiedPaths().join(', '),
      changedAt: new Date()
    });
  }
  next();
});

// Soft delete query middleware
leavePolicySchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Instance method: Validate leave request against policy
leavePolicySchema.methods.validateLeaveRequest = function(leaveRequest, user) {
  const errors = [];
  const leaveType = this.leaveTypes[leaveRequest.leaveType];
  
  if (!leaveType) {
    errors.push(`Leave type ${leaveRequest.leaveType} not defined in policy`);
    return { valid: false, errors };
  }
  
  // Check consecutive days limit
  if (leaveRequest.totalDays > leaveType.maxConsecutive) {
    errors.push(`Cannot exceed ${leaveType.maxConsecutive} consecutive days for ${leaveRequest.leaveType}`);
  }
  
  // Check notice period
  if (leaveType.noticePeriodDays) {
    const daysDiff = Math.ceil((leaveRequest.startDate - new Date()) / (1000 * 60 * 60 * 24));
    if (daysDiff < leaveType.noticePeriodDays && !leaveType.postApprovalAllowed) {
      errors.push(`Requires ${leaveType.noticePeriodDays} days advance notice`);
    }
  }
  
  // Check blackout dates
  for (const blackout of this.rules.blackoutDates || []) {
    if (leaveRequest.startDate <= blackout.endDate && leaveRequest.endDate >= blackout.startDate) {
      if (!blackout.exemptedRoles || !blackout.exemptedRoles.includes(user.role)) {
        errors.push(`Leave dates fall within blackout period: ${blackout.reason}`);
      }
    }
  }
  
  // Check probation restrictions
  if (user.isOnProbation && this.probationRules.applyToProbation) {
    const restrictions = this.probationRules.probationRestrictions;
    if (restrictions.allowedLeaveTypes && !restrictions.allowedLeaveTypes.includes(leaveRequest.leaveType)) {
      errors.push(`${leaveRequest.leaveType} leave not allowed during probation`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings: []
  };
};

// Instance method: Calculate entitlement for user
leavePolicySchema.methods.calculateEntitlement = function(user) {
  const entitlements = {};
  
  for (const [leaveType, config] of Object.entries(this.leaveTypes)) {
    let annual = config.annual || 0;
    
    // Prorate for joining in middle of year
    if (user.joiningDate) {
      const monthsWorked = Math.floor((Date.now() - user.joiningDate) / (1000 * 60 * 60 * 24 * 30));
      if (monthsWorked < 12) {
        annual = Math.round((config.accrualRate || 1) * monthsWorked);
      }
    }
    
    entitlements[leaveType] = {
      annual,
      maxConsecutive: config.maxConsecutive,
      carryForward: config.carryForward || false,
      maxCarryForward: config.maxCarryForward || 0
    };
  }
  
  return entitlements;
};

// Instance method: Publish policy
leavePolicySchema.methods.publish = async function(userId) {
  this.status = 'active';
  this.publishedAt = new Date();
  this.publishedBy = userId;
  return this.save();
};

// Instance method: Archive policy
leavePolicySchema.methods.archive = async function() {
  this.status = 'archived';
  this.effectiveTo = new Date();
  return this.save();
};

// Static method: Get effective policy for user
leavePolicySchema.statics.getEffectivePolicy = async function(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) return null;
  
  const now = new Date();
  
  // Check for user-specific exceptions
  const policyWithException = await this.findOne({
    'exceptions.userId': userId,
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
    status: 'active',
    isDeleted: false
  });
  
  if (policyWithException) return policyWithException;
  
  // Check for department-specific policy
  const departmentPolicy = await this.findOne({
    applicableDepartments: user.department,
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
    status: 'active',
    isDeleted: false
  });
  
  if (departmentPolicy) return departmentPolicy;
  
  // Return default policy
  return this.findOne({
    isDefault: true,
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
    status: 'active',
    isDeleted: false
  });
};

// Static method: Search policies
leavePolicySchema.statics.searchPolicies = function(searchText, filters = {}) {
  const query = {
    isDeleted: false,
    $or: [
      { name: { $regex: searchText, $options: 'i' } },
      { code: { $regex: searchText, $options: 'i' } },
      { description: { $regex: searchText, $options: 'i' } }
    ]
  };
  
  if (filters.status) query.status = filters.status;
  if (filters.isDefault !== undefined) query.isDefault = filters.isDefault;
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method: Compare policy versions
leavePolicySchema.statics.compareVersions = async function(policyId1, policyId2) {
  const [policy1, policy2] = await Promise.all([
    this.findById(policyId1),
    this.findById(policyId2)
  ]);
  
  if (!policy1 || !policy2) return null;
  
  const differences = {};
  
  // Compare leave types
  for (const leaveType of Object.keys(policy1.leaveTypes)) {
    const type1 = policy1.leaveTypes[leaveType];
    const type2 = policy2.leaveTypes[leaveType];
    
    if (JSON.stringify(type1) !== JSON.stringify(type2)) {
      differences[leaveType] = {
        before: type1,
        after: type2
      };
    }
  }
  
  return {
    policy1: { id: policy1._id, name: policy1.name, version: policy1.version },
    policy2: { id: policy2._id, name: policy2.name, version: policy2.version },
    differences
  };
};

// Instance method: Create new version
leavePolicySchema.methods.createNewVersion = async function(changes, effectiveDate, userId, reason) {
  // Create copy with incremented version
  const newVersion = new this.constructor({
    name: `${this.name} v${this.version + 1}`,
    code: this.code,
    version: this.version + 1,
    description: this.description,
    leaveTypes: JSON.parse(JSON.stringify(this.leaveTypes)),
    rules: JSON.parse(JSON.stringify(this.rules)),
    applicableRoles: [...this.applicableRoles],
    applicableDepartments: [...this.applicableDepartments],
    applicableEmploymentTypes: [...this.applicableEmploymentTypes],
    applicableLocations: [...this.applicableLocations],
    approvalWorkflow: JSON.parse(JSON.stringify(this.approvalWorkflow)),
    status: 'draft',
    effectiveFrom: effectiveDate,
    replacesPolicy: this._id,
    approvedBy: null,
    approvedAt: null
  });
  
  // Apply changes
  Object.keys(changes).forEach(key => {
    if (newVersion[key] !== undefined) {
      newVersion[key] = changes[key];
    }
  });
  
  // Track in changelog
  this.changeLog.push({
    version: newVersion.version,
    changes: Object.keys(changes).join(', '),
    changedBy: userId,
    reason
  });
  
  await this.save();
  return newVersion.save();
};

// Instance method: Rollback to previous version
leavePolicySchema.methods.rollback = async function(userId) {
  if (!this.replacesPolicy) {
    throw new Error('No previous version to rollback to');
  }
  
  const previousPolicy = await this.constructor.findById(this.replacesPolicy);
  if (!previousPolicy) {
    throw new Error('Previous policy version not found');
  }
  
  // Archive current version
  this.status = 'archived';
  this.effectiveTo = new Date();
  await this.save();
  
  // Make previous version active again
  previousPolicy.status = 'active';
  previousPolicy.effectiveTo = null;
  previousPolicy.changeLog.push({
    version: previousPolicy.version,
    changes: 'Policy restored via rollback',
    changedBy: userId,
    changedAt: new Date()
  });
  
  return previousPolicy.save();
};

// Instance method: Calculate impact analysis
leavePolicySchema.methods.analyzeImpact = async function(compareAgainst = null) {
  const User = mongoose.model('User');
  const LeaveRequest = mongoose.model('LeaveRequest');
  
  // Get affected users
  let query = { status: 'active', isDeleted: false };
  
  if (this.applicableDepartments?.length > 0) {
    query.department = { $in: this.applicableDepartments };
  }
  if (this.applicableEmploymentTypes?.length > 0) {
    query.employmentType = { $in: this.applicableEmploymentTypes };
  }
  if (this.applicableLocations?.length > 0) {
    query.location = { $in: this.applicableLocations };
  }
  if (this.applicableRoles?.length > 0) {
    query.role = { $in: this.applicableRoles };
  }
  
  const affectedUsers = await User.find(query);
  const estimatedAffectedUsers = affectedUsers.length;
  
  // Calculate budget impact
  let budgetImpact = 0;
  for (const leaveType of Object.keys(this.leaveTypes)) {
    const leaveDays = this.leaveTypes[leaveType].annual || 0;
    budgetImpact += leaveDays * estimatedAffectedUsers * 500; // Assume 500 per day
  }
  
  // Compare with previous policy
  let comparisonSummary = '';
  if (compareAgainst) {
    const comparison = await this.constructor.compareVersions(compareAgainst, this._id);
    comparisonSummary = JSON.stringify(comparison.differences);
  }
  
  this.impactAnalysis = {
    estimatedAffectedUsers,
    impactSummary: comparisonSummary || 'Policy created',
    budgetImpact,
    calculatedAt: new Date()
  };
  
  return this.save();
};

// Instance method: Get policy usage statistics
leavePolicySchema.methods.getUsageStatistics = async function() {
  const LeaveRequest = mongoose.model('LeaveRequest');
  
  return LeaveRequest.aggregate([
    {
      $match: { policy: this._id }
    },
    {
      $group: {
        _id: '$leaveType',
        count: { $sum: 1 },
        averageDays: { $avg: '$totalDays' },
        totalDays: { $sum: '$totalDays' }
      }
    }
  ]);
};

// Instance method: Send notification about policy change
leavePolicySchema.methods.notifyUsers = async function(type, recipientIds = null) {
  const Notification = mongoose.model('Notification');
  
  let users = recipientIds;
  if (!users) {
    const User = mongoose.model('User');
    users = await User.find({
      isDeleted: false,
      role: { $in: this.applicableRoles }
    }).select('_id');
    users = users.map(u => u._id);
  }
  
  const notifications = users.map(userId => ({
    userId,
    type: 'system',
    title: `Leave Policy Update: ${this.name}`,
    message: `Policy "${this.name}" has been ${this.status}. Please review the new guidelines.`,
    metadata: { policyId: this._id, type }
  }));
  
  await Notification.insertMany(notifications);
  
  this.notificationsSent.push({
    type,
    sentAt: new Date(),
    recipientCount: notifications.length
  });
  
  return this.save();
};

// Instance method: Add exception for user
leavePolicySchema.methods.addUserException = async function(userId, customAllowances, approvedBy, reason) {
  this.exceptions.push({
    userId,
    reason,
    customAllowances,
    approvedBy,
    approvedAt: new Date()
  });
  return this.save();
};

// Instance method: Remove user exception
leavePolicySchema.methods.removeUserException = async function(userId) {
  this.exceptions = this.exceptions.filter(e => e.userId.toString() !== userId.toString());
  return this.save();
};

// Static method: Get applicable policy for user at given date
leavePolicySchema.statics.findApplicable = async function(userId, date, leaveType = null) {
  const User = mongoose.model('User');
  const user = await User.findById(userId);
  
  if (!user) return null;
  
  const query = {
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }],
    status: 'active',
    isDeleted: false
  };
  
  // Check for user-specific exception first
  let policy = await this.findOne({
    ...query,
    'exceptions.userId': userId
  });
  
  if (policy) return policy;
  
  // Check department
  if (user.department) {
    policy = await this.findOne({
      ...query,
      applicableDepartments: user.department
    });
    if (policy) return policy;
  }
  
  // Check employment type
  if (user.employmentType) {
    policy = await this.findOne({
      ...query,
      applicableEmploymentTypes: user.employmentType
    });
    if (policy) return policy;
  }
  
  // Return default
  return this.findOne({
    ...query,
    isDefault: true
  });
};

// Static method: Bulk publish policies
leavePolicySchema.statics.bulkPublish = async function(policyIds, userId) {
  return this.updateMany(
    { _id: { $in: policyIds } },
    {
      $set: {
        status: 'active',
        publishedAt: new Date(),
        publishedBy: userId
      }
    }
  );
};

// Static method: Get all active policies
leavePolicySchema.statics.getActivePolicies = function() {
  const now = new Date();
  return this.find({
    status: 'active',
    effectiveFrom: { $lte: now },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
    isDeleted: false
  }).sort({ name: 1 });
};

// Static method: Get policies expiring soon
leavePolicySchema.statics.getPoliciesExpiringSoon = function(daysThreshold = 30) {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  
  return this.find({
    status: 'active',
    effectiveTo: { $gt: now, $lte: futureDate },
    isDeleted: false
  }).sort({ effectiveTo: 1 });
};

// Pre-save: Ensure only one default policy exists
leavePolicySchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id }, isDefault: true },
      { isDefault: false }
    );
  }
  next();
});

module.exports = mongoose.model('LeavePolicy', leavePolicySchema);
