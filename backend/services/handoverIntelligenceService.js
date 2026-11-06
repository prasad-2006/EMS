const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { departmentMembershipInQuery } = require('./userDepartmentService');

/**
 * Analyze all flagged tasks and provide intelligent insights
 * Enhancements:
 * - Task dependencies (which tasks block others)
 * - Complexity scoring
 * - Risk assessment
 * - Smart backup suggestion
 */
const analyzeHandoverRisks = async (leaveId, userId) => {
  try {
    const leave = await LeaveRequest.findById(leaveId).populate('userId');
    if (!leave) throw new Error('Leave request not found');

    const employee = leave.userId;
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);
    const leaveDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    // Get all flagged tasks
    const flaggedTasks = await Task.find({
      assignedTo: userId,
      status: { $nin: ['done', 'cancelled'] },
      $or: [
        { deadline: { $gte: startDate, $lte: endDate } },
        { isRecurring: true }
      ]
    }).populate('createdBy', 'name email');

    // Analysis engine
    const analysis = {
      totalTasks: flaggedTasks.length,
      riskLevel: 'LOW',
      estimatedWorkload: 0,
      recommendedBackups: [],
      dependencies: [],
      criticalAlerts: [],
      summary: {}
    };

    // 1. Calculate complexity and effort for each task
    const taskAnalysis = flaggedTasks.map(task => {
      const isDeadlineUrgent = task.deadline && (task.deadline - startDate) < 2 * 24 * 60 * 60 * 1000; // Within 2 days
      const priorityScore = { critical: 4, high: 3, medium: 2, low: 1 }[task.priority] || 2;
      const effortEstimate = task.estimatedHours || (priorityScore * 8); // Default 8-32 hours based on priority
      const complexityScore = Math.min(5, Math.ceil(effortEstimate / 8)); // Scale 1-5

      return {
        ...task.toObject(),
        isUrgent: isDeadlineUrgent,
        complexityScore,
        effortEstimate,
        riskScore: (priorityScore * complexityScore) / 25 // Normalized 0-1
      };
    });

    // 2. Find task dependencies (tasks that depend on flagged tasks)
    const dependentTasks = await Task.find({
      assignedTo: { $ne: userId },
      blockedByTasks: { $in: flaggedTasks.map(t => t._id) }
    }).populate('assignedTo', 'name email');

    analysis.dependencies = dependentTasks.map(d => ({
      taskId: d._id,
      taskTitle: d.title,
      blockedBy: flaggedTasks.filter(f => f._id.toString() === d.blockedByTasks?.[0]?.toString())[0]?.title,
      assignedTo: d.assignedTo.name
    }));

    // 3. Calculate total workload
    analysis.estimatedWorkload = taskAnalysis.reduce((sum, t) => sum + t.effortEstimate, 0);

    // 4. Assess risk level
    const criticalCount = taskAnalysis.filter(t => t.priority === 'critical').length;
    const urgentCount = taskAnalysis.filter(t => t.isUrgent).length;
    const totalWorkloadHours = analysis.estimatedWorkload;

    if (criticalCount > 2 || urgentCount > 3 || totalWorkloadHours > leaveDays * 8) {
      analysis.riskLevel = 'HIGH';
      analysis.criticalAlerts.push(
        `⚠️ HIGH WORKLOAD: ${analysis.estimatedWorkload} hours over ${leaveDays} days`
      );
    } else if (criticalCount > 0 || urgentCount > 1) {
      analysis.riskLevel = 'MEDIUM';
      analysis.criticalAlerts.push(
        `⚡ URGENT TASKS: ${urgentCount} urgent task(s) with deadlines in first 2 days`
      );
    }

    // 5. Find best backup candidates
    const employeeDepartmentIds = [employee.department, ...(employee.departments || [])].filter(Boolean);
    const teamMemberFilter = {
      role: 'employee',
      _id: { $ne: userId }
    };
    if (employeeDepartmentIds.length > 0) {
      Object.assign(teamMemberFilter, departmentMembershipInQuery(employeeDepartmentIds));
    }
    const teamMembers = await User.find(teamMemberFilter).select('_id name email leaveBalance');

    const backupCandidates = [];
    for (const member of teamMembers) {
      // Count their current workload
      const memberLoadCount = await Task.countDocuments({
        assignedTo: member._id,
        status: { $in: ['todo', 'in-progress'] }
      });

      // Check if they have upcoming leave during this period
      const hasSelfLeave = await LeaveRequest.findOne({
        userId: member._id,
        status: 'approved',
        $or: [
          { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
        ]
      });

      const availabilityScore = Math.max(0, 10 - memberLoadCount); // 0-10, higher is better
      const canHandle = memberLoadCount < 15; // Arbitrary threshold

      backupCandidates.push({
        userId: member._id,
        name: member.name,
        currentWorkload: memberLoadCount,
        availabilityScore,
        canHandle,
        hasConflict: !!hasSelfLeave
      });
    }

    // Sort by availability and filter out those with conflicts
    analysis.recommendedBackups = backupCandidates
      .filter(c => !c.hasConflict && c.canHandle)
      .sort((a, b) => b.availabilityScore - a.availabilityScore)
      .slice(0, 3);

    // 6. Generate summary
    analysis.summary = {
      totalFlaggedTasks: analysis.totalTasks,
      deadlineConflicts: taskAnalysis.filter(t => t.deadline).length,
      recurringTasksCount: flaggedTasks.filter(t => t.isRecurring).length,
      criticalTasksCount: criticalCount,
      urgentTasksCount: urgentCount,
      estimatedTotalHours: Math.round(analysis.estimatedWorkload),
      workloadPerDay: Math.round(analysis.estimatedWorkload / Math.max(1, leaveDays)),
      suggestedAction: analysis.riskLevel === 'HIGH' 
        ? 'Consider postponing leave or getting HR approval'
        : analysis.riskLevel === 'MEDIUM'
          ? 'Assign critical tasks to most available team member'
          : 'Clear to proceed with standard handover'
    };

    return analysis;
  } catch (error) {
    console.error('Error in analyzeHandoverRisks:', error);
    throw error;
  }
};

/**
 * Suggest best backup person based on:
 * - Current workload
 * - Skills/expertise match
 * - Availability
 * - Past handover success rate
 */
const suggestOptimalBackup = async (flaggedTasks, department) => {
  try {
    const teamMembers = await User.find({
      department,
      role: 'employee'
    }).select('_id name email skills carryOverSuccessRate');

    const suggestions = [];

    for (const member of teamMembers) {
      // Calculate current workload
      const workload = await Task.countDocuments({
        assignedTo: member._id,
        status: { $in: ['todo', 'in-progress'] }
      });

      // Check skills match (simplified)
      const taskSkillsNeeded = new Set();
      flaggedTasks.forEach(t => {
        if (t.requiredSkills) {
          t.requiredSkills.forEach(s => taskSkillsNeeded.add(s));
        }
      });

      const skillsMatched = member.skills ? 
        Array.from(taskSkillsNeeded).filter(s => member.skills.includes(s)).length : 0;
      const skillScore = taskSkillsNeeded.size > 0 ? skillsMatched / taskSkillsNeeded.size : 0.5;

      // Success rate (if available from past handovers)
      const successRate = member.carryOverSuccessRate || 0.85;

      // Calculate composite score
      const workloadScore = Math.max(0, 1 - (workload / 20)); // Normalized 0-1
      const compositeScore = (workloadScore * 0.4) + (skillScore * 0.3) + (successRate * 0.3);

      suggestions.push({
        userId: member._id,
        name: member.name,
        email: member.email,
        currentWorkload: workload,
        skillsMatch: `${Math.round(skillScore * 100)}%`,
        successRate: `${Math.round(successRate * 100)}%`,
        overallScore: Math.round(compositeScore * 100)
      });
    }

    return suggestions.sort((a, b) => b.overallScore - a.overallScore);
  } catch (error) {
    console.error('Error in suggestOptimalBackup:', error);
    throw error;
  }
};

module.exports = {
  analyzeHandoverRisks,
  suggestOptimalBackup
};
