const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// @desc    Get flagged tasks for a leave request
// @route   GET /api/handover/check/:leaveId
// @access  Private (Employee)
const getFlaggedTasks = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const userId = req.user.id;

    // Get the leave request
    const leave = await LeaveRequest.findById(leaveId);
    
    if (!leave) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }

    // Verify ownership
    if (leave.userId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    // Get tasks that conflict with leave period
    const startDate = new Date(leave.startDate);
    const endDate = new Date(leave.endDate);

    // Find tasks that:
    // 1. Have deadlines during the leave period, OR
    // 2. Are recurring tasks
    const conflictingTasks = await Task.find({
      assignedTo: userId,
      status: { $nin: ['done', 'cancelled'] },
      $or: [
        {
          // Tasks with deadlines in the leave period
          deadline: { $gte: startDate, $lte: endDate }
        },
        {
          // Recurring tasks need handover
          isRecurring: true
        }
      ]
    })
    .populate('assignedTo', 'name email')
    .populate('handedOverTo', 'name email')
    .sort({ deadline: 1, priority: -1 });

    // Categorize tasks
    const deadlineConflicts = conflictingTasks.filter(t => t.deadline && t.deadline >= startDate && t.deadline <= endDate);
    const recurringTasks = conflictingTasks.filter(t => t.isRecurring);

    return res.status(200).json({
      success: true,
      data: {
        leaveId,
        leavePeriod: {
          startDate: leave.startDate,
          endDate: leave.endDate
        },
        totalFlagged: conflictingTasks.length,
        deadlineConflicts: deadlineConflicts.length,
        recurringTasks: recurringTasks.length,
        tasks: conflictingTasks
      }
    });
  } catch (error) {
    console.error('Error in getFlaggedTasks:', error);
    return res.status(500).json({ success: false, error: 'Server error while fetching flagged tasks' });
  }
};

// @desc    Assign a flagged task to a colleague
// @route   POST /api/handover/assign
// @access  Private (Employee)
const assignTask = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { taskId, assignedToUserId, handoverNote } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!taskId || !assignedToUserId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, error: 'Task ID and assignee are required' });
    }

    // Get the task
    const task = await Task.findById(taskId).session(session);
    
    if (!task) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify ownership
    if (task.assignedTo.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, error: 'You can only handover your own tasks' });
    }

    // Verify the assignee exists
    const assignee = await User.findById(assignedToUserId).session(session);
    if (!assignee) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Assignee not found' });
    }

    // Update the task
    task.handedOverTo = assignedToUserId;
    task.handoverNote = handoverNote || '';
    task.handoverStatus = 'pending';
    task.handoverRequestedAt = new Date();
    
    await task.save({ session });

    // Create notification for the assignee
    await Notification.create([{
      userId: assignedToUserId,
      type: 'reminder',
      category: 'info',
      title: 'New Handover Task',
      message: `You have been assigned a task: "${task.title}". Please review and accept.`,
      actionUrl: '/employee/tasks',
      priority: 'high',
      sentBySystem: true
    }], { session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Task assigned successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in assignTask:', error);
    return res.status(500).json({ success: false, error: 'Server error while assigning task' });
  }
};

// @desc    Mark a task as deferred to after return
// @route   POST /api/handover/defer/:taskId
// @access  Private (Employee)
const deferTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { deferredUntil } = req.body;
    const userId = req.user.id;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify ownership
    if (task.assignedTo.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'You can only defer your own tasks' });
    }

    // Update the task
    task.isDeferred = true;
    task.deferredUntil = deferredUntil ? new Date(deferredUntil) : null;
    task.handoverStatus = 'deferred';
    task.handoverRequestedAt = new Date();
    
    await task.save();

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Task deferred successfully'
    });
  } catch (error) {
    console.error('Error in deferTask:', error);
    return res.status(500).json({ success: false, error: 'Server error while deferring task' });
  }
};

// @desc    Accept a handed-over task
// @route   PATCH /api/handover/accept/:taskId
// @access  Private (Colleague/Backup)
const acceptTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify this task was assigned to current user
    if (task.handedOverTo.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'This task was not assigned to you' });
    }

    // Update the task
    task.handoverStatus = 'accepted';
    task.handoverAcceptedAt = new Date();
    
    await task.save();

    // Notify the original assignee
    await Notification.create({
      userId: task.assignedTo,
      type: 'reminder',
      category: 'success',
      title: 'Handover Accepted',
      message: `Your task "${task.title}" has been accepted by ${req.user.name}`,
      actionUrl: '/employee/tasks',
      priority: 'normal',
      sentBySystem: true
    });

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Task accepted successfully'
    });
  } catch (error) {
    console.error('Error in acceptTask:', error);
    return res.status(500).json({ success: false, error: 'Server error while accepting task' });
  }
};

// @desc    Reject a handed-over task
// @route   PATCH /api/handover/reject/:taskId
// @access  Private (Colleague/Backup)
const rejectTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify this task was assigned to current user
    if (task.handedOverTo.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'This task was not assigned to you' });
    }

    // Update the task - reset handover status
    const originalAssignee = task.assignedTo;
    task.handedOverTo = null;
    task.handoverStatus = 'none';
    task.handoverNote = '';
    task.handoverRejectedReason = reason || 'Task rejected by assignee';
    
    await task.save();

    // Notify the original assignee
    await Notification.create({
      userId: originalAssignee,
      type: 'alert',
      category: 'warning',
      title: 'Handover Rejected',
      message: `Your task "${task.title}" was rejected. Reason: ${reason || 'No reason provided'}`,
      actionUrl: '/employee/tasks',
      priority: 'high',
      sentBySystem: true
    });

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Task rejected'
    });
  } catch (error) {
    console.error('Error in rejectTask:', error);
    return res.status(500).json({ success: false, error: 'Server error while rejecting task' });
  }
};

// @desc    Get tasks currently covering for on-leave colleagues
// @route   GET /api/handover/covering
// @access  Private (Backup Person)
const getCoveringTasks = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find tasks handed over to current user
    const tasks = await Task.find({
      handedOverTo: userId,
      handoverStatus: { $in: ['pending', 'accepted'] },
      status: { $nin: ['done', 'cancelled'] }
    })
    .populate('assignedTo', 'name email department')
    .populate('relatedLeaveId')
    .sort({ priority: -1, deadline: 1 });

    // Get leave details for each task
    const tasksWithLeaveInfo = await Promise.all(
      tasks.map(async (task) => {
        if (task.relatedLeaveId) {
          const leave = await LeaveRequest.findById(task.relatedLeaveId)
            .populate('userId', 'name email');
          return {
            ...task.toObject(),
            leaveInfo: leave ? {
              startDate: leave.startDate,
              endDate: leave.endDate,
              employeeName: leave.userId?.name,
              status: leave.status
            } : null
          };
        }
        return task;
      })
    );

    return res.status(200).json({
      success: true,
      data: tasksWithLeaveInfo
    });
  } catch (error) {
    console.error('Error in getCoveringTasks:', error);
    return res.status(500).json({ success: false, error: 'Server error while fetching covering tasks' });
  }
};

// @desc    Complete handover (employee confirms handover is done)
// @route   PATCH /api/handover/complete/:taskId
// @access  Private (Original assignee)
const completeHandover = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Verify ownership
    if (task.assignedTo.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'You can only complete handover for your own tasks' });
    }

    if (!task.handedOverTo) {
      return res.status(400).json({ success: false, error: 'This task has not been assigned to anyone' });
    }

    // Update the task
    task.handoverStatus = 'completed';
    task.handoverCompletedAt = new Date();
    
    await task.save();

    // Notify the backup person
    await Notification.create({
      userId: task.handedOverTo,
      type: 'reminder',
      category: 'info',
      title: 'Handover Completed',
      message: `The handover for "${task.title}" has been completed. You are now responsible for this task.`,
      actionUrl: '/employee/tasks',
      priority: 'normal',
      sentBySystem: true
    });

    return res.status(200).json({
      success: true,
      data: task,
      message: 'Handover completed successfully'
    });
  } catch (error) {
    console.error('Error in completeHandover:', error);
    return res.status(500).json({ success: false, error: 'Server error while completing handover' });
  }
};

// @desc    Return to work - pull tasks back from backup
// @route   POST /api/handover/return/:leaveId
// @access  Private (Employee returning from leave)
const returnToWork = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { leaveId } = req.params;
    const userId = req.user.id;

    // Get the leave request
    const leave = await LeaveRequest.findById(leaveId).session(session);
    
    if (!leave) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }

    // Verify ownership
    if (leave.userId.toString() !== userId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    // Find all tasks that were handed over for this leave
    const handedOverTasks = await Task.find({
      relatedLeaveId: leaveId,
      handedOverTo: { $ne: null },
      handoverStatus: { $in: ['accepted', 'completed'] }
    }).session(session);

    // Get tasks completed by backup
    const completedTasks = handedOverTasks.filter(t => t.status === 'done');
    
    // Get tasks still in progress
    const inProgressTasks = handedOverTasks.filter(t => t.status !== 'done');

    // Capture backup users before clearing handover assignment on tasks
    const backupPersonIds = [...new Set(
      handedOverTasks
        .map(t => t.handedOverTo)
        .filter(Boolean)
        .map(id => id.toString())
    )];

    // Pull back all tasks to the original employee
    for (const task of handedOverTasks) {
      task.assignedTo = userId;
      task.handedOverTo = null;
      task.handoverStatus = 'none';
      task.relatedLeaveId = null;
      task.isDeferred = false;
      task.deferredUntil = null;
      await task.save({ session });
    }

    // Notify backup persons
    for (const backupId of backupPersonIds) {
      await Notification.create([{
        userId: backupId,
        type: 'reminder',
        category: 'info',
        title: 'Colleague Returned',
        message: `${req.user.name} has returned from leave. Tasks have been transferred back.`,
        actionUrl: '/employee/tasks',
        priority: 'normal',
        sentBySystem: true
      }], { session });
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      data: {
        leaveId,
        returnedDate: new Date(),
        tasksCompleted: completedTasks.length,
        tasksInProgress: inProgressTasks.length,
        completedTasks,
        inProgressTasks
      },
      message: 'Welcome back! Tasks have been transferred back to you.'
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error in returnToWork:', error);
    return res.status(500).json({ success: false, error: 'Server error while processing return to work' });
  }
};

// @desc    Get return-to-work summary before returning
// @route   GET /api/handover/return-summary/:leaveId
// @access  Private (Employee)
const getReturnSummary = async (req, res) => {
  try {
    const { leaveId } = req.params;
    const userId = req.user.id;

    // Get the leave request
    const leave = await LeaveRequest.findById(leaveId);
    
    if (!leave) {
      return res.status(404).json({ success: false, error: 'Leave request not found' });
    }

    // Verify ownership
    if (leave.userId.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access' });
    }

    // Find tasks that were handed over
    const handedOverTasks = await Task.find({
      relatedLeaveId: leaveId,
      handedOverTo: { $ne: null }
    })
    .populate('handedOverTo', 'name email')
    .sort({ status: 1, priority: -1 });

    // Categorize
    const completedTasks = handedOverTasks.filter(t => t.status === 'done');
    const inProgressTasks = handedOverTasks.filter(t => t.status !== 'done');
    const acceptedTasks = handedOverTasks.filter(t => t.handoverStatus === 'accepted');
    const pendingTasks = handedOverTasks.filter(t => t.handoverStatus === 'pending');

    return res.status(200).json({
      success: true,
      data: {
        leaveId,
        leavePeriod: {
          startDate: leave.startDate,
          endDate: leave.endDate
        },
        returnDate: new Date(),
        summary: {
          totalTasks: handedOverTasks.length,
          completed: completedTasks.length,
          inProgress: inProgressTasks.length,
          accepted: acceptedTasks.length,
          pending: pendingTasks.length
        },
        completedTasks,
        inProgressTasks
      }
    });
  } catch (error) {
    console.error('Error in getReturnSummary:', error);
    return res.status(500).json({ success: false, error: 'Server error while fetching return summary' });
  }
};

// @desc    Get all tasks for current user (including handed over ones)
// @route   GET /api/handover/my-tasks
// @access  Private
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, priority, page = 1, limit = 20 } = req.query;

    // Build filter
    const filter = {
      $or: [
        { assignedTo: userId },  // My own tasks
        { handedOverTo: userId }  // Tasks handed to me
      ]
    };

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const tasks = await Task.find(filter)
      .populate('assignedTo', 'name email')
      .populate('handedOverTo', 'name email')
      .sort({ priority: -1, deadline: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Task.countDocuments(filter);

    return res.status(200).json({
      success: true,
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in getMyTasks:', error);
    return res.status(500).json({ success: false, error: 'Server error while fetching tasks' });
  }
};

// @desc    Create a new task
// @route   POST /api/handover/tasks
// @access  Private
const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      assignedTo,
      projectId,
      deadline,
      isRecurring,
      recurringFrequency,
      priority,
      category,
      estimatedHours,
      tags
    } = req.body;

    const task = await Task.create({
      title,
      description,
      assignedTo: assignedTo || req.user.id,
      createdBy: req.user.id,
      projectId,
      deadline,
      isRecurring: isRecurring || false,
      recurringFrequency,
      priority: priority || 'medium',
      category: category || 'other',
      estimatedHours,
      tags
    });

    await task.populate('assignedTo', 'name email');

    return res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error in createTask:', error);
    return res.status(500).json({ success: false, error: 'Server error while creating task' });
  }
};

// @desc    Update a task
// @route   PUT /api/handover/tasks/:taskId
// @access  Private
const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user.id;

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Check ownership or if user is the backup
    const isOwner = task.assignedTo.toString() === userId;
    const isBackup = task.handedOverTo?.toString() === userId;

    if (!isOwner && !isBackup) {
      return res.status(403).json({ success: false, error: 'You can only update tasks assigned to you or handed to you' });
    }

    const allowedUpdates = [
      'title', 'description', 'deadline', 'priority', 'status',
      'category', 'estimatedHours', 'actualHours', 'tags', 'comments'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    await task.save();
    await task.populate('assignedTo', 'name email');
    await task.populate('handedOverTo', 'name email');

    return res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    console.error('Error in updateTask:', error);
    return res.status(500).json({ success: false, error: 'Server error while updating task' });
  }
};

// @desc    Get team workload for manager
// @route   GET /api/handover/team-workload
// @access  Private (Manager/Admin)
const getTeamWorkload = async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate } = req.query;

    // Get user's team (direct reports)
    const manager = await User.findById(userId);
    const teamMembers = await User.find({
      managerId: userId,
      status: { $in: ['active', 'approved'] }
    }).select('name email department');

    const teamIds = teamMembers.map(m => m._id);

    // Get all active tasks for team members
    const taskFilter = {
      assignedTo: { $in: teamIds },
      status: { $nin: ['done', 'cancelled'] }
    };

    // If date range provided, filter by deadline
    if (startDate && endDate) {
      taskFilter.$or = [
        { deadline: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { deadline: null },
        { deadline: { $exists: false } }
      ];
    }

    const tasks = await Task.find(taskFilter)
      .populate('assignedTo', 'name email')
      .sort({ priority: -1, deadline: 1 });

    // Group by user
    const workloadByUser = {};
    teamMembers.forEach(member => {
      workloadByUser[member._id] = {
        user: member,
        totalTasks: 0,
        highPriority: 0,
        criticalTasks: 0,
        dueDuringLeave: 0,
        tasks: []
      };
    });

    tasks.forEach(task => {
      const userId = task.assignedTo._id.toString();
      if (workloadByUser[userId]) {
        workloadByUser[userId].totalTasks++;
        
        if (task.priority === 'high') workloadByUser[userId].highPriority++;
        if (task.priority === 'critical') workloadByUser[userId].criticalTasks++;
        
        // Check if deadline falls in the provided date range
        if (startDate && endDate && task.deadline) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          if (task.deadline >= start && task.deadline <= end) {
            workloadByUser[userId].dueDuringLeave++;
          }
        }

        workloadByUser[userId].tasks.push(task);
      }
    });

    // Calculate availability score (inverse of workload)
    const workloadData = Object.values(workloadByUser).map(userData => ({
      ...userData,
      availabilityScore: Math.max(0, 100 - (userData.totalTasks * 5) - (userData.highPriority * 10) - (userData.criticalTasks * 20))
    }));

    return res.status(200).json({
      success: true,
      data: workloadData
    });
  } catch (error) {
    console.error('Error in getTeamWorkload:', error);
    return res.status(500).json({ success: false, error: 'Server error while fetching team workload' });
  }
};

module.exports = {
  getFlaggedTasks,
  assignTask,
  deferTask,
  acceptTask,
  rejectTask,
  getCoveringTasks,
  completeHandover,
  returnToWork,
  getReturnSummary,
  getMyTasks,
  createTask,
  updateTask,
  getTeamWorkload
};