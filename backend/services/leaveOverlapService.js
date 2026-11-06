const LeaveRequest = require('../models/LeaveRequest');

/**
 * Leave Overlap Service
 * ---------------------
 * Central enforcement point for leave-aware task assignment and
 * redistribution. Every candidate assignee must be checked through here
 * before a task can be assigned to them.
 *
 * "Approved leave" is the only status that blocks assignment. Pending and
 * rejected leaves never block.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

// Inclusive date comparison helpers.
const overlaps = (rangeStart, rangeEnd, leaveStart, leaveEnd) =>
  leaveStart <= rangeEnd && leaveEnd >= rangeStart;

/**
 * Check a single employee for leave conflicts over a date range.
 * @param {string} employeeId - User _id
 * @param {Date|string} rangeStart
 * @param {Date|string} rangeEnd
 * @returns {Promise<{conflict: boolean, leaves: Array}>}
 *   leaves = approved leave records that overlap the range, with exact dates.
 */
const getLeaveConflict = async (employeeId, rangeStart, rangeEnd) => {
  const start = normalizeDate(rangeStart);
  const end = normalizeDate(rangeEnd);

  if (!employeeId) return { conflict: false, leaves: [] };
  if (!start || !end || end < start) {
    return { conflict: false, leaves: [], error: 'Invalid date range' };
  }

  // Expand the range by one day on each side so a deadline on the first/last
  // leave day is still flagged as conflicting.
  const expandedStart = new Date(start.getTime() - DAY_MS);
  const expandedEnd = new Date(end.getTime() + DAY_MS);

  const leaves = await LeaveRequest.find({
    userId: employeeId,
    status: 'approved',
    startDate: { $lte: expandedEnd },
    endDate: { $gte: expandedStart }
  })
    .select('leaveType startDate endDate totalDays status halfDayType')
    .sort({ startDate: 1 })
    .lean();

  const overlapping = leaves.map((leave) => ({
    leaveId: leave._id,
    leaveType: leave.leaveType,
    halfDayType: leave.halfDayType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    totalDays: leave.totalDays
  }));

  return {
    conflict: overlapping.length > 0,
    leaves: overlapping
  };
};

/**
 * Bulk variant — resolve leave conflicts for many employees at once.
 * Used by the "Assign To" dropdown population to gray-out unavailable
 * candidates in a single query.
 * @param {string[]} employeeIds
 * @param {Date} rangeStart
 * @param {Date} rangeEnd
 * @returns {Promise<Map<string, Array>>} employeeId -> overlapping leave docs
 */
const getLeaveConflictsForEmployees = async (employeeIds, rangeStart, rangeEnd) => {
  const start = normalizeDate(rangeStart);
  const end = normalizeDate(rangeEnd);
  const map = new Map();
  if (!employeeIds || employeeIds.length === 0 || !start || !end) return map;

  const expandedStart = new Date(start.getTime() - DAY_MS);
  const expandedEnd = new Date(end.getTime() + DAY_MS);

  const leaves = await LeaveRequest.find({
    userId: { $in: employeeIds },
    status: 'approved',
    startDate: { $lte: expandedEnd },
    endDate: { $gte: expandedStart }
  })
    .select('userId leaveType startDate endDate totalDays halfDayType')
    .sort({ startDate: 1 })
    .lean();

  leaves.forEach((leave) => {
    const key = String(leave.userId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({
      leaveId: leave._id,
      leaveType: leave.leaveType,
      halfDayType: leave.halfDayType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      totalDays: leave.totalDays
    });
  });

  return map;
};

/**
 * Strict validation used at assignment time: throws when the assignee has
 * approved leave overlapping the task deadline.
 * @param {string} employeeId
 * @param {Date} deadline
 */
const assertNoLeaveConflict = async (employeeId, deadline) => {
  if (!deadline) return;
  const { conflict, leaves } = await getLeaveConflict(employeeId, deadline, deadline);
  if (conflict) {
    const leave = leaves[0];
    const err = new Error(
      `${leave.leaveType} leave approved ${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()} overlaps the task deadline`
    );
    err.code = 'LEAVE_CONFLICT';
    err.leave = leave;
    throw err;
  }
};

module.exports = {
  getLeaveConflict,
  getLeaveConflictsForEmployees,
  assertNoLeaveConflict
};
