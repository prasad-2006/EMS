const ProjectMember = require('../models/ProjectMember');
const WorkItem = require('../models/WorkItem');
const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');

const getProjectCapacity = async (projectId) => {
  const members = await ProjectMember.find({ projectId, status: { $ne: 'released' } })
    .populate('userId', 'name email role department');

  return Promise.all(members.map(async (member) => {
    const allocationHours = (Number(member.allocationPercent) / 100) * 40;
    const taskMatch = {
      projectId,
      assignedTo: member.userId._id,
      status: { $nin: ['done', 'cancelled', 'approved'] }
    };
    const tasks = await WorkItem.find(taskMatch).select('estimateHours deadline status');
    const legacyTaskIds = await WorkItem.find({ projectId, legacyTaskId: { $ne: null }, assignedTo: member.userId._id }).distinct('legacyTaskId');
    const legacyTasks = await Task.find({ projectId, assignedTo: member.userId._id, _id: { $nin: legacyTaskIds }, status: { $nin: ['done', 'cancelled'] } }).select('estimatedHours');
    const estimatedHours = tasks.reduce((sum, task) => sum + (Number(task.estimateHours) || 0), 0) + legacyTasks.reduce((sum, task) => sum + (Number(task.estimatedHours) || 0), 0);
    const leave = await LeaveRequest.findOne({
      userId: member.userId._id,
      status: 'approved',
      startDate: { $lte: member.endDate || new Date('2999-12-31') },
      endDate: { $gte: member.startDate || new Date('2000-01-01') }
    }).select('startDate endDate leaveType');

    return {
      user: member.userId,
      projectRole: member.projectRole,
      allocationPercent: member.allocationPercent,
      weeklyCapacityHours: Math.round(allocationHours * 100) / 100,
      plannedHours: estimatedHours,
      remainingHours: Math.round((allocationHours - estimatedHours) * 100) / 100,
      overAllocated: estimatedHours > allocationHours,
      approvedLeave: leave || null
    };
  }));
};

module.exports = { getProjectCapacity };
