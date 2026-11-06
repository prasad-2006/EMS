const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Task = require('../models/Task');
const Department = require('../models/Department');

/**
 * Advanced Analytics Engine
 * Provides deep insights into leave patterns, trends, and workforce stability
 */

/**
 * Get comprehensive workforce analytics
 */
const getWorkforceAnalytics = async (dateRange = {}) => {
  try {
    const { startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)), endDate = new Date() } = dateRange;

    // 1. Leave Distribution by Type
    const leaveByType = await LeaveRequest.aggregate([
      {
        $match: {
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
          status: 'approved'
        }
      },
      {
        $group: {
          _id: '$leaveType',
          count: { $sum: 1 },
          totalDays: { $sum: '$daysCount' },
          avgDays: { $avg: '$daysCount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // 2. Leave by Department
    const leaveByDepartment = await LeaveRequest.aggregate([
      {
        $match: {
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
          status: 'approved'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $group: {
          _id: '$user.department',
          usersOnLeave: { $sum: 1 },
          totalDays: { $sum: '$daysCount' },
          avgPerEmployee: { $avg: '$daysCount' }
        }
      },
      { $sort: { totalDays: -1 } }
    ]);

    // 3. Peak Leave Periods (months with most leaves)
    const peakPeriods = await LeaveRequest.aggregate([
      {
        $match: {
          startDate: { $gte: startDate },
          endDate: { $lte: endDate },
          status: 'approved'
        }
      },
      {
        $group: {
          _id: { $month: '$startDate' },
          count: { $sum: 1 },
          employees: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // 4. Handover Success Rate
    const completedHandovers = await Task.countDocuments({
      handoverStatus: 'completed',
      updatedAt: { $gte: startDate, $lte: endDate }
    });

    const allHandovers = await Task.countDocuments({
      handedOverTo: { $exists: true, $ne: null },
      updatedAt: { $gte: startDate, $lte: endDate }
    });

    const handoverSuccessRate = allHandovers > 0 ? (completedHandovers / allHandovers * 100) : 0;

    // 5. Average Time to Handle Returned Tasks
    const returnedTaskStats = await Task.aggregate([
      {
        $match: {
          handoverStatus: 'completed',
          updatedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $addFields: {
          handoverDuration: {
            $subtract: ['$updatedAt', '$handoverDate']
          }
        }
      },
      {
        $group: {
          _id: null,
          avgTimeToComplete: { $avg: '$handoverDuration' },
          minTime: { $min: '$handoverDuration' },
          maxTime: { $max: '$handoverDuration' }
        }
      }
    ]);

    return {
      leaveByType,
      leaveByDepartment,
      peakPeriods,
      handoverMetrics: {
        successRate: Math.round(handoverSuccessRate),
        completedHandovers,
        totalHandovers: allHandovers,
        avgTimeToComplete: returnedTaskStats[0]?.avgTimeToComplete || 0
      }
    };
  } catch (error) {
    console.error('Error in getWorkforceAnalytics:', error);
    throw error;
  }
};

/**
 * Predict future leave patterns
 */
const predictLeavePatterns = async () => {
  try {
    const oneYearAgo = new Date(new Date().setFullYear(new Date().getFullYear() - 1));

    // Analyze past year's leave patterns
    const historicalLeaves = await LeaveRequest.find({
      startDate: { $gte: oneYearAgo },
      status: 'approved'
    }).populate('userId', 'name department');

    // Group by employee and analyze frequency
    const employeePatterns = {};
    historicalLeaves.forEach(leave => {
      if (!employeePatterns[leave.userId._id]) {
        employeePatterns[leave.userId._id] = {
          name: leave.userId.name,
          leaves: [],
          frequency: 0,
          avgDuration: 0,
          preferredMonths: [],
          predictedNextLeave: null
        };
      }
      employeePatterns[leave.userId._id].leaves.push({
        type: leave.leaveType,
        duration: leave.daysCount,
        month: leave.startDate.getMonth() + 1
      });
    });

    // Calculate patterns
    const predictions = [];
    for (const empId in employeePatterns) {
      const pattern = employeePatterns[empId];
      const leaves = pattern.leaves;

      if (leaves.length > 0) {
        pattern.frequency = leaves.length;
        pattern.avgDuration = Math.round(leaves.reduce((sum, l) => sum + l.duration, 0) / leaves.length);

        // Find preferred months (when leaves are usually taken)
        const monthCounts = {};
        leaves.forEach(l => {
          monthCounts[l.month] = (monthCounts[l.month] || 0) + 1;
        });
        pattern.preferredMonths = Object.entries(monthCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 2)
          .map(([month]) => parseInt(month));

        // Simple prediction: next leave likely in preferred month
        const currentMonth = new Date().getMonth() + 1;
        pattern.predictedNextLeave = pattern.preferredMonths.find(m => m > currentMonth) || pattern.preferredMonths[0];

        predictions.push({
          employeeId: empId,
          name: pattern.name,
          leaveFrequency: `${pattern.frequency} leaves/year`,
          avgDuration: `${pattern.avgDuration} days`,
          preferredMonths: pattern.preferredMonths.map(m => new Date(2000, m - 1, 1).toLocaleString('en', { month: 'short' })),
          predictedNextLeaveMonth: pattern.predictedNextLeave ? new Date(2000, pattern.predictedNextLeave - 1, 1).toLocaleString('en', { month: 'short' }) : 'Unpredictable'
        });
      }
    }

    return predictions.sort((a, b) => parseInt(b.leaveFrequency) - parseInt(a.leaveFrequency));
  } catch (error) {
    console.error('Error in predictLeavePatterns:', error);
    throw error;
  }
};

/**
 * Identify department coverage risks
 */
const identifyCoverageRisks = async (upcomingDays = 30) => {
  try {
    const today = new Date();
    const futureDate = new Date(today.getTime() + upcomingDays * 24 * 60 * 60 * 1000);

    // Find all upcoming leaves in the period
    const upcomingLeaves = await LeaveRequest.find({
      startDate: { $gte: today, $lte: futureDate },
      status: 'approved'
    }).populate('userId', 'name department role');

    // Group by department
    const departmentCoverage = {};
    const departments = await Department.find();

    for (const dept of departments) {
      departmentCoverage[dept._id] = {
        name: dept.name,
        totalEmployees: dept.employeeCount || 1,
        onLeave: 0,
        coveragePercentage: 0,
        criticalRoles: [],
        riskLevel: 'LOW'
      };
    }

    // Count leaves by department
    upcomingLeaves.forEach(leave => {
      const deptId = leave.userId.department;
      if (departmentCoverage[deptId]) {
        departmentCoverage[deptId].onLeave++;
      }
    });

    // Assess risk
    for (const deptId in departmentCoverage) {
      const dept = departmentCoverage[deptId];
      dept.coveragePercentage = Math.round((dept.onLeave / dept.totalEmployees) * 100);

      if (dept.coveragePercentage >= 50) {
        dept.riskLevel = 'HIGH';
      } else if (dept.coveragePercentage >= 30) {
        dept.riskLevel = 'MEDIUM';
      }
    }

    return Object.values(departmentCoverage)
      .filter(d => d.onLeave > 0)
      .sort((a, b) => b.coveragePercentage - a.coveragePercentage);
  } catch (error) {
    console.error('Error in identifyCoverageRisks:', error);
    throw error;
  }
};

/**
 * Generate executive summary for leave management
 */
const generateExecutiveSummary = async () => {
  try {
    const today = new Date();
    const thisYear = new Date(today.getFullYear(), 0, 1);

    const summary = {};

    // Year-to-date stats
    const ytdLeaves = await LeaveRequest.countDocuments({
      startDate: { $gte: thisYear },
      status: 'approved'
    });

    const totalEmployees = await User.countDocuments({ role: 'employee' });
    const avgLeavesPerEmployee = ytdLeaves / Math.max(1, totalEmployees);

    // Current on leave
    const currentlyOnLeave = await LeaveRequest.countDocuments({
      startDate: { $lte: today },
      endDate: { $gte: today },
      status: 'approved'
    });

    // Pending approvals
    const pendingApprovals = await LeaveRequest.countDocuments({
      status: 'pending'
    });

    // Balance utilization
    const userBalances = await User.find({}).select('leaveBalance');
    const totalBalance = userBalances.reduce((sum, user) => {
      return sum + (user.leaveBalance?.annual || 0) + (user.leaveBalance?.sick || 0) + (user.leaveBalance?.casual || 0);
    }, 0);
    const avgBalancePerEmployee = totalBalance / Math.max(1, userBalances.length);

    summary.yearToDateMetrics = {
      totalLeavesApproved: ytdLeaves,
      averageLeavesPerEmployee: Math.round(avgLeavesPerEmployee * 10) / 10,
      currentlyOnLeave,
      pendingApprovals,
      avgRemainingBalance: Math.round(avgBalancePerEmployee * 10) / 10
    };

    // Trends
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthLeaves = await LeaveRequest.countDocuments({
      startDate: { $gte: lastMonthStart, $lt: today },
      status: 'approved'
    });

    summary.trends = {
      lastMonthLeaveCount: lastMonthLeaves,
      trend: lastMonthLeaves > ytdLeaves / (today.getMonth() || 1) ? 'INCREASING' : 'NORMAL'
    };

    // System health
    const coverage = await identifyCoverageRisks(30);
    const highRiskDepts = coverage.filter(d => d.riskLevel === 'HIGH').length;

    summary.systemHealth = {
      departmentsAtRisk: highRiskDepts,
      overallRiskLevel: highRiskDepts > 2 ? 'ELEVATED' : 'NORMAL',
      recommendation: highRiskDepts > 2 ? 'Review upcoming leave approvals' : 'System operating normally'
    };

    return summary;
  } catch (error) {
    console.error('Error in generateExecutiveSummary:', error);
    throw error;
  }
};

module.exports = {
  getWorkforceAnalytics,
  predictLeavePatterns,
  identifyCoverageRisks,
  generateExecutiveSummary
};
