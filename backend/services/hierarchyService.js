const Department = require('../models/Department');
const Project = require('../models/Project');
const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const mongoose = require('mongoose');
const { departmentMembershipInQuery } = require('./userDepartmentService');

const toId = (value) => {
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch (err) {
    return null;
  }
};

// ---------------------------------------------------------------------------
// 1. Department tree — single optimized aggregation call using $graphLookup.
//    Result: root departments with nested children (departments + projects).
// ---------------------------------------------------------------------------
const getDepartmentGraph = async () => {
  const docs = await Department.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $sort: { name: 1 } },
    {
      $graphLookup: {
        from: 'departments',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentDepartment',
        as: 'descendants',
        maxDepth: 50
      }
    },
    { $match: { $or: [{ parentDepartment: null }, { parentDepartment: { $exists: false } }] } },
    {
      $project: {
        name: 1,
        code: 1,
        description: 1,
        level: 1,
        hierarchy: 1,
        parentDepartment: 1,
        descendants: 1
      }
    }
  ]);

  const byParent = new Map();
  docs.flatMap((d) => [d, ...d.descendants]).forEach((doc) => {
    const key = doc.parentDepartment ? doc.parentDepartment.toString() : 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(doc);
  });

  const build = (node) => ({
    _id: node._id,
    name: node.name,
    code: node.code,
    description: node.description,
    level: node.level,
    hierarchy: node.hierarchy,
    type: 'department',
    children: (byParent.get(node._id.toString()) || []).map(build)
  });

  return (byParent.get('root') || []).map(build);
};

// ---------------------------------------------------------------------------
// 2. Project tree — $graphLookup based (see Project model) flattened by parent.
// ---------------------------------------------------------------------------
const getProjectsFlat = async () => {
  const projects = await Project.find({}).sort({ name: 1 }).lean();
  const byParent = new Map();
  projects.forEach((project) => {
    const key = project.parentProject ? project.parentProject.toString() : 'root';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(project);
  });

  const build = (project) => ({
    _id: project._id,
    name: project.name,
    code: project.code,
    description: project.description,
    status: project.status,
    level: project.level,
    hierarchy: project.hierarchy,
    departmentId: project.departmentId,
    parentProject: project.parentProject,
    type: 'project',
    children: (byParent.get(project._id.toString()) || []).map(build)
  });

  return (byParent.get('root') || []).map(build);
};

// ---------------------------------------------------------------------------
// 3. Aggregated per-project metrics (task counts + members currently on leave)
// ---------------------------------------------------------------------------
const getProjectMetrics = async () => {
  const [taskMetrics, leaveMetrics] = await Promise.all([
    Task.aggregate([
      { $match: { projectId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$projectId',
          totalTasks: { $sum: 1 },
          activeTasks: {
            $sum: {
              $cond: [{ $in: ['$status', ['todo', 'in-progress', 'review']] }, 1, 0]
            }
          },
          doneTasks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
          overdueTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ['$status', ['todo', 'in-progress', 'review']] },
                    { $ne: ['$deadline', null] },
                    { $lt: ['$deadline', new Date()] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]),
    Task.aggregate([
      {
        $match: {
          projectId: { $exists: true, $ne: null },
          status: { $in: ['todo', 'in-progress', 'review'] }
        }
      },
      {
        $group: {
          _id: '$projectId',
          assigneeIds: { $addToSet: '$assignedTo' }
        }
      },
      { $unwind: { path: '$assigneeIds', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'leaverequests',
          let: { assignee: '$assigneeIds' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$userId', '$$assignee'] },
                    { $eq: ['$status', 'approved'] },
                    { $lte: ['$startDate', new Date()] },
                    { $gte: ['$endDate', new Date()] }
                  ]
                }
              }
            },
            { $project: { _id: 1 } }
          ],
          as: 'leaves'
        }
      },
      {
        $group: {
          _id: '$_id',
          membersOnLeave: {
            $sum: { $cond: [{ $gt: [{ $size: '$leaves' }, 0] }, 1, 0] }
          },
          memberCount: { $sum: 1 }
        }
      }
    ])
  ]);

  const taskMap = new Map(taskMetrics.map((m) => [String(m._id), m]));
  const leaveMap = new Map(leaveMetrics.map((m) => [String(m._id), m]));

  return {
    byProject: (projectId) => {
      const t = taskMap.get(String(projectId)) || {
        totalTasks: 0, activeTasks: 0, doneTasks: 0, overdueTasks: 0
      };
      const l = leaveMap.get(String(projectId)) || { membersOnLeave: 0, memberCount: 0 };
      return { ...t, ...l };
    }
  };
};

// Walk the tree accumulating metrics bottom-up so every parent card can
// display aggregates from all of its child nodes.
const attachAggregatedMetrics = (nodes, metrics) => {
  const aggregate = (node) => {
    node.children = (node.children || []).map(aggregate);
    let acc = { totalTasks: 0, activeTasks: 0, doneTasks: 0, overdueTasks: 0, membersOnLeave: 0, memberCount: 0 };
    if (node.type === 'project') {
      acc = { ...acc, ...metrics.byProject(node._id) };
    }
    node.children.forEach((child) => {
      const childStats = child._aggregates || { totalTasks: 0, activeTasks: 0, doneTasks: 0, overdueTasks: 0, membersOnLeave: 0, memberCount: 0 };
      acc.totalTasks += childStats.totalTasks;
      acc.activeTasks += childStats.activeTasks;
      acc.doneTasks += childStats.doneTasks;
      acc.overdueTasks += childStats.overdueTasks;
      acc.membersOnLeave += childStats.membersOnLeave;
      acc.memberCount += childStats.memberCount;
    });
    node._aggregates = acc;
    node.progressPercentage = acc.totalTasks === 0 ? 0 : Math.round((acc.doneTasks / acc.totalTasks) * 100);
    return node;
  };
  return nodes.map(aggregate);
};

// ---------------------------------------------------------------------------
// 4. Combined tree with RBAC scope pruning.
//    Admin/manager: full org tree. Employee: subtree of their own department.
// ---------------------------------------------------------------------------
const getCombinedTree = async (req) => {
  const [deptTree, projectTree, metrics] = await Promise.all([
    getDepartmentGraph(),
    getProjectsFlat(),
    getProjectMetrics()
  ]);

  // Attach projects under their owning department; unlinked projects go to a
  // synthetic "Unassigned" department node at the root.
  const projectNodesByDept = new Map();
  const unattached = [];
  projectTree.forEach((project) => {
    const deptKey = project.departmentId ? String(project.departmentId) : null;
    if (deptKey) {
      if (!projectNodesByDept.has(deptKey)) projectNodesByDept.set(deptKey, []);
      projectNodesByDept.get(deptKey).push(project);
    } else {
      unattached.push(project);
    }
  });

  const attachProjects = (nodes) =>
    nodes.map((node) => {
      node.children = attachProjects(node.children || []);
      if (projectNodesByDept.has(String(node._id))) {
        node.children = [...node.children, ...projectNodesByDept.get(String(node._id))];
      }
      return node;
    });

  let tree = attachProjects(deptTree);

  if (unattached.length > 0) {
    tree.unshift({
      _id: null,
      name: 'Unassigned Projects',
      code: 'GENERAL',
      level: 0,
      type: 'department',
      synthetic: true,
      children: unattached
    });
  }

  let scopedTree = tree;
  if (req.user && req.user.role === 'employee') {
    const userDeptId = req.user.department ? String(req.user.department) : null;
    const findDeptSubtree = (nodes) => {
      for (const node of nodes) {
        if (node.type === 'department' && String(node._id) === userDeptId) return node;
        const found = findDeptSubtree(node.children || []);
        if (found) return found;
      }
      return null;
    };
    const subtree = findDeptSubtree(tree);
    scopedTree = subtree ? [subtree] : [];
  }

  return attachAggregatedMetrics(scopedTree, metrics);
};

// ---------------------------------------------------------------------------
// 5. Context resolution: translate a drill-down node (department or project)
//    into the set of project ids that belong to the node + all descendants.
//    Used by GET /api/tasks to scope the dynamic $match.
// ---------------------------------------------------------------------------
const resolveContextProjectIds = async ({ nodeType, nodeId }) => {
  if (!nodeId) return null;

  if (nodeType === 'project') {
    const node = await Project.findById(nodeId).select('hierarchy.path').lean();
    if (!node) return null;
    const descendants = await Project.findNodeWithDescendants(nodeId).select('_id').lean();
    return descendants.map((d) => d._id);
  }

  if (nodeType === 'department') {
    const node = await Department.findById(nodeId).select('hierarchy.path').lean();
    if (!node) return null;
    const deptIds = await Department.find({
      $or: [
        { _id: nodeId },
        { 'hierarchy.path': { $regex: `^${node.hierarchy.path}` } }
      ]
    }).select('_id').lean();
    const projects = await Project.find({ departmentId: { $in: deptIds.map((d) => d._id) } })
      .select('_id')
      .lean();
    return projects.map((p) => p._id);
  }

  return null;
};

// Resolve the department hierarchy scope: department node + all descendants.
const resolveDepartmentIds = async (departmentId) => {
  const node = await Department.findById(departmentId).select('hierarchy.path').lean();
  if (!node) return [];
  const depts = await Department.find({
    $or: [
      { _id: departmentId },
      { 'hierarchy.path': { $regex: `^${node.hierarchy.path}` } }
    ]
  }).select('_id').lean();
  return depts.map((d) => d._id);
};

// Given a user, resolve their entire readable scope:
//  - Admin: whole org.
//  - Employee: their department subtree (departments + projects + users).
const resolveUserScope = async (userId) => {
  const user = await User.findById(userId).select('role department departments').lean();
  if (!user) return { projectIds: null, deptIds: null, userIds: null, scope: 'none' };

  if (user.role === 'admin' || user.role === 'manager' || user.role === 'hr') {
    return { projectIds: null, deptIds: null, userIds: null, scope: 'all' };
  }

  const userDepartmentIds = [user.department, ...(user.departments || [])].filter(Boolean);
  if (userDepartmentIds.length === 0) {
    return { projectIds: [], deptIds: [], userIds: [user._id], scope: 'self' };
  }

  const departmentScopes = await Promise.all(userDepartmentIds.map((departmentId) => resolveDepartmentIds(departmentId)));
  const deptIds = [...new Map(departmentScopes.flat().map((departmentId) => [departmentId.toString(), departmentId])).values()];
  const projects = await Project.find({ departmentId: { $in: deptIds } }).select('_id').lean();
  const projectIds = projects.map((p) => p._id);
  const usersInDept = await User.find(departmentMembershipInQuery(deptIds)).select('_id').lean();
  return {
    projectIds,
    deptIds,
    userIds: usersInDept.map((u) => u._id),
    scope: 'department'
  };
};

module.exports = {
  getCombinedTree,
  getProjectMetrics,
  resolveContextProjectIds,
  resolveDepartmentIds,
  resolveUserScope,
  toId
};
