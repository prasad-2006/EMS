const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
    index: 'text'
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [10, 'Password must be at least 10 characters'],
    select: false
  },
  passwordChangedAt: Date,
  mfaEnabled: { type: Boolean, default: false },
  mfaSecretEncrypted: { type: String, select: false },
  mfaRecoveryCodeHashes: { type: [String], select: false, default: [] },
  passwordResetToken: String,
  passwordResetExpires: Date,
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  accountLockedUntil: Date,
  role: {
    type: String,
    enum: ['employee', 'manager', 'hr', 'admin', 'auditor'],
    default: 'employee',
    index: true
  },
  permissions: [{
    type: String,
    enum: ['view_reports', 'manage_users', 'approve_leaves', 'manage_policies', 'audit_logs', 'export_data']
  }],
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  },
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  }],
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true,
    uppercase: true
  },
  joiningDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  probationEndDate: Date,
  resignationDate: Date,
  lastWorkingDay: Date,
  designation: {
    type: String,
    trim: true
  },
  grade: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'inactive', 'on_leave', 'resigned', 'terminated'],
    default: 'pending',
    index: true
  },
  employmentType: {
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'intern'],
    default: 'full_time'
  },
  phoneNumber: {
    type: String,
    trim: true,
    match: [/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/, 'Invalid phone number']
  },
  alternateEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: { type: String, default: 'India' },
    zipCode: String
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNumber: String
  },
  // Salary component (set by admin). Deductions are computed from approved
  // leave days and extra pay is added for tasks covered while colleagues are
  // on leave.
  salary: {
    monthlyBase: {
      type: Number,
      default: 60000,
      min: 0
    },
    currency: {
      type: String,
      default: 'INR'
    },
    perDayDeductionRate: {
      type: Number,
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: Date
  },
  leaveBalance: {
    casual: {
      type: Number,
      default: 12,
      min: 0
    },
    sick: {
      type: Number,
      default: 10,
      min: 0
    },
    earned: {
      type: Number,
      default: 15,
      min: 0
    },
    wfh: {
      type: Number,
      default: 24,
      min: 0
    },
    emergency: {
      type: Number,
      default: 5,
      min: 0
    }
  },
  leaveCarryForward: {
    casual: { type: Number, default: 0, min: 0 },
    earned: { type: Number, default: 0, min: 0 }
  },
  workHistory: [{
    action: {
      type: String,
      enum: ['joined', 'promoted', 'transferred', 'role_changed', 'terminated', 'resigned']
    },
    fromDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    toDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    fromDesignation: String,
    toDesignation: String,
    effectiveDate: Date,
    reason: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now }
  }],
  performanceRatings: [{
    rating: { type: Number, min: 1, max: 5 },
    period: String,
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comments: String,
    reviewedAt: { type: Date, default: Date.now }
  }],
  skills: [String],
  certifications: [{
    name: String,
    issuedBy: String,
    issuedDate: Date,
    expiryDate: Date
  }],
  lastLoginAt: Date,
  lastLoginIP: String,
  sessionToken: String,
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
userSchema.index({ name: 'text', employeeId: 'text' });
userSchema.index({ department: 1, status: 1, role: 1 });
userSchema.index({ managerId: 1, isDeleted: 1 });
userSchema.index({ email: 1, isDeleted: 1 });
userSchema.index({ createdAt: -1 });

// Virtual: Calculate total leave balance
userSchema.virtual('totalLeaveBalance').get(function() {
  const lb = this.leaveBalance;
  return (lb.casual || 0) + (lb.sick || 0) + (lb.earned || 0) + (lb.wfh || 0) + (lb.emergency || 0);
});

// Virtual: Calculate tenure in days
userSchema.virtual('tenureDays').get(function() {
  if (!this.joiningDate) return 0;
  const now = this.resignationDate || new Date();
  return Math.floor((now - this.joiningDate) / (1000 * 60 * 60 * 24));
});

// Virtual: Check if user is on probation
userSchema.virtual('isOnProbation').get(function() {
  if (!this.probationEndDate) return false;
  return new Date() < this.probationEndDate;
});

// Virtual: Check if account is locked
userSchema.virtual('isLocked').get(function() {
  return this.accountLockedUntil && this.accountLockedUntil > Date.now();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now() - 1000; // Subtract 1s to ensure JWT issued after password change
    next();
  } catch (error) {
    next(error);
  }
});

// Auto-generate employeeId if not provided
userSchema.pre('save', async function(next) {
  if (!this.employeeId && this.isNew) {
    try {
      let nextNum = 1;
      const lastUser = await this.constructor.collection.findOne(
        { employeeId: { $regex: /^EMP\d+$/ } },
        { sort: { employeeId: -1 }, projection: { employeeId: 1 } }
      );
      
      if (lastUser && lastUser.employeeId) {
        const match = lastUser.employeeId.match(/^EMP(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      } else {
        const count = await this.constructor.collection.countDocuments();
        nextNum = count + 1;
      }

      let isUnique = false;
      let maxAttempts = 100;
      while (!isUnique && maxAttempts > 0) {
        const candidateId = `EMP${String(nextNum).padStart(5, '0')}`;
        const existing = await this.constructor.collection.findOne({ employeeId: candidateId });
        if (!existing) {
          this.employeeId = candidateId;
          isUnique = true;
        } else {
          nextNum++;
          maxAttempts--;
        }
      }
    } catch (err) {
      console.error('Error generating employeeId:', err);
    }
  }
  next();
});

// Soft delete query middleware
userSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Instance method: Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method: Check if password was changed after JWT issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Instance method: Increment failed login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  if (this.accountLockedUntil && this.accountLockedUntil < Date.now()) {
    return this.updateOne({ $set: { failedLoginAttempts: 1 }, $unset: { accountLockedUntil: 1 } });
  }
  
  const updates = { $inc: { failedLoginAttempts: 1 } };
  const maxAttempts = 5;
  const lockTime = 15 * 60 * 1000; // 15 minutes
  
  if (this.failedLoginAttempts + 1 >= maxAttempts && !this.isLocked) {
    updates.$set = { accountLockedUntil: Date.now() + lockTime };
  }
  
  return this.updateOne(updates);
};

// Instance method: Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({ $set: { failedLoginAttempts: 0 }, $unset: { accountLockedUntil: 1 } });
};

// Instance method: Deduct leave balance
userSchema.methods.deductLeave = async function(leaveType, days) {
  if (this.leaveBalance[leaveType] < days) {
    throw new Error(`Insufficient ${leaveType} leave balance`);
  }
  this.leaveBalance[leaveType] -= days;
  return this.save();
};

// Instance method: Restore leave balance
userSchema.methods.restoreLeave = async function(leaveType, days) {
  this.leaveBalance[leaveType] = (this.leaveBalance[leaveType] || 0) + days;
  return this.save();
};

// Static method: Find direct reports
userSchema.statics.findDirectReports = function(managerId) {
  return this.find({ managerId, isDeleted: false });
};

// Static method: Get department employees
userSchema.statics.findByDepartment = function(departmentId, options = {}) {
  const query = { department: departmentId, isDeleted: false };
  if (options.status) query.status = options.status;
  if (options.role) query.role = options.role;
  return this.find(query);
};

// Static method: Search users
userSchema.statics.searchUsers = function(searchText, filters = {}) {
  const query = {
    isDeleted: false,
    $or: [
      { name: { $regex: searchText, $options: 'i' } },
      { email: { $regex: searchText, $options: 'i' } },
      { employeeId: { $regex: searchText, $options: 'i' } }
    ]
  };
  
  if (filters.department) query.department = filters.department;
  if (filters.role) query.role = filters.role;
  if (filters.status) query.status = filters.status;
  
  return this.find(query);
};

// Static method: Get eligible approvers for a user
userSchema.statics.getApprovers = async function(userId) {
  const user = await this.findById(userId).populate('managerId department');
  const approvers = { manager: null, hr: [], admin: [] };
  
  if (user.managerId) {
    approvers.manager = user.managerId;
  }
  
  approvers.hr = await this.find({ role: 'hr', status: 'active', isDeleted: false });
  approvers.admin = await this.find({ role: 'admin', status: 'active', isDeleted: false });
  
  return approvers;
};

// Instance method: Check if user has permission
userSchema.methods.hasPermission = function(permission) {
  const rolePermissions = {
    admin: ['view_reports', 'manage_users', 'approve_leaves', 'manage_policies', 'audit_logs', 'export_data'],
    hr: ['view_reports', 'approve_leaves', 'manage_policies', 'export_data'],
    manager: ['view_reports', 'approve_leaves'],
    auditor: ['view_reports', 'audit_logs'],
    employee: ['view_reports']
  };
  
  const permissions = rolePermissions[this.role] || [];
  return permissions.includes(permission) || this.permissions.includes(permission);
};

// Instance method: Check if user can apply leave of type
userSchema.methods.canApplyLeave = async function(leaveType) {
  if (this.status !== 'active' && this.status !== 'approved') return false;
  if (this.isLocked) return false;
  if (this.leaveBalance[leaveType] <= 0) return false;
  return true;
};

// Instance method: Get leave eligibility details
userSchema.methods.getLeaveEligibility = function() {
  const eligibility = {};
  for (const [type, balance] of Object.entries(this.leaveBalance)) {
    eligibility[type] = {
      available: balance,
      carryForward: this.leaveCarryForward[type] || 0,
      total: balance + (this.leaveCarryForward[type] || 0),
      eligible: balance > 0 && !this.isLocked && (this.status === 'active' || this.status === 'approved')
    };
  }
  return eligibility;
};

// Instance method: Calculate profile completion percentage
userSchema.methods.getProfileCompletion = function() {
  const fields = [
    this.email, this.phoneNumber, this.designation, this.department,
    this.joiningDate, this.address?.city, this.address?.state,
    this.emergencyContact?.name, this.emergencyContact?.phoneNumber
  ];
  const completed = fields.filter(f => f).length;
  return Math.round((completed / fields.length) * 100);
};

// Instance method: Get team members (for managers)
userSchema.methods.getTeamMembers = function() {
  if (this.role !== 'manager') return Promise.resolve([]);
  return this.constructor.find({ managerId: this._id, isDeleted: false });
};

// Instance method: Validate status transition
userSchema.methods.canTransitionTo = function(newStatus) {
  const validTransitions = {
    pending: ['approved', 'rejected'],
    approved: ['active', 'inactive', 'on_leave'],
    active: ['on_leave', 'inactive', 'resigned', 'terminated'],
    inactive: ['active'],
    on_leave: ['active'],
    resigned: [],
    terminated: []
  };
  
  const allowed = validTransitions[this.status] || [];
  return allowed.includes(newStatus);
};

// Instance method: Archive user (soft delete with reason)
userSchema.methods.archive = async function(reason, archivedBy) {
  if (!['resigned', 'terminated'].includes(this.status)) {
    throw new Error('Only resigned or terminated users can be archived');
  }
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = archivedBy;
  return this.save();
};

// Static method: Get archived users
userSchema.statics.getArchived = function(filters = {}) {
  const query = { isDeleted: true };
  if (filters.departmentId) query.department = filters.departmentId;
  if (filters.from && filters.to) {
    query.deletedAt = { $gte: filters.from, $lte: filters.to };
  }
  return this.find(query).select('+deletedAt').sort({ deletedAt: -1 });
};

// Static method: Restore archived user
userSchema.statics.restore = async function(userId) {
  const user = await this.findById(userId).select('+isDeleted +deletedAt');
  if (!user.isDeleted) throw new Error('User is not archived');
  user.isDeleted = false;
  user.deletedAt = null;
  user.deletedBy = null;
  return user.save();
};

// Static method: Get team report for manager
userSchema.statics.getTeamReport = async function(managerId) {
  const team = await this.find({ managerId, isDeleted: false });
  return {
    totalMembers: team.length,
    active: team.filter(u => u.status === 'active').length,
    onLeave: team.filter(u => u.status === 'on_leave').length,
    inactive: team.filter(u => u.status === 'inactive').length,
    avgTenure: team.reduce((sum, u) => sum + u.tenureDays, 0) / (team.length || 1),
    members: team
  };
};

// Static method: Validate unique employee ID
userSchema.statics.isEmployeeIdUnique = async function(employeeId, excludeId = null) {
  const query = { employeeId };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await this.findOne(query);
  return !existing;
};

// Instance method: Check if certifications are valid
userSchema.methods.getValidCertifications = function() {
  const now = new Date();
  return this.certifications.filter(cert => !cert.expiryDate || cert.expiryDate > now);
};

// Instance method: Check if any certifications are expiring soon
userSchema.methods.getExpiringCertifications = function(daysThreshold = 30) {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return this.certifications.filter(cert => 
    cert.expiryDate && cert.expiryDate > now && cert.expiryDate <= threshold
  );
};

// Static method: Get high performers
userSchema.statics.getHighPerformers = async function(minRating = 4, limit = 10) {
  return this.aggregate([
    { $match: { 'performanceRatings': { $exists: true, $ne: [] }, isDeleted: false } },
    { $unwind: '$performanceRatings' },
    { $match: { 'performanceRatings.rating': { $gte: minRating } } },
    { $group: { _id: '$_id', name: { $first: '$name' }, avgRating: { $avg: '$performanceRatings.rating' }, count: { $sum: 1 } } },
    { $sort: { avgRating: -1 } },
    { $limit: limit }
  ]);
};

module.exports = mongoose.model('User', userSchema);
