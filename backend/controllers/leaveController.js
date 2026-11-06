const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Task = require('../models/Task');
const Project = require('../models/Project');
const Notification = require('../models/Notification');
const ActionHistory = require('../models/ActionHistory');
const LeavePolicy = require('../models/LeavePolicy');
const Holiday = require('../models/Holiday');
const mongoose = require('mongoose');

const URGENT_TASK_PRIORITIES = new Set(['high', 'critical']);

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Coverage bonus paid to a peer who accepts to complete a task while the
// original assignee is on leave. Base Rs.500 + Rs.250 per estimated hour.
const calcCoverageBonus = (task) => {
  const estimatedHours = Number(task.estimatedHours) || 2;
  return Math.max(500, Math.round(estimatedHours * 250));
};

const getLeaveDatesLabel = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
};

// ---------------------------------------------------------------------------
// Leave coverage: find peers with the SAME SKILL working on the SAME task
// (i.e. assigned to tasks in the same projects as the leaver's conflict tasks)
// and notify them that the leaver's tasks need coverage on their dashboard.
// ---------------------------------------------------------------------------
const notifyCoverageCandidates = async ({ leaveRequest, session }) => {
  const leaver = await User.findById(leaveRequest.userId).session(session);
  if (!leaver) return { notified: 0, candidates: [] };

  const conflictingTasks = await getLeaveConflictingTasks({
    userId: leaveRequest.userId,
    startDateInput: leaveRequest.startDate,
    endDateInput: leaveRequest.endDate,
    session
  });

  const coverableTasks = conflictingTasks.filter((task) =>
    !['done', 'cancelled'].includes(task.status)
  );
  if (coverableTasks.length === 0 || leaveRequest.status !== 'approved') {
    return { notified: 0, candidates: [] };
  }

  const taskIds = coverableTasks.map((task) => task._id);
  const projectIds = [...new Set(coverableTasks.map((task) => task.projectId).filter(Boolean))];
  const leaverSkills = (leaver.skills || [])
    .map((skill) => String(skill).trim().toLowerCase())
    .filter(Boolean);

  const baseCandidateFilter = {
    _id: { $ne: leaver._id },
    role: { $in: ['employee', 'manager', 'hr'] },
    status: { $in: ['active', 'approved'] },
    isDeleted: { $ne: true }
  };

  // 1) Same-skill peers.
  let candidates = [];
  if (leaverSkills.length > 0) {
    const skillRegexes = leaverSkills.map((skill) => new RegExp(`^${escapeRegExp(skill)}$`, 'i'));
    candidates = await User.find({
      ...baseCandidateFilter,
      $or: [{ skills: { $in: skillRegexes } }]
    }).select('_id name email skills department').lean();
  }

  // 2) Broadcast to all project members for affected projects (user requested)
  let sameTaskPeers = [];
  if (projectIds.length > 0) {
    // Fetch project members across all related projects
    const projects = await Project.find({ _id: { $in: projectIds } }).select('members').session(session).lean();
    const memberIds = [...new Set(projects.flatMap((p) => (p.members || []).map((m) => String(m))))]
      .filter((id) => id !== String(leaver._id));

    if (memberIds.length > 0) {
      sameTaskPeers = await User.find({
        ...baseCandidateFilter,
        _id: { $in: memberIds }
      }).select('_id name email skills department').lean();
    }
  }

  // 3) Fallback: same-department peers when nothing matched above.
  let departmentPeers = [];
  if (candidates.length === 0 && sameTaskPeers.length === 0 && leaver.department) {
    departmentPeers = await User.find({
      ...baseCandidateFilter,
      department: leaver.department
    }).select('_id name email skills department').limit(10).lean();
  }

  const merged = [...candidates, ...sameTaskPeers, ...departmentPeers];
  const seen = new Set();
  const uniqueCandidates = merged.filter((candidate) => {
    const key = String(candidate._id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Exclude candidates already on approved leave overlapping these dates.
  const overlappingLeaves = await LeaveRequest.find({
    status: 'approved',
    userId: { $in: uniqueCandidates.map((c) => c._id) },
    startDate: { $lte: leaveRequest.endDate },
    endDate: { $gte: leaveRequest.startDate }
  }).select('userId').session(session);
  const onLeaveIds = new Set(overlappingLeaves.map((leave) => String(leave.userId)));

  const eligible = uniqueCandidates.filter((candidate) => !onLeaveIds.has(String(candidate._id)));

  if (eligible.length === 0) {
    return { notified: 0, candidates: [] };
  }

  const datesLabel = getLeaveDatesLabel(leaveRequest.startDate, leaveRequest.endDate);
  const notificationDocs = eligible.map((candidate) => ({
    userId: candidate._id,
    recipientGroup: 'custom',
    type: 'leave',
    category: 'warning',
    priority: 'urgent',
    actionRequired: true,
    actionLabel: 'Accept & Complete Tasks',
    actionUrl: '/tasks',
    title: `Can you complete ${leaver.name}'s tasks?`,
    message: `${leaver.name} is on ${leaveRequest.leaveType} leave (${datesLabel}) for ${leaveRequest.totalDays} day(s). ${coverableTasks.length} task(s) need coverage. Accept to take over the tasks and earn extra pay.`,
    shortMessage: `Take over ${coverableTasks.length} task(s) from ${leaver.name} & earn extra pay`,
    metadata: {
      leaveId: leaveRequest._id,
      userId: leaver._id,
      customData: {
        coverage: true,
        taskIds: taskIds.map(String),
        leaverName: leaver.name,
        coverableTasks: coverableTasks.map((task) => ({ _id: task._id, title: task.title, deadline: task.deadline })),
        leaveType: leaveRequest.leaveType,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        totalDays: leaveRequest.totalDays
      }
    },
    sentBySystem: true,
    sentBy: leaver._id
  }));

  await Notification.create(notificationDocs, { session });

  return { notified: eligible.length, candidates: eligible };
};

// @desc    Accept or decline a leave coverage request (same skill + same task)
// @route   POST /api/leave/coverage/respond
// @body    { notificationId, accept }
// @access  Private (the notified peer)
const respondToCoverageRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { notificationId, accept } = req.body;

    const notification = await Notification.findOne({
      _id: notificationId,
      userId: req.user._id
    }).session(session);

    if (!notification) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Coverage request not found' });
    }

    if (notification.actionCompleted) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'This coverage request has already been answered' });
    }

    const customData = notification.metadata?.customData || {};
    const taskIds = Array.isArray(customData.taskIds) ? customData.taskIds : [];
    const leaveId = notification.metadata?.leaveId || customData.leaveId;
    const leaverName = customData.leaverName || 'your colleague';

    let reassignedTasks = [];
    let rejectedCount = 0;

    if (accept === true || accept === 'true') {
      const tasks = await Task.find({
        _id: { $in: taskIds },
        status: { $nin: ['done', 'cancelled'] }
      }).session(session);

      for (const task of tasks) {
        task.coveredFor = task.assignedTo;
        task.assignedTo = req.user._id;
        task.isCoverageTask = true;
        task.coverageBonus = calcCoverageBonus(task);
        task.coverageLeaveId = leaveId || task.relatedLeaveId || null;
        task.coverageAcceptedAt = new Date();
        task.handoverStatus = 'accepted';
        task.handoverAcceptedAt = new Date();
        task.handoverNote = task.handoverNote
          ? `${task.handoverNote} [Covered by ${req.user.name} while ${leaverName} is on leave]`
          : `Covered by ${req.user.name} while ${leaverName} is on leave.`;
        await task.save({ session });
        reassignedTasks.push(task._id);
      }
    } else {
      rejectedCount = taskIds.length;
    }

    notification.actionCompleted = true;
    notification.actionCompletedAt = new Date();
    notification.actionData = {
      ...(notification.actionData || {}),
      response: accept ? 'accepted' : 'declined',
      respondedBy: req.user._id,
      respondedByName: req.user.name,
      respondedAt: new Date(),
      reassignedTaskIds: reassignedTasks.map(String)
    };
    await notification.save({ session });

    // Notify every other candidate that this peer already took the tasks.
    if (reassignedTasks.length > 0) {
      const siblingNotifications = await Notification.find({
        _id: { $ne: notification._id },
        'metadata.customData.coverage': true,
        'metadata.customData.taskIds': { $elemMatch: { $in: reassignedTasks.map(String) } },
        actionRequired: true,
        actionCompleted: false
      }).session(session);

      if (siblingNotifications.length > 0) {
        await Notification.updateMany(
          { _id: { $in: siblingNotifications.map((item) => item._id) } },
          {
            $set: {
              actionRequired: false,
              actionCompleted: true,
              actionCompletedAt: new Date(),
              'actionData.response': 'covered_by_peer',
              isRead: true
            }
          },
          { session }
        );
      }

      // Let the leave owner know their tasks are covered.
      const leaverId = notification.metadata?.userId || null;
      if (leaverId) {
        await Notification.create([{
          userId: leaverId,
          type: 'leave',
          category: 'success',
          title: `Your tasks are covered by ${req.user.name}`,
          message: `${req.user.name} accepted to complete ${reassignedTasks.length} task(s) while you are on leave. The tasks have been reassigned for coverage.`,
          metadata: {
            leaveId: leaveId || null,
            userId: req.user._id,
            customData: { coverage: true, taskIds: reassignedTasks.map(String), responderName: req.user.name }
          },
          sentBySystem: true
        }], { session });
      }
    }

    // Recompute and persist deduction distribution for the leave (if any)
    if (reassignedTasks.length > 0 && leaveId) {
      try {
        const leave = await LeaveRequest.findById(leaveId).session(session);
        if (leave) {
          const coverageTasks = await Task.find({
            coverageLeaveId: leave._id,
            isCoverageTask: true,
            coverageAcceptedAt: { $ne: null }
          }).session(session);

          if (coverageTasks.length > 0) {
            const distributor = require('../services/deductionDistributor');
            // ensure distributor can read leaver's monthly base
            const leaver = await User.findById(leave.userId).session(session);
            leave.leaverMonthlyBase = leaver?.salary?.monthlyBase || 60000;
            const { deductionTotal, distribution } = await distributor.distribute(leave, coverageTasks);

            leave.deductionTotal = deductionTotal;
            leave.deductionDistribution = distribution;
            leave.deductionDistributedAt = new Date();
            await leave.save({ session });

            // Create ledger entries for audit/approval
            const DeductionLedger = require('../models/DeductionLedger');
            const ledgerDocs = distribution.map((d) => ({
              leaveId: leave._id,
              fromUser: leave.userId,
              toUser: d.userId,
              amount: d.amount,
              taskIds: d.taskIds,
              createdBy: req.user._id
            }));
            if (ledgerDocs.length > 0) await DeductionLedger.create(ledgerDocs, { session });

            // Notify recipients about the compensation
            for (const entry of distribution) {
              await Notification.create([{
                userId: entry.userId,
                type: 'salary',
                category: 'success',
                title: 'Compensation for covering tasks',
                message: `${req.user.name} accepted tasks covering while on leave. You will receive extra compensation of ₹${entry.amount}.`,
                metadata: { leaveId: leave._id, amount: entry.amount, taskIds: entry.taskIds },
                sentBySystem: true
              }], { session });
            }
          }
        }
      } catch (err) {
        // Non-fatal: log and continue — distribution will be retried on next acceptance
        console.error('Error computing deduction distribution:', err);
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: accept
        ? `You accepted ${reassignedTasks.length} task(s). They were added to your task list with extra pay credit.`
        : 'You declined the coverage request.',
      data: {
        response: accept ? 'accepted' : 'declined',
        reassignedCount: reassignedTasks.length,
        reassignedTasks,
        declinedCount: rejectedCount
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while responding to coverage request' });
  }
};

const determineWorkflowStage = ({ status, taskConflicts = {}, startDate, endDate }) => {
  const now = new Date();

  if (status === 'cancelled' || status === 'rejected' || status === 'withdrawn') {
    return 'closed';
  }

  if (status === 'approved') {
    if (taskConflicts.urgentCount > 0) {
      return 'handover_pending';
    }

    if (startDate && endDate && now >= new Date(startDate) && now <= new Date(endDate)) {
      return 'leave_active';
    }

    if (endDate && now > new Date(endDate)) {
      return 'employee_returned';
    }

    return 'approved';
  }

  return 'manager_review';
};

// Helper function to calculate days between dates
const calculateDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end
  return diffDays;
};

const toDateOnly = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getApplicablePolicy = async (departmentId) => {
  const now = new Date();
  const effectiveFilter = {
    status: 'active',
    effectiveFrom: { $lte: now },
    $or: [
      { effectiveTo: null },
      { effectiveTo: { $exists: false } },
      { effectiveTo: { $gte: now } }
    ]
  };

  let policy = null;
  if (departmentId) {
    policy = await LeavePolicy.findOne({
      ...effectiveFilter,
      $or: [
        { applicableDepartments: departmentId },
        { applicableDepartments: { $size: 0 } }
      ]
    }).sort({ isDefault: -1, updatedAt: -1 });
  }

  if (!policy) {
    policy = await LeavePolicy.findOne({ ...effectiveFilter, isDefault: true }).sort({ updatedAt: -1 });
  }

  if (!policy) {
    policy = await LeavePolicy.findOne({ status: 'active' }).sort({ isDefault: -1, updatedAt: -1 });
  }

  return policy;
};

const buildHolidaySet = async (startDate, endDate) => {
  const holidays = await Holiday.find({
    isActive: true,
    status: { $in: ['published', 'completed'] },
    date: { $lte: endDate },
    endDate: { $gte: startDate }
  }).select('date endDate');

  const holidaySet = new Set();
  holidays.forEach((holiday) => {
    let cursor = toDateOnly(holiday.date);
    const end = toDateOnly(holiday.endDate || holiday.date);
    while (cursor <= end) {
      holidaySet.add(cursor.toISOString().split('T')[0]);
      cursor = addDays(cursor, 1);
    }
  });

  return holidaySet;
};

const calculateChargeableDays = async (startDateInput, endDateInput, policy) => {
  const startDate = toDateOnly(startDateInput);
  const endDate = toDateOnly(endDateInput);
  const holidaySet = await buildHolidaySet(startDate, endDate);

  const weekendCountsAsLeave = Boolean(policy?.rules?.weekendCountsAsLeave);
  const holidayCountsAsLeave = Boolean(policy?.rules?.holidayCountsAsLeave);

  let calendarDays = 0;
  let chargeableDays = 0;
  let weekendsExcluded = 0;
  let holidaysExcluded = 0;
  let cursor = new Date(startDate);

  while (cursor <= endDate) {
    calendarDays += 1;
    const dateKey = cursor.toISOString().split('T')[0];
    const dayOfWeek = cursor.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidaySet.has(dateKey);

    if (isWeekend && !weekendCountsAsLeave) {
      weekendsExcluded += 1;
      cursor = addDays(cursor, 1);
      continue;
    }

    if (isHoliday && !holidayCountsAsLeave) {
      holidaysExcluded += 1;
      cursor = addDays(cursor, 1);
      continue;
    }

    chargeableDays += 1;
    cursor = addDays(cursor, 1);
  }

  return {
    calendarDays,
    chargeableDays,
    weekendsExcluded,
    holidaysExcluded,
    weekendCountedAsLeave: weekendCountsAsLeave,
    holidayCountedAsLeave: holidayCountsAsLeave
  };
};

const buildCoverageAssessment = async ({ startDateInput, endDateInput, user }) => {
  const startDate = toDateOnly(startDateInput);
  const endDate = toDateOnly(endDateInput);
  const departmentId = user.department;
  const policy = await getApplicablePolicy(departmentId);

  const thresholds = {
    warning: Number(policy?.rules?.coverageWarningPercentage || 30),
    block: Number(policy?.rules?.coverageBlockPercentage || 50)
  };

  if (thresholds.block < thresholds.warning) {
    thresholds.block = thresholds.warning;
  }

  const totalEmployees = await User.countDocuments({
    department: departmentId,
    role: { $in: ['employee', 'manager', 'hr'] },
    status: { $in: ['approved', 'active'] }
  });

  if (!departmentId || totalEmployees === 0) {
    return {
      policy,
      riskLevel: 'risky',
      reason: 'Coverage could not be confidently evaluated for your department.',
      projectedCoveragePercentage: 0,
      totalEmployees,
      maxOnLeaveIncludingRequest: 1,
      warningThreshold: thresholds.warning,
      blockThreshold: thresholds.block
    };
  }

  const overlappingLeaves = await LeaveRequest.find({
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate }
  }).populate('userId', 'department');

  const relevantLeaves = overlappingLeaves.filter((leave) => {
    if (!leave.userId || !leave.userId.department) return false;
    return leave.userId.department.toString() === departmentId.toString() &&
      leave.userId._id.toString() !== user._id.toString();
  });

  let maxExistingOnLeave = 0;
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const activeCount = relevantLeaves.filter((leave) => {
      const leaveStart = toDateOnly(leave.startDate);
      const leaveEnd = toDateOnly(leave.endDate);
      return leaveStart <= cursor && leaveEnd >= cursor;
    }).length;

    if (activeCount > maxExistingOnLeave) {
      maxExistingOnLeave = activeCount;
    }

    cursor = addDays(cursor, 1);
  }

  const maxOnLeaveIncludingRequest = maxExistingOnLeave + 1;
  const projectedCoveragePercentage = totalEmployees
    ? Number(((maxOnLeaveIncludingRequest / totalEmployees) * 100).toFixed(2))
    : 0;

  let riskLevel = 'safe';
  let reason = 'Team coverage looks healthy for selected dates.';

  if (projectedCoveragePercentage >= thresholds.block) {
    riskLevel = 'blocked';
    reason = 'Selected dates breach the department coverage block threshold.';
  } else if (projectedCoveragePercentage >= thresholds.warning) {
    riskLevel = 'risky';
    reason = 'Selected dates are close to coverage limits and may require manual adjustment.';
  }

  return {
    policy,
    riskLevel,
    reason,
    projectedCoveragePercentage,
    totalEmployees,
    maxOnLeaveIncludingRequest,
    warningThreshold: thresholds.warning,
    blockThreshold: thresholds.block
  };
};

const evaluateAutoApprovalEligibility = ({ policy, coverage, leaveType, totalDays, user }) => {
  const workflow = policy?.approvalWorkflow || {};
  const rules = workflow.autoApprovalRules || {};

  const enabled = Boolean(workflow.autoApprovalEnabled);
  const maxDays = Number(rules.maxDays || 0);
  const allowedLeaveTypes = Array.isArray(rules.leaveTypes) ? rules.leaveTypes : [];
  const excludedDepartments = Array.isArray(rules.excludeDepartments) ? rules.excludeDepartments : [];
  const userDepartmentId = user?.department ? user.department.toString() : null;

  const isDepartmentExcluded = userDepartmentId
    ? excludedDepartments.some((departmentId) => departmentId?.toString() === userDepartmentId)
    : false;

  return {
    enabled,
    maxDays,
    allowedLeaveTypes,
    isEligible:
      enabled &&
      coverage?.riskLevel === 'safe' &&
      maxDays > 0 &&
      totalDays <= maxDays &&
      allowedLeaveTypes.includes(leaveType) &&
      !isDepartmentExcluded
  };
};

const getLeaveConflictingTasks = async ({ userId, startDateInput, endDateInput, session }) => {
  const startDate = toDateOnly(startDateInput);
  const endDate = toDateOnly(endDateInput);

  let query = Task.find({
    assignedTo: userId,
    status: { $nin: ['done', 'cancelled'] },
    $or: [
      { deadline: { $gte: startDate, $lte: endDate } },
      { isRecurring: true }
    ]
  }).sort({ deadline: 1, priority: -1 });

  if (session) {
    query = query.session(session);
  }

  return query;
};

const summarizeTaskConflicts = (tasks = []) => {
  const urgentTasks = tasks.filter((task) => URGENT_TASK_PRIORITIES.has(task.priority));
  const nonUrgentTasks = tasks.filter((task) => !URGENT_TASK_PRIORITIES.has(task.priority));

  return {
    total: tasks.length,
    urgentCount: urgentTasks.length,
    nonUrgentCount: nonUrgentTasks.length,
    urgentTaskIds: urgentTasks.map((task) => task._id),
    nonUrgentTaskIds: nonUrgentTasks.map((task) => task._id),
    requiresReplacement: urgentTasks.length > 0
  };
};

const applyLeaveTaskPlan = async ({ leaveRequest, replacementUserId, session }) => {
  const conflictingTasks = await getLeaveConflictingTasks({
    userId: leaveRequest.userId,
    startDateInput: leaveRequest.startDate,
    endDateInput: leaveRequest.endDate,
    session
  });
  const summary = summarizeTaskConflicts(conflictingTasks);

  if (summary.urgentCount > 0 && !replacementUserId) {
    throw new Error('Urgent tasks require a backup assignee before leave can be approved');
  }

  const deferredUntil = addDays(toDateOnly(leaveRequest.endDate), 1);
  const now = new Date();

  for (const task of conflictingTasks) {
    task.relatedLeaveId = leaveRequest._id;

    if (URGENT_TASK_PRIORITIES.has(task.priority)) {
      task.handedOverTo = replacementUserId;
      task.handoverStatus = 'pending';
      task.handoverRequestedAt = now;
      if (!task.handoverNote) {
        task.handoverNote = 'Urgent task handover required while owner is on approved leave';
      }
    } else {
      task.isDeferred = true;
      task.deferredUntil = deferredUntil;
      task.handoverStatus = 'deferred';
      task.handoverRequestedAt = now;
    }

    await task.save({ session });
  }

  if (summary.urgentCount > 0 && replacementUserId) {
    await Notification.create([{
      userId: replacementUserId,
      type: 'reminder',
      category: 'warning',
      title: 'Urgent Leave Task Handover Pending',
      message: `You have ${summary.urgentCount} urgent task(s) pending handover acceptance due to approved leave.`,
      actionUrl: '/employee/tasks',
      sentBySystem: true
    }], { session });
  }

  return {
    ...summary,
    deferredUntil
  };
};

// @desc    Precheck leave request before submit
// @route   POST /api/leave/precheck
// @access  Private
const precheckLeaveRequest = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const user = await User.findById(req.user.id).select('department');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const coverage = await buildCoverageAssessment({ startDateInput: startDate, endDateInput: endDate, user });
    const dayCalculation = await calculateChargeableDays(startDate, endDate, coverage.policy);
    const conflictingTasks = await getLeaveConflictingTasks({
      userId: req.user.id,
      startDateInput: startDate,
      endDateInput: endDate
    });
    const taskConflicts = summarizeTaskConflicts(conflictingTasks);

    return res.status(200).json({
      success: true,
      data: {
        riskLevel: coverage.riskLevel,
        reason: coverage.reason,
        coverage: {
          projectedCoveragePercentage: coverage.projectedCoveragePercentage,
          warningThreshold: coverage.warningThreshold,
          blockThreshold: coverage.blockThreshold,
          totalEmployees: coverage.totalEmployees,
          maxOnLeaveIncludingRequest: coverage.maxOnLeaveIncludingRequest
        },
        dayCalculation,
        taskConflicts,
        guidance: taskConflicts.urgentCount > 0
          ? 'Urgent tasks overlap this leave. Choose a backup user and submit for admin approval.'
          : 'No urgent task conflicts found. Tasks can be deferred until after leave on approval.'
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while prechecking leave request' });
  }
};

// @desc    Create leave request
// @route   POST /api/leave
// @access  Private
const createLeaveRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      leaveType,
      startDate,
      endDate,
      reason,
      handoverToUserId,
      handoverDescription,
      replacementArranged,
      replacementUser,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone
    } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const coverage = await buildCoverageAssessment({ startDateInput: startDate, endDateInput: endDate, user });
    const dayCalculation = await calculateChargeableDays(startDate, endDate, coverage.policy);
    const totalDays = dayCalculation.chargeableDays;
    const conflictingTasks = await getLeaveConflictingTasks({
      userId,
      startDateInput: startDate,
      endDateInput: endDate,
      session
    });
    const taskConflicts = summarizeTaskConflicts(conflictingTasks);
    const replacementAssignee = replacementUser || handoverToUserId || null;

    if (totalDays <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Selected dates result in zero chargeable leave days based on current policy rules'
      });
    }

    if (coverage.riskLevel === 'blocked') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: coverage.reason,
        data: {
          riskLevel: coverage.riskLevel,
          coverage: {
            projectedCoveragePercentage: coverage.projectedCoveragePercentage,
            warningThreshold: coverage.warningThreshold,
            blockThreshold: coverage.blockThreshold
          },
          dayCalculation
        }
      });
    }

    const leaveTypePolicy = coverage.policy?.leaveTypes?.[leaveType];
    if (leaveTypePolicy?.maxConsecutive && totalDays > leaveTypePolicy.maxConsecutive) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: `Maximum consecutive ${leaveType} leave is ${leaveTypePolicy.maxConsecutive} days`
      });
    }

    // Check for overlapping leaves
    const overlappingLeave = await LeaveRequest.findOne({
      userId,
      status: { $in: ['pending', 'approved'] },
      $or: [
        {
          startDate: { $lte: endDate },
          endDate: { $gte: startDate }
        }
      ]
    }).session(session);

    if (overlappingLeave) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'You already have a pending or approved leave request for this date range'
      });
    }

    // Check leave balance
    if (user.leaveBalance[leaveType] < totalDays) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: `Insufficient ${leaveType} leave balance. Available: ${user.leaveBalance[leaveType]}, Requested: ${totalDays}`
      });
    }

    if (taskConflicts.urgentCount > 0 && !replacementAssignee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Urgent tasks overlap your leave. Please choose a backup user for handover before submitting.',
        data: { taskConflicts }
      });
    }

    if (replacementAssignee && replacementAssignee.toString() === userId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: 'Backup user must be different from the leave requester.'
      });
    }

    if (replacementAssignee) {
      const replacementUserDoc = await User.findById(replacementAssignee).session(session);
      if (!replacementUserDoc) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, error: 'Selected backup user not found' });
      }
    }

    const autoApprovalDecision = evaluateAutoApprovalEligibility({
      policy: coverage.policy,
      coverage,
      leaveType,
      totalDays,
      user
    });

    const requiresAdminTaskApproval = taskConflicts.urgentCount > 0;
    const finalStatus = autoApprovalDecision.isEligible && !requiresAdminTaskApproval ? 'approved' : 'pending';

    const payload = {
      userId,
      leaveType,
      startDate,
      endDate,
      totalDays,
      dayCalculation,
      coverageAssessment: {
        riskLevel: coverage.riskLevel,
        projectedCoveragePercentage: coverage.projectedCoveragePercentage,
        warningThreshold: coverage.warningThreshold,
        blockThreshold: coverage.blockThreshold,
        evaluatedAt: new Date(),
        reason: coverage.reason
      },
      taskConflictSummary: {
        total: taskConflicts.total,
        urgentCount: taskConflicts.urgentCount,
        nonUrgentCount: taskConflicts.nonUrgentCount,
        requiresReplacement: taskConflicts.requiresReplacement,
        evaluatedAt: new Date()
      },
      requiresAdminTaskApproval,
      reason,
      status: finalStatus
    };

    if (autoApprovalDecision.isEligible) {
      payload.reviewedBy = req.user.id;
      payload.reviewedAt = new Date();
      payload.adminComment = 'Automatically approved by policy rules.';
    }

    if (replacementAssignee || handoverDescription) {
      payload.handoverTo = {
        userId: replacementAssignee || undefined,
        description: handoverDescription || undefined
      };
    }

    if (replacementArranged !== undefined || taskConflicts.urgentCount > 0) {
      payload.replacementArranged = taskConflicts.urgentCount > 0
        ? Boolean(replacementAssignee)
        : Boolean(replacementArranged);
    }

    if (replacementAssignee) {
      payload.replacementUser = replacementAssignee;
    }

    if (emergencyContactName || emergencyContactRelationship || emergencyContactPhone) {
      payload.emergencyContactDuringLeave = {
        name: emergencyContactName || undefined,
        relationship: emergencyContactRelationship || undefined,
        phoneNumber: emergencyContactPhone || undefined
      };
    }

    // Create leave request
    const leaveRequest = await LeaveRequest.create([payload], { session });
    leaveRequest[0].advanceWorkflowStage(
      determineWorkflowStage({
        status: finalStatus,
        taskConflicts,
        startDate,
        endDate
      }),
      req.user.id,
      'Leave request created'
    );
    await leaveRequest[0].save({ session });

    if (finalStatus === 'approved') {
      user.leaveBalance[leaveType] -= totalDays;
      await user.save({ session });

      const taskPlanSummary = await applyLeaveTaskPlan({
        leaveRequest: leaveRequest[0],
        replacementUserId: replacementAssignee,
        session
      });

      const coverageResult = await notifyCoverageCandidates({
        leaveRequest: leaveRequest[0],
        session
      });

      await ActionHistory.create([{
        actionType: 'leave_approved',
        targetUser: user._id,
        targetUserName: user.name,
        targetUserEmail: user.email,
        performedBy: req.user.id,
        performedByName: req.user.name || user.name,
        previousStatus: 'pending',
        newStatus: 'approved',
        leaveRequestId: leaveRequest[0]._id,
        reason: 'Auto-approved by policy'
      }], { session });

      await Notification.create([{
        userId: user._id,
        type: 'leave',
        title: 'Leave request auto-approved',
        message: `Your ${leaveType} leave request was auto-approved based on policy rules. Deferred tasks: ${taskPlanSummary.nonUrgentCount}.`,
        metadata: { leaveId: leaveRequest[0]._id }
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      success: true,
      data: leaveRequest[0],
      meta: {
        autoApproved: finalStatus === 'approved',
        finalStatus,
        taskConflicts,
        requiresAdminTaskApproval,
        autoApprovalPolicy: autoApprovalDecision.enabled
          ? {
              maxDays: autoApprovalDecision.maxDays,
              allowedLeaveTypes: autoApprovalDecision.allowedLeaveTypes
            }
          : null
      }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating leave request'
    });
  }
};

// @desc    Get user's leave requests
// @route   GET /api/leave/my
// @access  Private
const getMyLeaves = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };
    if (req.query.status && ['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status)) {
      query.status = req.query.status;
    }

    const [leaveRequests, total] = await Promise.all([
      LeaveRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      LeaveRequest.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching leave requests'
    });
  }
};

// @desc    Get all leave requests (Admin only)
// @route   GET /api/leave/all
// @access  Private/Admin
const getAllLeaves = async (req, res) => {
  try {
    const { status, leaveType, fromDate, toDate, userId } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by leave type
    if (leaveType) {
      query.leaveType = leaveType;
    }

    // Filter by employee
    if (userId) {
      query.userId = userId;
    }

    // Filter by date range
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }

    const [leaveRequests, total] = await Promise.all([
      LeaveRequest.find(query)
        .populate({
          path: 'userId',
          select: 'name email designation role',
          populate: { path: 'department', select: 'name code' }
        })
        .populate('replacementUser', 'name email department')
        .populate('handoverTo.userId', 'name email department')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      LeaveRequest.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching all leave requests'
    });
  }
};

// @desc    Get leave request by ID (Admin only)
// @route   GET /api/leave/:id
// @access  Private/Admin
const getLeaveById = async (req, res) => {
  try {
    const leaveRequest = await LeaveRequest.findById(req.params.id)
      .populate({
        path: 'userId',
        select: 'name email designation role leaveBalance',
        populate: { path: 'department', select: 'name code' }
      })
      .populate('replacementUser', 'name email department')
      .populate('handoverTo.userId', 'name email department')
      .populate('reviewedBy', 'name email');

    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        error: 'Leave request not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: leaveRequest
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: 'Server error while fetching leave request details'
    });
  }
};

// @desc    Update leave request status (Admin only)
// @route   PUT /api/leave/:id
// @access  Private/Admin
const updateLeaveStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { status, adminComment } = req.body;
    const leaveId = req.params.id;

    // Find leave request
    const leaveRequest = await LeaveRequest.findById(leaveId).session(session);
    if (!leaveRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        success: false,
        error: 'Leave request not found'
      });
    }

    // Check if already processed
    if (leaveRequest.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        success: false,
        error: `Leave request is already ${leaveRequest.status}`
      });
    }

    // Update status
    leaveRequest.status = status;
    leaveRequest.adminComment = adminComment || leaveRequest.adminComment;
    leaveRequest.reviewedBy = req.user.id;
    leaveRequest.reviewedAt = new Date();
    leaveRequest.advanceWorkflowStage(
      determineWorkflowStage({
        status,
        taskConflicts: leaveRequest.taskConflictSummary,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate
      }),
      req.user.id,
      adminComment || `Leave ${status}`
    );
    await leaveRequest.save({ session });

    // If approved, deduct from leave balance
    if (status === 'approved') {
      const user = await User.findById(leaveRequest.userId).session(session);
      
      // Check balance again (in case it changed while pending)
      if (user.leaveBalance[leaveRequest.leaveType] < leaveRequest.totalDays) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          error: `Insufficient balance to approve this request`
        });
      }

      // Deduct leave balance
      user.leaveBalance[leaveRequest.leaveType] -= leaveRequest.totalDays;
      await user.save({ session });

      const replacementAssignee = leaveRequest.replacementUser || leaveRequest.handoverTo?.userId || null;
      try {
        await applyLeaveTaskPlan({
          leaveRequest,
          replacementUserId: replacementAssignee,
          session
        });

        await notifyCoverageCandidates({
          leaveRequest,
          session
        });
        // If an admin-assigned replacement exists, allocate full deduction to them
        try {
          if (replacementAssignee) {
            const leave = await LeaveRequest.findById(leaveRequest._id).session(session);
            const leaver = await User.findById(leave.userId).session(session);
            const monthlyBase = Number(leaver?.salary?.monthlyBase) || 60000;
            const perDayRate = monthlyBase / 30;
            const deductionTotal = Math.round((Number(leave.totalDays) || 0) * perDayRate);

            leave.deductionTotal = deductionTotal;
            leave.deductionDistribution = [{ userId: replacementAssignee, amount: deductionTotal, taskIds: [] }];
            leave.deductionDistributedAt = new Date();
            await leave.save({ session });

            await Notification.create([{
              userId: replacementAssignee,
              type: 'salary',
              category: 'success',
              title: 'Compensation for covering tasks',
              message: `You have been assigned to cover urgent tasks for ${leaver.name}. Compensation of ₹${deductionTotal} will be added to your pay.`,
              metadata: { leaveId: leave._id, amount: deductionTotal },
              sentBySystem: true
            }], { session });
          }
        } catch (distErr) {
          console.error('Error allocating deduction to admin-assigned replacement:', distErr);
        }
      } catch (taskPlanError) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          success: false,
          error: taskPlanError.message || 'Task handover/defer plan could not be applied for this leave approval'
        });
      }
    }

    const leaveUser = await User.findById(leaveRequest.userId).session(session);

    await ActionHistory.create([{
      actionType: status === 'approved' ? 'leave_approved' : 'leave_rejected',
      targetUser: leaveUser._id,
      targetUserName: leaveUser.name,
      targetUserEmail: leaveUser.email,
      performedBy: req.user.id,
      performedByName: req.user.name,
      previousStatus: 'pending',
      newStatus: status,
      leaveRequestId: leaveRequest._id
    }], { session });

    await Notification.create([{
      userId: leaveUser._id,
      type: 'leave',
      title: status === 'approved' ? 'Leave request approved' : 'Leave request rejected',
      message: adminComment
        ? `Your ${leaveRequest.leaveType} leave request was ${status}. Comment: ${adminComment}`
        : `Your ${leaveRequest.leaveType} leave request was ${status}.`,
      metadata: { leaveId: leaveRequest._id }
    }], { session });

    await session.commitTransaction();
    session.endSession();

    // Fetch updated request with user details
    const updatedRequest = await LeaveRequest.findById(leaveId)
      .populate('userId', 'name email leaveBalance')
      .populate('reviewedBy', 'name email');

    res.status(200).json({
      success: true,
      data: updatedRequest
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating leave status'
    });
  }
};

// @desc    Cancel leave request (employee)
// @route   PATCH /api/leave/:id/cancel
// @access  Private
const cancelLeaveRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const leaveId = req.params.id;
    const { reason } = req.body;

    const leaveRequest = await LeaveRequest.findById(leaveId).session(session);
    if (!leaveRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }

    if (leaveRequest.userId.toString() !== req.user.id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, error: 'You can only cancel your own leave request' });
    }

    if (leaveRequest.status !== 'pending') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Only pending leave requests can be cancelled' });
    }

    leaveRequest.status = 'cancelled';
    leaveRequest.cancelledAt = new Date();
    leaveRequest.cancelledBy = req.user.id;
    leaveRequest.advanceWorkflowStage('closed', req.user.id, reason || 'Cancelled by employee');
    if (reason) {
      leaveRequest.adminComment = `Cancelled by employee${reason ? `: ${reason}` : ''}`;
    }
    await leaveRequest.save({ session });

    const user = await User.findById(req.user.id).session(session);

    await ActionHistory.create([{
      actionType: 'leave_cancelled',
      targetUser: user._id,
      targetUserName: user.name,
      targetUserEmail: user.email,
      performedBy: req.user.id,
      performedByName: req.user.name,
      previousStatus: 'pending',
      newStatus: 'cancelled',
      leaveRequestId: leaveRequest._id
    }], { session });

    await Notification.create([{
      userId: req.user.id,
      type: 'leave',
      title: 'Leave request cancelled',
      message: `Your ${leaveRequest.leaveType} leave request was cancelled successfully.`,
      metadata: { leaveId: leaveRequest._id }
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({ success: true, data: leaveRequest });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error(error);
    return res.status(500).json({ success: false, error: 'Server error while cancelling leave request' });
  }
};

module.exports = {
  createLeaveRequest,
  precheckLeaveRequest,
  getMyLeaves,
  getAllLeaves,
  getLeaveById,
  updateLeaveStatus,
  cancelLeaveRequest,
  respondToCoverageRequest
};
