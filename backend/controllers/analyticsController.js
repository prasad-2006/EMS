const LeaveRequest = require('../models/LeaveRequest');
const { departmentMembershipQuery } = require('../services/userDepartmentService');
const User = require('../models/User');
const Department = require('../models/Department');
const Task = require('../models/Task');
const Project = require('../models/Project');

// Impact analysis for a leave request or date range
exports.getImpactAnalysis = async (req, res) => {
  try {
    const { leaveId, userId, startDate: sDate, endDate: eDate } = req.query;
    let startDate = sDate ? new Date(sDate) : null;
    let endDate = eDate ? new Date(eDate) : null;
    let user = null;

    if (leaveId) {
      const leave = await LeaveRequest.findById(leaveId).populate('userId', 'department name');
      if (!leave) return res.status(404).json({ success: false, error: 'Leave not found' });
      user = leave.userId;
      startDate = new Date(leave.startDate);
      endDate = new Date(leave.endDate);
    } else if (userId && startDate && endDate) {
      user = await User.findById(userId).select('department name');
      if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    } else {
      return res.status(400).json({ success: false, error: 'Provide leaveId or (userId, startDate, endDate)' });
    }

    // Coverage: total employees in department vs projected max on leave
    const departmentId = user.department;
    const totalEmployees = departmentId
      ? await User.countDocuments({ department: departmentId, role: { $in: ['employee', 'manager', 'hr'] }, status: { $in: ['approved', 'active'] } })
      : 0;

    const overlappingLeaves = await LeaveRequest.find({
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: endDate },
      endDate: { $gte: startDate }
    }).populate('userId', 'department');

    const relevantLeaves = overlappingLeaves.filter(l => l.userId && l.userId.department && departmentId && l.userId.department.toString() === departmentId.toString());

    // Compute max existing on leave during the period
    let maxExistingOnLeave = 0;
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const activeCount = relevantLeaves.filter((lv) => {
        const ls = new Date(lv.startDate);
        const le = new Date(lv.endDate);
        return ls <= cursor && le >= cursor;
      }).length;
      if (activeCount > maxExistingOnLeave) maxExistingOnLeave = activeCount;
      cursor.setDate(cursor.getDate() + 1);
    }

    const maxOnLeaveIncludingRequest = maxExistingOnLeave + 1;
    const projectedCoveragePercentage = totalEmployees ? Number(((maxOnLeaveIncludingRequest / totalEmployees) * 100).toFixed(2)) : 0;

    // Task conflicts for the user
    const conflictingTasks = await Task.findConflictTasks(user._id, startDate, endDate);
    const urgentTasks = conflictingTasks.filter(t => ['high', 'critical'].includes(t.priority));

    // Project impact summary
    const projectBuckets = {};
    for (const t of conflictingTasks) {
      const pid = t.projectId ? t.projectId.toString() : 'unassigned';
      projectBuckets[pid] = projectBuckets[pid] || { projectId: pid, count: 0, urgent: 0 };
      projectBuckets[pid].count += 1;
      if (['high', 'critical'].includes(t.priority)) projectBuckets[pid].urgent += 1;
    }

    // Enrich with project names where possible
    const projectIds = Object.keys(projectBuckets).filter(id => id !== 'unassigned');
    const projects = projectIds.length ? await Project.find({ _id: { $in: projectIds } }).select('name') : [];
    const projectMap = projects.reduce((acc, p) => { acc[p._id.toString()] = p.name; return acc; }, {});
    const projectImpact = Object.values(projectBuckets).map(b => ({
      projectId: b.projectId,
      projectName: b.projectId === 'unassigned' ? 'Unassigned' : (projectMap[b.projectId] || 'Unknown'),
      taskCount: b.count,
      urgentCount: b.urgent
    }));

    return res.json({
      success: true,
      data: {
        user: { id: user._id, name: user.name },
        dateRange: { startDate, endDate },
        coverage: { totalEmployees, maxOnLeaveIncludingRequest, projectedCoveragePercentage },
        taskConflicts: { total: conflictingTasks.length, urgentCount: urgentTasks.length, tasks: conflictingTasks },
        projectImpact
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while computing impact analysis' });
  }
};

// Get team availability for a date range
exports.getTeamAvailability = async (req, res) => {
  try {
    const { startDate, endDate, departmentId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Build filter
    const filter = {};
    if (departmentId) {
      filter.department = departmentId;
    }
    
    // Get all employees
    const totalEmployees = await User.countDocuments({ ...filter, status: 'approved' });
    
    // Get employees on leave in the date range
    const leaveFilter = {
      status: 'approved',
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    };
    
    const leavesInRange = await LeaveRequest.find(leaveFilter)
      .populate('userId', 'name email department')
      .sort({ startDate: 1 });
    
    // Filter by department if specified
    let employeesOnLeave = leavesInRange;
    if (departmentId) {
      employeesOnLeave = leavesInRange.filter(
        leave => leave.userId && leave.userId.department && 
        leave.userId.department.toString() === departmentId
      );
    }
    
    const onLeaveCount = new Set(employeesOnLeave.map(l => l.userId._id.toString())).size;
    
    res.json({
      success: true,
      data: {
        totalEmployees,
        availableEmployees: totalEmployees - onLeaveCount,
        onLeaveCount,
        leaves: employeesOnLeave,
        dateRange: { startDate: start, endDate: end }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team availability',
      message: error.message
    });
  }
};

// Get department-wise availability
exports.getDepartmentAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = date ? new Date(date) : new Date();
    
    const departments = await Department.find({ isActive: true });
    
    const availabilityData = await Promise.all(
      departments.map(async (dept) => {
        const totalEmployees = await User.countDocuments({
          ...departmentMembershipQuery(dept._id),
          status: 'approved'
        });
        
        const onLeave = await LeaveRequest.countDocuments({
          status: 'approved',
          startDate: { $lte: checkDate },
          endDate: { $gte: checkDate },
          userId: {
            $in: await User.find(departmentMembershipQuery(dept._id)).distinct('_id')
          }
        });
        
        return {
          department: {
            id: dept._id,
            name: dept.name,
            code: dept.code
          },
          totalEmployees,
          availableEmployees: totalEmployees - onLeave,
          onLeave
        };
      })
    );
    
    res.json({
      success: true,
      data: availabilityData,
      date: checkDate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch department availability',
      message: error.message
    });
  }
};

// Get leave analytics
exports.getLeaveAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, departmentId, leaveType } = req.query;
    
    const matchFilter = {};
    
    if (startDate && endDate) {
      matchFilter.startDate = { $gte: new Date(startDate) };
      matchFilter.endDate = { $lte: new Date(endDate) };
    }
    
    if (leaveType) {
      matchFilter.leaveType = leaveType;
    }
    
    // Aggregate leave statistics
    const pipeline = [
      { $match: matchFilter }
    ];
    
    // Join with user to filter by department
    if (departmentId) {
      pipeline.push(
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $match: {
            $or: [
              { 'user.department': departmentId },
              { 'user.departments': departmentId }
            ]
          }
        }
      );
    }
    
    pipeline.push(
      {
        $group: {
          _id: {
            status: '$status',
            leaveType: '$leaveType'
          },
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      },
      {
        $group: {
          _id: '$_id.status',
          leaveTypes: {
            $push: {
              type: '$_id.leaveType',
              count: '$count',
              totalDays: '$totalDays'
            }
          },
          totalRequests: { $sum: '$count' },
          totalDays: { $sum: '$totalDays' }
        }
      }
    );
    
    const analytics = await LeaveRequest.aggregate(pipeline);
    
    // Get overall statistics
    const overallStats = await LeaveRequest.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          approvedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejectedRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          },
          pendingRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          cancelledRequests: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
          },
          totalDays: { $sum: '$totalDays' }
        }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        byStatusAndType: analytics,
        overall: overallStats[0] || {
          totalRequests: 0,
          approvedRequests: 0,
          rejectedRequests: 0,
          pendingRequests: 0,
          cancelledRequests: 0,
          totalDays: 0
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leave analytics',
      message: error.message
    });
  }
};

// Get leave trends (monthly breakdown)
exports.getLeaveTrends = async (req, res) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
    
    const trends = await LeaveRequest.aggregate([
      {
        $match: {
          startDate: { $gte: startOfYear, $lte: endOfYear },
          status: 'approved'
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$startDate' },
            leaveType: '$leaveType'
          },
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' }
        }
      },
      {
        $sort: { '_id.month': 1 }
      }
    ]);
    
    res.json({
      success: true,
      data: trends,
      year: parseInt(year)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leave trends',
      message: error.message
    });
  }
};

// Get leave conflicts/overlaps
exports.getLeaveConflicts = async (req, res) => {
  try {
    const { departmentId, threshold = 3 } = req.query;
    
    // Get all approved leaves
    const leaves = await LeaveRequest.find({ status: 'approved' })
      .populate('userId', 'name department')
      .sort({ startDate: 1 });
    
    // Filter by department if specified
    let relevantLeaves = leaves;
    if (departmentId) {
      relevantLeaves = leaves.filter(
        leave => leave.userId && leave.userId.department && 
        leave.userId.department.toString() === departmentId
      );
    }
    
    // Group overlapping leaves by date
    const dateMap = new Map();
    
    relevantLeaves.forEach(leave => {
      const currentDate = new Date(leave.startDate);
      const endDate = new Date(leave.endDate);
      
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        
        if (!dateMap.has(dateKey)) {
          dateMap.set(dateKey, []);
        }
        
        dateMap.get(dateKey).push({
          leaveId: leave._id,
          employee: leave.userId.name,
          leaveType: leave.leaveType
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    // Find dates with conflicts (more than threshold employees on leave)
    const conflicts = [];
    dateMap.forEach((employees, date) => {
      if (employees.length >= threshold) {
        conflicts.push({
          date,
          employeeCount: employees.length,
          employees
        });
      }
    });
    
    res.json({
      success: true,
      data: conflicts.sort((a, b) => new Date(a.date) - new Date(b.date))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch leave conflicts',
      message: error.message
    });
  }
};
