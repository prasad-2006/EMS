const LeavePolicy = require('../models/LeavePolicy');
const User = require('../models/User');
const Notification = require('../models/Notification');

const notifyUsersAboutPolicy = async (action, policy) => {
  try {
    const users = await User.find({ role: { $ne: 'admin' } }).select('_id role status');
    const recipients = users.filter(
      (user) => user.role !== 'employee' || user.status === 'approved'
    );

    if (!recipients.length) return;

    let title = 'Leave policy updated';
    let message = `Policy "${policy.name}" has been updated. Please review the latest company leave rules.`;

    if (action === 'created') {
      title = 'New leave policy announced';
      message = `A new leave policy "${policy.name}" has been published by admin.`;
    }

    if (action === 'deleted') {
      title = 'Leave policy removed';
      message = `Policy "${policy.name}" has been removed by admin.`;
    }

    const payload = recipients.map((user) => ({
      userId: user._id,
      type: 'system',
      title,
      message
    }));

    await Notification.insertMany(payload, { ordered: false });
  } catch (error) {
    console.error('Failed to create policy notifications:', error.message);
  }
};

// Get all policies
exports.getAllPolicies = async (req, res) => {
  try {
    const { page = 1, limit = 20, isActive } = req.query;
    
    const filter = {};
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    const policies = await LeavePolicy.find(filter)
      .populate('applicableDepartments', 'name code')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ isDefault: -1, name: 1 });
    
    const total = await LeavePolicy.countDocuments(filter);
    
    res.json({
      success: true,
      data: policies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch policies',
      message: error.message
    });
  }
};

// Get default policy
exports.getDefaultPolicy = async (req, res) => {
  try {
    const now = new Date();
    let policy = await LeavePolicy.findOne({
      isDefault: true,
      status: 'active',
      effectiveFrom: { $lte: now },
      $or: [
        { effectiveTo: null },
        { effectiveTo: { $exists: false } },
        { effectiveTo: { $gte: now } }
      ]
    }).sort({ updatedAt: -1 });

    if (!policy) {
      policy = await LeavePolicy.findOne({ status: 'active' }).sort({ isDefault: -1, updatedAt: -1 });
    }
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'No default policy found'
      });
    }
    
    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch default policy',
      message: error.message
    });
  }
};

// Get policy by ID
exports.getPolicyById = async (req, res) => {
  try {
    const policy = await LeavePolicy.findById(req.params.id)
      .populate('applicableDepartments', 'name code');
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }
    
    res.json({
      success: true,
      data: policy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch policy',
      message: error.message
    });
  }
};

// Create policy
exports.createPolicy = async (req, res) => {
  try {
    const policy = await LeavePolicy.create(req.body);
    await notifyUsersAboutPolicy('created', policy);
    
    res.status(201).json({
      success: true,
      message: 'Policy created successfully',
      data: policy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to create policy',
      message: error.message
    });
  }
};

// Update policy
exports.updatePolicy = async (req, res) => {
  try {
    const policy = await LeavePolicy.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    await notifyUsersAboutPolicy('updated', policy);
    
    res.json({
      success: true,
      message: 'Policy updated successfully',
      data: policy
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update policy',
      message: error.message
    });
  }
};

// Delete policy
exports.deletePolicy = async (req, res) => {
  try {
    const policy = await LeavePolicy.findById(req.params.id);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }
    
    if (policy.isDefault) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the default policy'
      });
    }
    
    await notifyUsersAboutPolicy('deleted', policy);

    await policy.deleteOne();
    
    res.json({
      success: true,
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete policy',
      message: error.message
    });
  }
};

// Validate leave request against policy
exports.validateLeaveRequest = async (req, res) => {
  try {
    const { leaveType, totalDays, userId, departmentId } = req.body;
    
    // Find applicable policy
    const now = new Date();
    let policy = await LeavePolicy.findOne({
      status: 'active',
      effectiveFrom: { $lte: now },
      $and: [
        {
          $or: [
            { effectiveTo: null },
            { effectiveTo: { $exists: false } },
            { effectiveTo: { $gte: now } }
          ]
        },
        {
          $or: [
            { applicableDepartments: departmentId },
            { applicableDepartments: { $size: 0 } }
          ]
        }
      ]
    }).sort({ isDefault: 1 });
    
    if (!policy) {
      policy = await LeavePolicy.findOne({ isDefault: true, status: 'active' });
    }
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'No applicable policy found'
      });
    }
    
    const leaveTypePolicy = policy.leaveTypes[leaveType];
    
    if (!leaveTypePolicy) {
      return res.status(400).json({
        success: false,
        error: 'Invalid leave type'
      });
    }
    
    const violations = [];
    
    // Check max consecutive days
    if (totalDays > leaveTypePolicy.maxConsecutive) {
      violations.push(`Maximum consecutive ${leaveType} leave is ${leaveTypePolicy.maxConsecutive} days`);
    }
    
    // Check if document required
    if (leaveTypePolicy.documentRequiredAfterDays && 
        totalDays > leaveTypePolicy.documentRequiredAfterDays) {
      violations.push(`Document required for ${leaveType} leave exceeding ${leaveTypePolicy.documentRequiredAfterDays} days`);
    }
    
    res.json({
      success: true,
      isValid: violations.length === 0,
      violations,
      policy: {
        name: policy.name,
        leaveTypeRules: leaveTypePolicy,
        approvalWorkflow: policy.approvalWorkflow
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to validate leave request',
      message: error.message
    });
  }
};
