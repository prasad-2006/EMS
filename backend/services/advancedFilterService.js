const LeaveRequest = require('../models/LeaveRequest');
const Task = require('../models/Task');
const User = require('../models/User');

/**
 * Advanced Filtering Engine
 * Provides sophisticated search and filter capabilities
 */

/**
 * Filter leaves with multiple criteria
 */
const filterLeaves = async (criteria = {}) => {
  try {
    const {
      status,
      leaveType,
      department,
      dateRange = {},
      approvalLevel,
      priorityLevel,
      page = 1,
      limit = 20
    } = criteria;

    let query = {};

    // Status filter
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }

    // Leave type filter
    if (leaveType) {
      query.leaveType = Array.isArray(leaveType) ? { $in: leaveType } : leaveType;
    }

    // Date range filter
    if (dateRange.start || dateRange.end) {
      query.startDate = {};
      if (dateRange.start) query.startDate.$gte = new Date(dateRange.start);
      if (dateRange.end) query.startDate.$lte = new Date(dateRange.end);
    }

    // Approval level filter
    if (approvalLevel) {
      query.approvalLevel = approvalLevel;
    }

    // Priority filter
    if (priorityLevel) {
      query.priority = Array.isArray(priorityLevel) ? { $in: priorityLevel } : priorityLevel;
    }

    // Department filter
    if (department) {
      // First find users in department
      const deptUsers = await User.find({ department }).select('_id');
      const userIds = deptUsers.map(u => u._id);
      query.userId = { $in: userIds };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query
    const leaves = await LeaveRequest.find(query)
      .populate('userId', 'name email department')
      .populate('approvalWorkflow.approvedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await LeaveRequest.countDocuments(query);

    return {
      data: leaves,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error in filterLeaves:', error);
    throw error;
  }
};

/**
 * Advanced task filtering with multiple criteria
 */
const filterTasks = async (criteria = {}) => {
  try {
    const {
      status,
      priority,
      assignedTo,
      assignedBy,
      isRecurring,
      hasDeadline,
      deadlineRange = {},
      department,
      isHandedOver,
      page = 1,
      limit = 20,
      sortBy = 'deadline',
      sortOrder = -1
    } = criteria;

    let query = {};

    // Status filter
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }

    // Priority filter
    if (priority) {
      query.priority = Array.isArray(priority) ? { $in: priority } : priority;
    }

    // Assigned to filter
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    // Assigned by filter
    if (assignedBy) {
      query.createdBy = assignedBy;
    }

    // Recurring filter
    if (isRecurring !== undefined) {
      query.isRecurring = isRecurring;
    }

    // Deadline filter
    if (hasDeadline !== undefined) {
      if (hasDeadline) {
        query.deadline = { $exists: true, $ne: null };
      } else {
        query.deadline = { $exists: false };
      }
    }

    // Deadline range filter
    if (deadlineRange.start || deadlineRange.end) {
      query.deadline = {};
      if (deadlineRange.start) query.deadline.$gte = new Date(deadlineRange.start);
      if (deadlineRange.end) query.deadline.$lte = new Date(deadlineRange.end);
    }

    // Department filter
    if (department) {
      const deptUsers = await User.find({ department }).select('_id');
      const userIds = deptUsers.map(u => u._id);
      query.assignedTo = { $in: userIds };
    }

    // Handed over filter
    if (isHandedOver !== undefined) {
      if (isHandedOver) {
        query.handedOverTo = { $exists: true, $ne: null };
      } else {
        query.handedOverTo = { $exists: false };
      }
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder;

    // Execute query
    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email')
      .populate('createdBy', 'name email')
      .populate('handedOverTo', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(limit);

    const total = await Task.countDocuments(query);

    return {
      data: tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error in filterTasks:', error);
    throw error;
  }
};

/**
 * Search across multiple entities at once
 */
const globalSearch = async (searchTerm, entityTypes = ['leaves', 'tasks', 'users']) => {
  try {
    const results = {};

    // Search leaves
    if (entityTypes.includes('leaves')) {
      results.leaves = await LeaveRequest.find({
        $or: [
          { reason: { $regex: searchTerm, $options: 'i' } },
          { 'approvalWorkflow.comment': { $regex: searchTerm, $options: 'i' } }
        ]
      }).populate('userId', 'name email').limit(10);
    }

    // Search tasks
    if (entityTypes.includes('tasks')) {
      results.tasks = await Task.find({
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { handoverNote: { $regex: searchTerm, $options: 'i' } }
        ]
      }).populate('assignedTo', 'name email').limit(10);
    }

    // Search users
    if (entityTypes.includes('users')) {
      results.users = await User.find({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } }
        ]
      }).select('_id name email department role').limit(10);
    }

    return results;
  } catch (error) {
    console.error('Error in globalSearch:', error);
    throw error;
  }
};

/**
 * Find employees with specific availability
 */
const findAvailableEmployees = async (criteria = {}) => {
  try {
    const {
      dateRange = {},
      department,
      minAvailableDays = 1,
      excludeUsers = []
    } = criteria;

    const startDate = dateRange.start ? new Date(dateRange.start) : new Date();
    const endDate = dateRange.end ? new Date(dateRange.end) : new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Find employees on leave during period
    const onLeaveDuringPeriod = await LeaveRequest.find({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
      status: 'approved'
    }).distinct('userId');

    // Query for available employees
    let query = {
      role: 'employee',
      _id: { $nin: [...onLeaveDuringPeriod, ...excludeUsers] }
    };

    if (department) {
      query.department = department;
    }

    const availableEmployees = await User.find(query)
      .select('name email department leaveBalance')
      .sort({ name: 1 });

    // Calculate availability percentage for period
    const availabilityWithDetails = availableEmployees.map(emp => ({
      userId: emp._id,
      name: emp.name,
      email: emp.email,
      department: emp.department,
      leaveBalance: emp.leaveBalance,
      availabilityPercentage: 100, // Not on leave
      daysAvailable: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))
    }));

    return availabilityWithDetails.filter(e => e.daysAvailable >= minAvailableDays);
  } catch (error) {
    console.error('Error in findAvailableEmployees:', error);
    throw error;
  }
};

module.exports = {
  filterLeaves,
  filterTasks,
  globalSearch,
  findAvailableEmployees
};
