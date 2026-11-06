const mongoose = require('mongoose');
const { resolveContextProjectIds, resolveDepartmentIds } = require('./hierarchyService');

const STATUS_VALUES = ['todo', 'in-progress', 'review', 'done', 'cancelled', 'rejected'];
const PRIORITY_VALUES = ['low', 'medium', 'high', 'critical'];
const CATEGORY_VALUES = ['development', 'design', 'testing', 'documentation', 'meeting', 'admin', 'other'];
const ACTIVE_STATUSES = ['todo', 'in-progress', 'review'];

const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (err) {
    return null;
  }
};

const splitValues = (value) =>
  String(value || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

/**
 * Build the dynamic $match for GET /api/tasks (and KPI) from the accumulated
 * drill-down filter stack.
 *
 * The stack is composed of:
 *  - Individual query params: nodeType/nodeId (Global Active Context),
 *    status, priority, category, assignee, q, deadlineFrom/deadlineTo, overdue
 *  - An open-ended `filters` JSON array: [{ key, value }] where key may be
 *    one of status|priority|category|assignee|project|department|q|overdue.
 *
 * Role-based scope is enforced here, not in the controller:
 *  - Admin/manager/hr: full visibility.
 *  - Employee: hard-forced `assignedTo` = self, plus the default pre-drilled
 *    personal view (status todo OR in-progress) when no status filter exists.
 *
 * @param {Request} req
 * @returns {Promise<{match: object, scope: string}>}
 */
const buildTaskFilter = async (req) => {
  const q = req.query || {};
  const andClauses = [];

  // ---- 1. Accumulated open-ended filter stack (extensibility) ----
  let accumulated = [];
  if (typeof q.filters === 'string' && q.filters.trim()) {
    try {
      accumulated = JSON.parse(q.filters);
    } catch (err) {
      accumulated = [];
    }
  }

  // ---- 2. Status (supports comma-separated values + virtual "overdue") ----
  const statusValues = [
    ...splitValues(q.status),
    ...accumulated.filter((f) => f.key === 'status').flatMap((f) => splitValues(f.value))
  ];
  const statusClauses = [];
  const plainStatuses = statusValues.filter((s) => s !== 'overdue' && STATUS_VALUES.includes(s));
  if (statusValues.includes('overdue') || q.overdue === 'true') {
    statusClauses.push({
      $and: [{ status: { $in: ACTIVE_STATUSES } }, { deadline: { $lt: new Date() } }]
    });
  }
  if (plainStatuses.length > 0) {
    statusClauses.push({ status: { $in: [...new Set(plainStatuses)] } });
  }
  if (statusClauses.length === 1) {
    andClauses.push(statusClauses[0]);
  } else if (statusClauses.length > 1) {
    andClauses.push({ $or: statusClauses });
  }

  // ---- 3. Priority (multi-value) ----
  const priorityValues = [
    ...splitValues(q.priority),
    ...accumulated.filter((f) => f.key === 'priority').flatMap((f) => splitValues(f.value))
  ].filter((v) => PRIORITY_VALUES.includes(v));
  if (priorityValues.length > 0) {
    andClauses.push({ priority: { $in: [...new Set(priorityValues)] } });
  }

  // ---- 4. Category (multi-value) ----
  const categoryValues = [
    ...splitValues(q.category),
    ...accumulated.filter((f) => f.key === 'category').flatMap((f) => splitValues(f.value))
  ].filter((v) => CATEGORY_VALUES.includes(v));
  if (categoryValues.length > 0) {
    andClauses.push({ category: { $in: [...new Set(categoryValues)] } });
  }

  // ---- 5. Assignee ----
  const assigneeValues = [
    q.assignee,
    ...accumulated.filter((f) => f.key === 'assignee').map((f) => f.value)
  ]
    .filter(Boolean)
    .map((v) => toObjectId(v))
    .filter(Boolean);
  if (assigneeValues.length > 0) {
    andClauses.push({ assignedTo: { $in: [...new Set(assigneeValues.map((id) => id.toString()))].map((s) => toObjectId(s)) } });
  }

  // ---- 6. Global Active Context (hierarchical node drill-down) ----
  const nodeType = q.nodeType || (accumulated.find((f) => f.key === 'nodeType') || {}).value;
  const nodeId = q.nodeId || (accumulated.find((f) => f.key === 'nodeId') || {}).value;

  if (nodeType && nodeId) {
    if (nodeType === 'project' || nodeType === 'department') {
      const projectIds = await resolveContextProjectIds({ nodeType, nodeId });
      if (projectIds && projectIds.length === 0) {
        // Valid node with no tasks under it — resolve to an empty match.
        andClauses.push({ _id: { $in: [] } });
      } else if (projectIds && projectIds.length > 0) {
        andClauses.push({ projectId: { $in: projectIds } });
      }
    }
  }

  // Direct projectId filter (supports the Projects page Gantt drill).
  if (q.projectId) {
    const id = toObjectId(q.projectId);
    if (id) andClauses.push({ projectId: id });
  }

  // ---- 7. Deadline window ----
  if (q.deadlineFrom || q.deadlineTo) {
    const range = {};
    if (q.deadlineFrom) range.$gte = new Date(q.deadlineFrom);
    if (q.deadlineTo) {
      const to = new Date(q.deadlineTo);
      to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
    andClauses.push({ deadline: range });
  }

  // ---- 8. Free-text search ----
  const searchTerm = q.q || (accumulated.find((f) => f.key === 'q') || {}).value;
  if (searchTerm) {
    const escaped = String(searchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    andClauses.push({
      $or: [
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
        { tags: { $regex: escaped, $options: 'i' } }
      ]
    });
  }

  // ---- 9. Role-based scope enforcement ----
  const isOversightRole = ['admin', 'manager', 'hr'].includes(req.user.role);
  let scope = isOversightRole ? 'all' : 'self';

  if (!isOversightRole) {
    // Employee can never escape their own assignment scope.
    andClauses.push({ assignedTo: req.user._id });

    // Default pre-drilled entry view: status = Todo OR In Progress.
    // (explicit status filters override this default)
    const hasExplicitStatus =
      plainStatuses.length > 0 || statusValues.includes('overdue') || q.overdue === 'true';
    if (!hasExplicitStatus) {
      andClauses.push({ status: { $in: ['todo', 'in-progress', 'rejected'] } });
    }
  }

  const match = andClauses.length === 0 ? {} : { $and: andClauses };
  return { match, scope };
};

/**
 * Reusable task projection + population used by list endpoints.
 */
const populateTaskQuery = (query) =>
  query
    .populate('assignedTo', 'name email employeeId department designation')
    .populate('createdBy', 'name email')
    .populate('projectId', 'name code status hierarchy');

module.exports = {
  buildTaskFilter,
  populateTaskQuery,
  toObjectId,
  STATUS_VALUES,
  PRIORITY_VALUES,
  CATEGORY_VALUES,
  ACTIVE_STATUSES,
  resolveDepartmentIds
};
