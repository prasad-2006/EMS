const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Department name is required'],
    unique: true,
    trim: true,
    minlength: [2, 'Department name must be at least 2 characters'],
    maxlength: [100, 'Department name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Department code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    minlength: [2, 'Code must be at least 2 characters'],
    maxlength: [10, 'Code cannot exceed 10 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  parentDepartment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  assistantManagerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  hrContactId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  employeeCount: {
    type: Number,
    default: 0,
    min: 0
  },
  maxCapacity: {
    type: Number,
    min: 0
  },
  budget: {
    annual: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    fiscalYear: String,
    utilized: { type: Number, default: 0 },
    remaining: { type: Number, default: 0 }
  },
  costCenter: {
    code: String,
    name: String
  },
  location: {
    office: String,
    floor: String,
    building: String,
    city: String,
    country: { type: String, default: 'India' }
  },
  contactInfo: {
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    phone: String,
    extension: String
  },
  operatingHours: {
    timezone: { type: String, default: 'Asia/Kolkata' },
    workingDays: [{
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    }],
    startTime: String,
    endTime: String
  },
  policies: {
    leavePolicy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LeavePolicy'
    },
    maxConcurrentLeaves: { type: Number, default: 2 },
    advanceNoticeDays: { type: Number, default: 7 },
    allowBackdatedRequests: { type: Boolean, default: false }
  },
  performanceMetrics: {
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    employeeSatisfaction: { type: Number, default: 0, min: 0, max: 100 },
    turnoverRate: { type: Number, default: 0, min: 0, max: 100 },
    lastUpdated: Date
  },
  hierarchy: {
    path: String, // e.g., "/engineering/backend/api"
    depth: { type: Number, default: 0 }
  },
  tags: [String],
  metadata: {
    type: { type: String, enum: ['technical', 'non_technical', 'support', 'management', 'operations'] },
    isCritical: { type: Boolean, default: false },
    requiresSecurityClearance: { type: Boolean, default: false }
  },
  milestones: [{
    title: String,
    description: String,
    targetDate: Date,
    completedDate: Date,
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'cancelled'], default: 'pending' }
  }],
  assets: [{
    assetType: String,
    assetId: String,
    description: String,
    assignedDate: Date,
    value: Number
  }],
  history: [{
    event: { type: String, enum: ['created', 'renamed', 'manager_changed', 'restructured', 'merged', 'split', 'archived'] },
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed
  }],
  archivedAt: Date,
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  archivedReason: String,
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
departmentSchema.index({ name: 1, isActive: 1 });
departmentSchema.index({ code: 1, isActive: 1 });
departmentSchema.index({ managerId: 1, isActive: 1 });
departmentSchema.index({ parentDepartment: 1, level: 1 });
departmentSchema.index({ 'location.city': 1, isActive: 1 });
departmentSchema.index({ createdAt: -1 });

// Virtual: Calculate budget utilization percentage
departmentSchema.virtual('budgetUtilizationPercentage').get(function() {
  if (!this.budget.annual || this.budget.annual === 0) return 0;
  return Math.round((this.budget.utilized / this.budget.annual) * 100);
});

// Virtual: Check if department is at capacity
departmentSchema.virtual('isAtCapacity').get(function() {
  if (!this.maxCapacity) return false;
  return this.employeeCount >= this.maxCapacity;
});

// Virtual: Calculate available capacity
departmentSchema.virtual('availableCapacity').get(function() {
  if (!this.maxCapacity) return Infinity;
  return Math.max(0, this.maxCapacity - this.employeeCount);
});

// Virtual: Check if department is archived
departmentSchema.virtual('isArchived').get(function() {
  return !!this.archivedAt;
});

// Pre-save middleware: Update budget remaining
departmentSchema.pre('save', function(next) {
  if (this.budget && this.budget.annual) {
    this.budget.remaining = Math.max(0, this.budget.annual - (this.budget.utilized || 0));
  }
  next();
});

// Pre-save middleware: Update hierarchy path
departmentSchema.pre('save', async function(next) {
  if (this.isModified('parentDepartment') || this.isNew) {
    if (this.parentDepartment) {
      const parent = await this.constructor.findById(this.parentDepartment);
      if (parent) {
        this.hierarchy.path = `${parent.hierarchy.path}/${this.code}`;
        this.hierarchy.depth = parent.hierarchy.depth + 1;
        this.level = parent.level + 1;
      }
    } else {
      this.hierarchy.path = `/${this.code}`;
      this.hierarchy.depth = 0;
      this.level = 0;
    }
  }
  next();
});

// Soft delete query middleware
departmentSchema.pre(/^find/, function(next) {
  this.where({ isDeleted: { $ne: true } });
  next();
});

// Instance method: Add employee count
departmentSchema.methods.incrementEmployeeCount = async function(count = 1) {
  this.employeeCount += count;
  return this.save();
};

// Instance method: Decrease employee count
departmentSchema.methods.decrementEmployeeCount = async function(count = 1) {
  this.employeeCount = Math.max(0, this.employeeCount - count);
  return this.save();
};

// Instance method: Update budget utilization
departmentSchema.methods.updateBudgetUtilization = async function(amount) {
  if (!this.budget) this.budget = {};
  this.budget.utilized = (this.budget.utilized || 0) + amount;
  this.budget.remaining = Math.max(0, (this.budget.annual || 0) - this.budget.utilized);
  return this.save();
};

// Instance method: Archive department
departmentSchema.methods.archive = async function(userId, reason) {
  this.isActive = false;
  this.archivedAt = new Date();
  this.archivedBy = userId;
  this.archivedReason = reason;
  this.history.push({
    event: 'archived',
    description: reason,
    performedBy: userId,
    timestamp: new Date()
  });
  return this.save();
};

// Instance method: Get sub-departments
departmentSchema.methods.getSubDepartments = function() {
  return this.constructor.find({ parentDepartment: this._id, isDeleted: false });
};

// Instance method: Get all descendants
departmentSchema.methods.getAllDescendants = async function() {
  const descendants = [];
  const queue = [this._id];
  
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = await this.constructor.find({ parentDepartment: currentId, isDeleted: false });
    
    for (const child of children) {
      descendants.push(child);
      queue.push(child._id);
    }
  }
  
  return descendants;
};

// Static method: Get department tree
departmentSchema.statics.getDepartmentTree = async function(rootId = null) {
  const buildTree = async (parentId) => {
    const departments = await this.find({ 
      parentDepartment: parentId, 
      isActive: true,
      isDeleted: false 
    }).sort({ name: 1 });
    
    const tree = [];
    for (const dept of departments) {
      const node = dept.toObject();
      node.children = await buildTree(dept._id);
      tree.push(node);
    }
    
    return tree;
  };
  
  return buildTree(rootId);
};

// Static method: Search departments
departmentSchema.statics.searchDepartments = function(searchText, filters = {}) {
  const query = {
    isDeleted: false,
    $or: [
      { name: { $regex: searchText, $options: 'i' } },
      { code: { $regex: searchText, $options: 'i' } },
      { description: { $regex: searchText, $options: 'i' } }
    ]
  };
  
  if (filters.isActive !== undefined) query.isActive = filters.isActive;
  if (filters.location) query['location.city'] = filters.location;
  if (filters.type) query['metadata.type'] = filters.type;
  
  return this.find(query);
};

// Static method: Get department statistics
departmentSchema.statics.getStatistics = async function() {
  return this.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        totalDepartments: { $sum: 1 },
        activeDepartments: {
          $sum: { $cond: ['$isActive', 1, 0] }
        },
        totalEmployees: { $sum: '$employeeCount' },
        averageEmployeesPerDept: { $avg: '$employeeCount' },
        totalBudget: { $sum: '$budget.annual' },
        totalUtilized: { $sum: '$budget.utilized' }
      }
    }
  ]);
};

// Instance method: Get team analytics
departmentSchema.methods.getTeamAnalytics = async function() {
  const User = require('./User');
  const employees = await User.find({ department: this._id, isDeleted: false });
  
  return {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    onLeave: employees.filter(e => e.status === 'on_leave').length,
    managers: employees.filter(e => e.role === 'manager').length,
    roles: employees.reduce((acc, emp) => {
      acc[emp.role] = (acc[emp.role] || 0) + 1;
      return acc;
    }, {}),
    avgTenure: employees.length > 0 
      ? Math.round(employees.reduce((sum, e) => sum + e.tenureDays, 0) / employees.length)
      : 0
  };
};

// Instance method: Validate budget availability
departmentSchema.methods.validateBudgetAvailability = function(requestedAmount) {
  const available = this.budget.remaining || 0;
  return {
    available: available >= requestedAmount,
    currentBudget: this.budget.annual,
    utilized: this.budget.utilized,
    remaining: this.budget.remaining,
    requested: requestedAmount
  };
};

// Instance method: Record milestone completion
departmentSchema.methods.completeMilestone = async function(milestoneIndex) {
  if (this.milestones[milestoneIndex]) {
    this.milestones[milestoneIndex].status = 'completed';
    this.milestones[milestoneIndex].completedDate = new Date();
  }
  return this.save();
};

// Instance method: Get performance score
departmentSchema.methods.getPerformanceScore = function() {
  const { averageRating = 0, employeeSatisfaction = 0, turnoverRate = 0 } = this.performanceMetrics;
  // Score based on weighted average
  const score = (averageRating * 40 + employeeSatisfaction * 40 + (100 - turnoverRate) * 20) / 100;
  return Math.round(score);
};

// Static method: Find departments by metadata type
departmentSchema.statics.findByType = function(type, includeArchived = false) {
  const query = { 'metadata.type': type };
  if (!includeArchived) query.isActive = true;
  return this.find(query).sort({ name: 1 });
};

// Static method: Get critical departments
departmentSchema.statics.getCriticalDepartments = function() {
  return this.find({ 
    'metadata.isCritical': true, 
    isActive: true,
    isDeleted: false
  });
};

// Static method: Get departments needing security clearance
departmentSchema.statics.getSecuritySensitiveDepartments = function() {
  return this.find({
    'metadata.requiresSecurityClearance': true,
    isDeleted: false
  });
};

// Static method: Generate org chart
departmentSchema.statics.generateOrgChart = async function() {
  return this.aggregate([
    { $match: { isActive: true, isDeleted: false } },
    { $lookup: { from: 'users', localField: 'managerId', foreignField: '_id', as: 'manager' } },
    { $unwind: { path: '$manager', preserveNullAndEmptyArrays: true } },
    { $sort: { 'hierarchy.depth': 1, name: 1 } },
    { $group: {
      _id: '$parentDepartment',
      departments: { $push: '$$ROOT' }
    }}
  ]);
};

// Static method: Validate department restructuring
departmentSchema.statics.validateRestructuring = async function(sourceDeptId, targetDeptId) {
  const sourceHierarchy = await this.findById(sourceDeptId).select('hierarchy');
  const targetHierarchy = await this.findById(targetDeptId).select('hierarchy');
  
  // Check if target is child of source (would create circular reference)
  if (targetHierarchy.hierarchy.path.startsWith(sourceHierarchy.hierarchy.path)) {
    return {
      valid: false,
      error: 'Cannot move a parent department under its children'
    };
  }
  
  return { valid: true };
};

module.exports = mongoose.model('Department', departmentSchema);
