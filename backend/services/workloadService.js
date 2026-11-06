const User = require('../models/User');
const Task = require('../models/Task');
const Department = require('../models/Department');
const mongoose = require('mongoose');
const { getLeaveConflictsForEmployees } = require('./leaveOverlapService');
const { departmentMembershipInQuery } = require('./userDepartmentService');

const ACTIVE_STATUSES = ['todo', 'in-progress', 'review'];

/**
 * Find "available peers" for an employee who is going on leave.
 * Strategy (Hierarchical "Smart Redistribute"):
 *  1. Resolve the leaving employee's department.
 *  2. Walk UP the department tree to the department's parent node.
 *  3. Recursively scan that same parent node: every department that shares the
 *     parent (the "peers" node) plus the user who leaves is excluded.
 *  4. Collect all active employees inside those sibling departments.
 *  5. Filter out anyone with an approved leave overlapping the window.
 *
 * @param {string} leavingUserId - User _id going on leave
 * @param {{from: Date, to: Date}} [window] - the leave window to exclude against
 * @returns {Promise<Array<{user, workload, available}>>}
 */
const findAvailablePeers = async (leavingUserId, window) => {
  const leavingUser = await User.findById(leavingUserId)
    .select('name email department employeeId role status')
    .lean();
  if (!leavingUser) return [];

  let candidateUsers = [];

  if (leavingUser.department) {
    const dept = await Department.findById(leavingUser.department).select('parentDepartment').lean();
    const parentId = dept && dept.parentDepartment ? dept.parentDepartment : leavingUser.department;

    // All departments under the SAME "parent node" (which is the node we recurse).
    const siblingDepts = await Department.find({
      $or: [{ parentDepartment: parentId }, { _id: leavingUser.department }]
    })
      .select('_id')
      .lean();

    candidateUsers = await User.find({
      ...departmentMembershipInQuery(siblingDepts.map((d) => d._id)),
      role: { $ne: 'admin' },
      status: 'active',
      _id: { $ne: leavingUser._id }
    })
      .select('_id name email employeeId department designation')
      .lean();
  } else {
    // Fallback: everyone active in the same department-less scope.
    candidateUsers = await User.find({
      role: { $ne: 'admin' },
      status: 'active',
      _id: { $ne: leavingUser._id }
    })
      .select('_id name email employeeId department designation')
      .lean();
  }

  // Exclude peers with approved leave overlapping the window.
  return resolveAvailability(candidateUsers, window);
};

const resolveAvailability = async (candidateUsers, window) => {
  const workloads = await computeWorkloadScores(candidateUsers.map((u) => u._id));

  let conflicts = new Map();
  if (window && window.from && window.to) {
    conflicts = await getLeaveConflictsForEmployees(
      candidateUsers.map((u) => u._id),
      window.from,
      window.to
    );
  }

  return candidateUsers.map((user) => ({
    user,
    activeWorkload: workloads.get(String(user._id)) || 0,
    onLeave: conflicts.has(String(user._id)),
    leaveConflicts: conflicts.get(String(user._id)) || [],
    available: !conflicts.has(String(user._id))
  }));
};

/**
 * Workload equilibrium — count active (non-terminal) tasks per user.
 * @param {string[]} userIds
 * @returns {Promise<Map<string, number>>}
 */
const computeWorkloadScores = async (userIds) => {
  if (!userIds || userIds.length === 0) return new Map();
  const rows = await Task.aggregate([
    { $match: { assignedTo: { $in: userIds }, status: { $in: ACTIVE_STATUSES } } },
    { $group: { _id: '$assignedTo', count: { $sum: 1 } } }
  ]);
  const map = new Map();
  rows.forEach((row) => map.set(String(row._id), row.count));
  return map;
};

/**
 * Suggest the peer with the LOWEST active workload to keep the backlog
 * balanced. Ties are broken by the fewest overdue tasks, then by name.
 */
const suggestLowestWorkload = async (peers) => {
  const available = peers.filter((peer) => peer.available);
  if (available.length === 0) return null;

  available.sort((a, b) => {
    if (a.activeWorkload !== b.activeWorkload) return a.activeWorkload - b.activeWorkload;
    return (a.user.name || '').localeCompare(b.user.name || '');
  });

  return available[0];
};

/**
 * Weekly workload heatmap (Mon-Sun) for one employee.
 * @param {string} userId
 * @returns {Promise<{weekStart: string, days: Array<{dayName, date, count}>}>}
 */
const getWeeklyHeatmap = async (userId) => {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = (day === 0 ? -6 : 1 - day);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const rows = await Task.aggregate([
      {
        $match: {
          assignedTo: new mongoose.Types.ObjectId(String(userId)),
          status: { $in: ACTIVE_STATUSES },
          deadline: { $exists: true, $ne: null }
        }
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: '$deadline' } // 1=Sunday ... 7=Saturday
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          count: { $sum: 1 }
        }
      }
    ]);

  const byMday = new Map();
  rows.forEach((row) => byMday.set(row._id, row.count));

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // Convert $dayOfWeek (Sun=1) to a Monday-first index 0..6.
  const days = dayNames.map((name, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const dow = date.getDay(); // 0=Sunday
    const mongoDow = dow === 0 ? 7 : dow; // -> 7 for Sunday
    return {
      day: name,
      date: date.toISOString().slice(0, 10),
      count: byMday.get(mongoDow) || 0
    };
  });

  return {
    userId,
    weekStart: weekStart.toISOString(),
    days
  };
};

module.exports = {
  findAvailablePeers,
  computeWorkloadScores,
  suggestLowestWorkload,
  getWeeklyHeatmap,
  ACTIVE_STATUSES
};