const Task = require('../models/Task');
const User = require('../models/User');
const Department = require('../models/Department');
const Project = require('../models/Project');
const LeaveRequest = require('../models/LeaveRequest');
const Notification = require('../models/Notification');
const Submission = require('../models/Submission');
const Review = require('../models/Review');
const ArtifactVersion = require('../models/ArtifactVersion');
const ReviewTemplate = require('../models/ReviewTemplate');
const GlobalSettings = require('../models/GlobalSettings');
const DeductionLedger = require('../models/DeductionLedger');
const { buildTaskFilter, populateTaskQuery, toObjectId } = require('../services/taskQueryService');
const { getLeaveConflictsForEmployees, assertNoLeaveConflict } = require('../services/leaveOverlapService');
const { findAvailablePeers, suggestLowestWorkload, getWeeklyHeatmap } = require('../services/workloadService');
const { resolveDepartmentIds } = require('../services/hierarchyService');
const { departmentMembershipInQuery } = require('../services/userDepartmentService');
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeRow = (row) => {
  const normalized = {};
  Object.keys(row || {}).forEach((key) => {
    normalized[String(key).trim().toLowerCase()] = row[key];
  });
  return normalized;
};

const getFirstValue = (row, keys = []) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const parseDayNumberFromKey = (key = '') => {
  const normalizedKey = String(key)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /(?:^|\s)day\s*(\d{1,2})(?:\s*task)?(?:\s|$)/i,
    /(?:^|\s)d\s*(\d{1,2})(?:\s*task)?(?:\s|$)/i
  ];

  for (const pattern of patterns) {
    const match = normalizedKey.match(pattern);
    if (match) {
      const day = parseInt(match[1], 10);
      if (!Number.isNaN(day) && day >= 1 && day <= 7) {
        return day;
      }
    }
  }

  return null;
};

const extractDayWiseTasks = (row = {}) => {
  const dayTaskMap = new Map();

  Object.entries(row).forEach(([key, value]) => {
    const taskTitle = String(value || '').trim();
    if (!taskTitle) return;

    const dayNumber = parseDayNumberFromKey(key);
    if (!dayNumber) return;
    if (!dayTaskMap.has(dayNumber)) {
      dayTaskMap.set(dayNumber, taskTitle);
    }
  });

  for (let dayNumber = 1; dayNumber <= 7; dayNumber += 1) {
    const aliases = [
      `day ${dayNumber} task`,
      `day${dayNumber} task`,
      `day-${dayNumber} task`,
      `day_${dayNumber}_task`,
      `day ${dayNumber}`,
      `day${dayNumber}`,
      `d ${dayNumber} task`,
      `d${dayNumber} task`,
      `d ${dayNumber}`,
      `d${dayNumber}`
    ];
    const value = String(getFirstValue(row, aliases) || '').trim();
    if (value && !dayTaskMap.has(dayNumber)) {
      dayTaskMap.set(dayNumber, value);
    }
  }

  return Array.from(dayTaskMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([dayNumber, title]) => ({ dayNumber, title }));
};

const dayTags = ['day-1', 'day-2', 'day-3', 'day-4', 'day-5', 'day-6', 'day-7'];

const buildTaskNotificationActionUrls = (taskIds = []) => {
  return taskIds.flatMap((id) => {
    const value = String(id);
    return [`/tasks/${value}`, `/employee/tasks/${value}`];
  });
};

const deleteTaskAssignmentNotificationsByTaskIds = async (taskIds = []) => {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return;

  const actionUrls = buildTaskNotificationActionUrls(taskIds);
  await Notification.deleteMany({
    type: 'reminder',
    title: { $in: ['New Task Assigned', 'Task Reassigned'] },
    actionUrl: { $in: actionUrls }
  });
};

const toTitleCase = (value = '') =>
  String(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const buildDepartmentCode = (name = '') => {
  const cleaned = String(name).replace(/[^A-Za-z]/g, '').toUpperCase();
  if (cleaned.length >= 3) return cleaned.slice(0, 3);
  if (cleaned.length > 0) return cleaned.padEnd(3, 'X');
  return 'GEN';
};

const getOrCreateDepartment = async (departmentNameRaw) => {
  const departmentName = toTitleCase(departmentNameRaw || 'General');
  let department = await Department.findOne({ name: { $regex: `^${escapeRegExp(departmentName)}$`, $options: 'i' } });
  if (department) return department;

  const baseCode = buildDepartmentCode(departmentName);
  let code = baseCode;
  let suffix = 1;

  while (await Department.findOne({ code })) {
    suffix += 1;
    code = `${baseCode}${suffix}`.slice(0, 10);
  }

  department = await Department.create({
    name: departmentName,
    code,
    description: `Auto-created from bulk task import for ${departmentName}`,
    isActive: true
  });

  return department;
};

const getOrCreateUserFromRow = async (row, rowNumber) => {
  const emailValue = String(getFirstValue(row, ['employee email', 'email', 'user email'])).trim().toLowerCase();
  const employeeIdValue = String(getFirstValue(row, ['employee id', 'emp id', 'empid', 'id'])).trim();
  const passwordValue = String(getFirstValue(row, ['password', 'pass'])).trim();
  const departmentValue = String(getFirstValue(row, ['department', 'dept'])).trim();
  const nameFromSheet = String(getFirstValue(row, ['name', 'employee name', 'full name'])).trim();

  if (!emailValue && !employeeIdValue) {
    return { error: 'Employee Email or Employee ID is required' };
  }

  let user = null;
  if (emailValue) {
    user = await User.findOne({ email: { $regex: `^${escapeRegExp(emailValue)}$`, $options: 'i' } });
  }

  if (!user && employeeIdValue) {
    user = await User.findOne({
      $or: [
        { employeeId: employeeIdValue.toUpperCase() },
        { empId: employeeIdValue }
      ]
    });
  }

  if (user) {
    return { user, created: false };
  }

  if (!emailValue) {
    return { error: `User not found at row ${rowNumber}. Email is required to auto-create a user.` };
  }

  if (!passwordValue) {
    return { error: `User not found: ${emailValue}. Provide Password column value to auto-create user.` };
  }

  const department = await getOrCreateDepartment(departmentValue || 'General');
  const localPart = emailValue.split('@')[0] || `user${Date.now()}`;
  const generatedName =
    nameFromSheet ||
    localPart
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());

  const userData = {
    name: generatedName || 'Imported User',
    email: emailValue,
    password: passwordValue,
    department: department._id,
    role: 'employee',
    status: 'active'
  };

  if (employeeIdValue) {
    userData.employeeId = employeeIdValue.toUpperCase();
  }

  user = await User.create(userData);
  return { user, created: true };
};

// @desc    Get all tasks (drill-able, hierarchical, paginated)
// @route   GET /api/tasks
// @access  Private (role-scoped)
const getAllTasks = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 1000);
    const skip = (page - 1) * limit;

    // Dynamic $match constructed from the accumulated drill-down stack.
    const { match, scope } = await buildTaskFilter(req);

    const [total, tasks] = await Promise.all([
      Task.countDocuments(match),
      populateTaskQuery(Task.find(match))
        .sort({ deadline: 1, priority: -1 })
        .skip(skip)
        .limit(limit)
    ]);

    res.status(200).json({
      success: true,
      data: tasks,
      scope,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('[Tasks] List failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    KPI metrics for the current drill-down stack (clickable cards)
// @route   GET /api/tasks/kpi
// @access  Private (role-scoped)
const getTasksKpi = async (req, res) => {
  try {
    const { match } = await buildTaskFilter(req);
    const [facetResult] = await Task.aggregate([
      { $match: match },
      {
        $facet: {
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
          byCategory: [{ $group: { _id: '$category', count: { $sum: 1 } } }],
          overdue: [
            {
              $match: {
                status: { $in: ['todo', 'in-progress', 'review'] },
                deadline: { $lt: new Date() }
              }
            },
            { $count: 'count' }
          ],
          total: [{ $count: 'count' }]
        }
      }
    ]);

    const toMap = (rows) =>
      rows.reduce((acc, row) => ({ ...acc, [row._id]: row.count }), {});

    const kpi = {
      total: facetResult?.total?.[0]?.count || 0,
      overdue: facetResult?.overdue?.[0]?.count || 0,
      byStatus: toMap(facetResult?.byStatus || []),
      byPriority: toMap(facetResult?.byPriority || []),
      byCategory: toMap(facetResult?.byCategory || []),
      active: (facetResult?.byStatus || []).reduce(
        (acc, row) => (['todo', 'in-progress', 'review'].includes(row._id) ? acc + row.count : acc),
        0
      )
    };

    res.status(200).json({ success: true, data: kpi });
  } catch (err) {
    console.error('[Tasks] KPI failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create a single task
// @route   POST /api/tasks
const createTask = async (req, res) => {
  try {
    const { title, description, assignedTo, deadline, priority, category, estimatedHours, tags, enforceLeaveConstraint, parentTaskId } = req.body;
    const userId = req.user._id;

    if (!title || !assignedTo) {
      return res.status(400).json({ success: false, error: 'Title and assignedTo are required' });
    }

    // Verify user exists
    const user = await User.findById(assignedTo);
    if (!user) {
      return res.status(404).json({ success: false, error: 'Assigned user not found' });
    }

    if (req.body.projectId && req.user.role === 'manager') {
      const project = await Project.findById(req.body.projectId);
      if (!project) return res.status(404).json({ success: false, error: 'Project not found' });
      if (!project.assignedManager || project.assignedManager.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'Only the project manager can assign its tasks' });
      }
      const userDepartmentIds = [user.department, ...(user.departments || [])].filter(Boolean).map((id) => id.toString());
      if (user.role !== 'employee' || (project.assignedDepartment && !userDepartmentIds.includes(project.assignedDepartment.toString()))) {
        return res.status(400).json({ success: false, error: 'Tasks must be assigned to an employee in the project department' });
      }
    }

    if (req.body.projectId && !['admin', 'manager'].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Only the CEO or assigned manager can create project tasks' });
    }

    // Leave-aware enforcement: reject assignment when the assignee has
    // approved leave overlapping the deadline.
    if (enforceLeaveConstraint) {
      try {
        await assertNoLeaveConflict(assignedTo, deadline);
      } catch (err) {
        if (err.code === 'LEAVE_CONFLICT') {
          return res.status(409).json({ success: false, error: err.message, code: err.code, leave: err.leave });
        }
        throw err;
      }
    }

    const task = await Task.create({
      title,
      description,
      assignedTo,
      createdBy: userId,
      projectId: req.body.projectId || undefined,
      parentTaskId: parentTaskId || undefined,
      deadline,
      priority: priority || 'medium',
      category: category || 'other',
      estimatedHours,
      tags: tags || []
    });

    // Send notification
    await Notification.create({
      userId: assignedTo,
      type: 'reminder',
      category: 'info',
      title: 'New Task Assigned',
      message: `You have been assigned a new task: ${title}`,
      actionUrl: `/tasks/${task._id}`,
      sentBySystem: true
    });

    await task.populate('assignedTo', 'name email employeeId department');
    await task.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      data: task,
      message: 'Task created successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Bulk create tasks from Excel
// @route   POST /api/tasks/bulk/import
const bulkImportTasks = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const userId = req.user._id;
    const filePath = req.file.path;

    console.log(`[Bulk Import] Started: ${req.file.originalname}`);

    // Read Excel file
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    console.log(`[Bulk Import] Rows found: ${jsonData.length}`);

    if (jsonData.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ success: false, error: 'Excel file is empty' });
    }

    const results = {
      success: [],
      failed: [],
      total: 0,
      rows: jsonData.length,
      usersCreated: 0,
      replacedTasks: 0
    };

    // Process each row
    for (let i = 0; i < jsonData.length; i++) {
      const rawRow = jsonData[i];
      const row = normalizeRow(rawRow);
      // Process row silently to avoid flooding terminal output.

      try {
        const rowNumber = i + 2;
        const userResult = await getOrCreateUserFromRow(row, rowNumber);

        if (userResult.error) {
          results.total += 1;
          results.failed.push({
            row: rowNumber,
            error: userResult.error
          });
          continue;
        }

        const user = userResult.user;
        if (userResult.created) {
          results.usersCreated += 1;
        }

        // Supports both legacy single-task columns and day-wise task columns.
        const taskPayloads = [];
        const singleTaskTitle = String(getFirstValue(row, ['task title', 'title', 'task'])).trim();
        const dayTasks = extractDayWiseTasks(row);

        // For day-wise import, replace previously imported day tasks for this user
        // so each user sees only the latest day 1..7 tasks from the current sheet.
        if (dayTasks.length > 0) {
          const existingTasks = await Task.find({
            assignedTo: user._id,
            tags: 'bulk-import',
            $or: dayTags.map((tag) => ({ tags: tag }))
          }).select('_id');

          const existingTaskIds = existingTasks.map((task) => task._id);
          if (existingTaskIds.length > 0) {
            await deleteTaskAssignmentNotificationsByTaskIds(existingTaskIds);
            const deleteResult = await Task.deleteMany({ _id: { $in: existingTaskIds } });
            results.replacedTasks += deleteResult.deletedCount || 0;
          }
        }

        if (singleTaskTitle && dayTasks.length === 0) {
          taskPayloads.push({
            title: singleTaskTitle,
            description: String(getFirstValue(row, ['task description', 'description', 'details']) || '').trim(),
            deadline: getFirstValue(row, ['deadline', 'due date']) || null,
            priority: String(getFirstValue(row, ['priority']) || 'medium').toLowerCase(),
            category: String(getFirstValue(row, ['category']) || 'other').toLowerCase(),
            estimatedHours: getFirstValue(row, ['estimated hours', 'est hours', 'hours']) || null,
            tags: String(getFirstValue(row, ['tags']) || '')
          });
        }

        dayTasks.forEach(({ dayNumber, title }) => {
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + Math.max(dayNumber - 1, 0));

          taskPayloads.push({
            title,
            description: `Imported from Excel (day ${dayNumber} task)`,
            deadline,
            priority: 'medium',
            category: 'other',
            estimatedHours: null,
            tags: `bulk-import,day-${dayNumber}`
          });
        });

        if (taskPayloads.length === 0) {
          results.total += 1;
          results.failed.push({
            row: rowNumber,
            error: 'No task columns found. Provide Task Title or Day N Task columns.'
          });
          continue;
        }

        const taskDocs = taskPayloads.map((payload) => {
          const normalizedPriority = ['low', 'medium', 'high', 'critical'].includes(payload.priority)
            ? payload.priority
            : 'medium';
          const normalizedCategory = ['development', 'design', 'testing', 'documentation', 'meeting', 'admin', 'other'].includes(payload.category)
            ? payload.category
            : 'other';

          const estimatedHours = payload.estimatedHours === null || payload.estimatedHours === ''
            ? null
            : parseFloat(payload.estimatedHours);

          const tags = String(payload.tags || '')
            .split(/[;,]/)
            .map((tag) => tag.trim())
            .filter(Boolean);

          return {
            title: payload.title,
            description: payload.description || '',
            assignedTo: user._id,
            createdBy: userId,
            deadline: payload.deadline ? new Date(payload.deadline) : null,
            priority: normalizedPriority,
            category: normalizedCategory,
            estimatedHours: Number.isNaN(estimatedHours) ? null : estimatedHours,
            tags
          };
        });

        const createdTasks = await Task.insertMany(taskDocs, { ordered: true });
        results.total += createdTasks.length;

        const notificationDocs = createdTasks.map((task) => ({
          userId: user._id,
          type: 'reminder',
          category: 'info',
          title: 'New Task Assigned',
          message: `You have been assigned a new task: ${task.title}`,
          actionUrl: `/tasks/${task._id}`,
          sentBySystem: true
        }));

        if (notificationDocs.length > 0) {
          await Notification.insertMany(notificationDocs, { ordered: false });
        }

        createdTasks.forEach((task) => {
          results.success.push({
            row: rowNumber,
            taskId: task._id,
            taskTitle: task.title,
            assignedTo: user.email,
            userCreated: !!userResult.created
          });
        });
      } catch (rowError) {
        results.total += 1;
        results.failed.push({
          row: i + 2,
          error: rowError.message
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    console.log(`[Bulk Import] Completed: success=${results.success.length}, failed=${results.failed.length}, totalProcessed=${results.total}, usersCreated=${results.usersCreated}`);

    res.status(200).json({
      success: true,
      data: results,
      message: `Processed ${results.success.length} successful and ${results.failed.length} failed imports`
    });
  } catch (err) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('[Bulk Import] Failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get task by ID
// @route   GET /api/tasks/:id
const getTaskById = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'name email employeeId department designation')
      .populate('createdBy', 'name email')
      .populate('watchers', 'name email')
      .populate('projectId', 'name code status hierarchy')
      .populate('dependencies');

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    if (req.user.role !== 'admin' && task.assignedTo?._id?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized to view this task' });
    }

    res.status(200).json({ success: true, data: task });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
const updateTask = async (req, res) => {
  try {
    const { title, description, assignedTo, deadline, priority, category, status, estimatedHours, tags, enforceLeaveConstraint } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    const isAdmin = req.user.role === 'admin';
    const isCreator = task.createdBy.toString() === req.user._id.toString();
    const isAssignee = task.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isCreator && !isAssignee) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this task' });
    }

    // Update fields (Admin and Creator can update everything)
    if (isAdmin || isCreator) {
      if (title) task.title = title;
      if (description) task.description = description;
      if (deadline) task.deadline = deadline;
      if (priority) task.priority = priority;
      if (category) task.category = category;
      if (estimatedHours) task.estimatedHours = estimatedHours;
      if (tags) task.tags = tags;
    }
    
    if (status) {
      if (req.user.role === 'employee' && status === 'done') {
        return res.status(403).json({ success: false, error: 'Tasks must be submitted for manager review before completion' });
      }
      if (status === 'done' && task.reviewStatus !== 'approved') {
        return res.status(409).json({ success: false, error: 'A task can be completed only after manager approval' });
      }
      task.status = status;
    }

    // If assigned to changed, send notification to new assignee
    if (assignedTo && assignedTo !== task.assignedTo.toString()) {
      const newUser = await User.findById(assignedTo);
      if (newUser) {
        // Leave-aware enforcement on reassignment
        if (enforceLeaveConstraint && task.deadline) {
          try {
            await assertNoLeaveConflict(assignedTo, task.deadline);
          } catch (err) {
            if (err.code === 'LEAVE_CONFLICT') {
              return res.status(409).json({ success: false, error: err.message, code: err.code, leave: err.leave });
            }
            throw err;
          }
        }
        task.assignedTo = assignedTo;
        await Notification.create({
          userId: assignedTo,
          type: 'reminder',
          category: 'info',
          title: 'Task Reassigned',
          message: `A task has been reassigned to you: ${task.title}`,
          actionUrl: `/tasks/${task._id}`,
          sentBySystem: true
        });
      }
    }

    await task.save();
    await task.populate('assignedTo', 'name email employeeId department designation');
    await task.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      data: task,
      message: 'Task updated successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Evaluate task (Accept or Reject with feedback)
// @route   POST /api/tasks/:id/evaluate
const evaluateTask = async (req, res) => {
  try {
    const { status, reason, correctionsRequired } = req.body;
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    if (status === 'rejected') {
      if (!reason || !correctionsRequired) {
        return res.status(400).json({ success: false, error: 'Reason and corrections required for rejection' });
      }
      task.status = 'rejected';
      task.rejectionFeedback.push({
        reason,
        correctionsRequired,
        rejectedBy: req.user._id,
        rejectedAt: new Date()
      });
      
      // Notify assignee
      await Notification.create({
        userId: task.assignedTo,
        type: 'alert',
        category: 'warning',
        title: 'Task Rejected',
        message: `Your task "${task.title}" was rejected. Please review the corrections.`,
        actionUrl: `/tasks/${task._id}`,
        sentBySystem: true
      });
    } else if (status === 'done') {
      task.status = 'done';
      // Notify assignee
      await Notification.create({
        userId: task.assignedTo,
        type: 'reminder',
        category: 'success',
        title: 'Task Approved',
        message: `Your task "${task.title}" has been approved!`,
        actionUrl: `/tasks/${task._id}`,
        sentBySystem: true
      });
    } else {
      return res.status(400).json({ success: false, error: 'Invalid evaluation status' });
    }

    await task.save();
    res.status(200).json({ success: true, data: task, message: `Task evaluated as ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const submitTaskForReview = async (req, res) => {
  try {
    const { repositoryUrl, pullRequestUrl, documentationLinks = [], completionNotes } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Only the assigned employee can submit this task' });
    }
    if (!completionNotes && documentationLinks.length === 0 && task.attachments.length === 0) {
      return res.status(400).json({ success: false, error: 'A document, documentation link, or completion note is required' });
    }

    const previousSubmission = await Submission.findOne({ taskId: task._id }).sort({ version: -1 });
    if (previousSubmission && previousSubmission.status !== 'approved') {
      previousSubmission.status = 'superseded';
      previousSubmission.supersededAt = new Date();
      await previousSubmission.save();
    }
    const submission = {
      repositoryUrl,
      pullRequestUrl,
      documentationLinks,
      completionNotes,
      submittedBy: req.user._id,
      submittedAt: new Date()
    };
    const submissionRecord = await Submission.create({
      taskId: task._id,
      projectId: task.projectId,
      version: (previousSubmission?.version || 0) + 1,
      submittedBy: req.user._id,
      ...submission,
      artifacts: task.attachments || []
    });
    if (task.attachments?.length > 0) {
      await ArtifactVersion.insertMany(task.attachments.map((artifact) => ({
        submissionId: submissionRecord._id,
        taskId: task._id,
        projectId: task.projectId,
        version: submissionRecord.version,
        fileName: artifact.filename,
        fileUrl: artifact.url,
        fileType: artifact.mimeType,
        fileSize: artifact.fileSize,
        uploadedBy: req.user._id
      })));
    }
    task.submission = submission;
    task.latestSubmissionId = submissionRecord._id;
    task.submissionHistory.push({ ...submission, reviewStatus: 'submitted' });
    task.reviewStatus = 'submitted';
    task.status = 'review';
    await task.save();

    const project = task.projectId ? await Project.findById(task.projectId) : null;
    if (project?.assignedManager) {
      await Notification.create({
        userId: project.assignedManager,
        type: 'reminder',
        category: 'info',
        title: 'Task submitted for review',
        message: `${req.user.name} submitted "${task.title}" for review`,
        actionUrl: `/tasks/${task._id}`,
        sentBySystem: true
      });
    }
    return res.status(200).json({ success: true, data: task, message: 'Task submitted for review' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const reviewTaskSubmission = async (req, res) => {
  try {
    const { decision, note, score, checklist = [] } = req.body;
    if (!['approved', 'changes_requested'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Decision must be approved or changes_requested' });
    }
    if (decision === 'changes_requested' && !note) {
      return res.status(400).json({ success: false, error: 'A change request note is required' });
    }
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    const project = task.projectId ? await Project.findById(task.projectId) : null;
    if (req.user.role !== 'admin' && (!project?.assignedManager || project.assignedManager.toString() !== req.user._id.toString())) {
      return res.status(403).json({ success: false, error: 'Only the assigned manager can review this task' });
    }
    if (task.reviewStatus !== 'submitted') {
      return res.status(409).json({ success: false, error: 'Only submitted tasks can be reviewed' });
    }

    const submission = task.latestSubmissionId
      ? await Submission.findById(task.latestSubmissionId)
      : await Submission.findOne({ taskId: task._id }).sort({ version: -1 });
    if (!submission) return res.status(409).json({ success: false, error: 'No versioned submission exists for this task' });
    const projectType = project?.projectType || 'software_delivery';
    const template = await ReviewTemplate.findOne({ projectType, workItemType: 'task', isActive: true }).sort({ createdAt: -1 });
    const reviewChecklist = checklist.length > 0 ? checklist : (template?.checklist || []).map((item) => ({ label: item.label, passed: false }));
    const review = await Review.create({
      submissionId: submission._id,
      taskId: task._id,
      projectId: task.projectId,
      reviewerId: req.user._id,
      decision,
      note,
      score,
      checklist: reviewChecklist
    });
    submission.status = decision === 'approved' ? 'approved' : 'changes_requested';
    await submission.save();
    task.reviewStatus = decision;
    task.status = decision === 'approved' ? 'done' : 'todo';
    task.rejectionFeedback = decision === 'changes_requested'
      ? [...task.rejectionFeedback, { reason: 'Changes requested during review', correctionsRequired: note, rejectedBy: req.user._id }]
      : task.rejectionFeedback;
    task.submissionHistory.push({
      ...task.submission.toObject(),
      reviewStatus: decision,
      reviewNote: note,
      reviewedBy: req.user._id,
      reviewedAt: new Date()
    });
    await task.save();
    await Notification.create({
      userId: task.assignedTo,
      type: decision === 'approved' ? 'reminder' : 'alert',
      category: decision === 'approved' ? 'success' : 'warning',
      title: decision === 'approved' ? 'Task approved' : 'Changes requested',
      message: decision === 'approved' ? `Your task "${task.title}" was approved` : `Changes are required for "${task.title}": ${note}`,
      actionUrl: `/tasks/${task._id}`,
      sentBySystem: true
    });
    return res.status(200).json({ success: true, data: task });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
const deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);

    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    await deleteTaskAssignmentNotificationsByTaskIds([task._id]);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Delete all tasks
// @route   DELETE /api/tasks
const deleteAllTasks = async (req, res) => {
  try {
    const taskIds = await Task.find({}).distinct('_id');
    const result = await Task.deleteMany({});

    await deleteTaskAssignmentNotificationsByTaskIds(taskIds);

    res.status(200).json({
      success: true,
      message: 'All tasks deleted successfully',
      data: {
        deletedCount: result.deletedCount || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Get users for task assignment dropdown (leave-aware + cascading)
// @route   GET /api/tasks/users/list
// @query   projectId=... | departmentId=... | deadline=YYYY-MM-DD
// @access  Private (admin/manager)
const getUsersForAssignment = async (req, res) => {
  try {
    const { projectId, departmentId, deadline, role } = req.query;

    const eligible = { status: { $in: ['active', 'approved'] } };
    if (req.user.role === 'admin') {
      eligible.role = { $in: ['hr', 'manager'] };
    } else if (req.user.role === 'hr' || req.user.role === 'manager') {
      eligible.role = 'employee';
      if (!departmentId) {
        Object.assign(eligible, departmentMembershipInQuery(req.user.department));
      }
    } else {
      eligible.role = 'none';
    }

    let users = [];
    if (projectId) {
      const project = await Project.findById(projectId).select('departmentId members').lean();
      const memberIds = (project?.members || []).map((m) => String(m));
      const deptCandidates = [];
      if (project?.departmentId) {
        const deptIds = await resolveDepartmentIds(project.departmentId);
        if (deptIds.length > 0) {
          const deptUsers = await User.find({ ...eligible, ...departmentMembershipInQuery(deptIds) })
            .select('_id name email employeeId department departments designation role')
            .lean();
          deptCandidates.push(...deptUsers);
        }
      }
      users = [
        ...deptCandidates.filter((u) => memberIds.length === 0 || memberIds.includes(String(u._id))),
        ...(memberIds.length > 0
          ? await User.find({ ...eligible, _id: { $in: project.members } })
            .select('_id name email employeeId department departments designation role')
            .lean()
          : [])
      ];
      
      if (departmentId) {
        const requestedDeptIds = await resolveDepartmentIds(departmentId);
        const deptIdSet = new Set(requestedDeptIds.map((id) => String(id)));
        users = users.filter((u) => [u.department, ...(u.departments || [])].filter(Boolean).some((id) => deptIdSet.has(String(id))));
      }
    } else if (departmentId) {
      const deptIds = await resolveDepartmentIds(departmentId);
      users = await User.find({ ...eligible, ...departmentMembershipInQuery(deptIds) })
        .select('_id name email employeeId department departments designation role')
        .lean();
    } else {
      users = await User.find(eligible)
        .select('_id name email employeeId department departments designation role')
        .lean();
    }

    // De-duplicate by user id.
    const seen = new Set();
    const uniqueUsers = users.filter((u) => {
      const key = String(u._id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Leave-aware enrichment: mark assignees whose approved leave overlaps
    // the task deadline. They must be disabled/grayed out in the UI.
    let leaveMap = new Map();
    if (deadline) {
      leaveMap = await getLeaveConflictsForEmployees(
        uniqueUsers.map((u) => u._id),
        deadline,
        deadline
      );
    }

    const data = uniqueUsers.map((user) => {
      const conflicts = leaveMap.get(String(user._id)) || [];
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        employeeId: user.employeeId,
        department: user.department,
        departments: user.departments || (user.department ? [user.department] : []),
        designation: user.designation,
        role: user.role,
        assignmentEligible: conflicts.length === 0,
        leaveConflicts: conflicts
      };
    });

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[Tasks] Users list failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Smart redistribute: bulk-reassign an employee's tasks to the
//          available peer with the lowest active workload.
// @route   POST /api/tasks/redistribute/smart
// @body    { leavingUserId, taskIds, leave: { from, to } }
// @access  Private (admin)
const smartRedistribute = async (req, res) => {
  try {
    const { leavingUserId, taskIds, leave } = req.body;
    if (!leavingUserId) {
      return res.status(400).json({ success: false, error: 'leavingUserId is required' });
    }
    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, error: 'taskIds must be a non-empty array' });
    }

    // Hierarchical peer scan on the SAME parent node.
    const window = leave && (leave.from || leave.to) ? { from: leave.from, to: leave.to } : null;
    const peers = await findAvailablePeers(leavingUserId, window);

    // Workload equilibrium: suggest the least-loaded available peer.
    const suggested = await suggestLowestWorkload(peers);

    if (!suggested) {
      return res.status(409).json({
        success: false,
        error: 'No available peers found — every candidate in this hierarchy node has conflicting approved leave'
      });
    }

    const tasks = await Task.find({ _id: { $in: taskIds }, assignedTo: leavingUserId });
    const reassignedIds = [];

    // Financial Deduction Logic
    const settings = await GlobalSettings.findOne() || { leaveTaskDeductionPercentage: 10 };
    const percentage = settings.leaveTaskDeductionPercentage || 10;
    
    const leavingUserObj = await User.findById(leavingUserId).select('salary');
    const monthlyBase = leavingUserObj?.salary?.monthlyBase || 60000;
    const dailyRate = monthlyBase / 30;
    
    // Calculate overlapping days
    let overlappingDays = 1;
    if (leave && leave.from && leave.to) {
      const start = new Date(leave.from);
      const end = new Date(leave.to);
      const diffTime = Math.abs(end - start);
      overlappingDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    }
    
    const totalBonus = dailyRate * overlappingDays * (percentage / 100);
    const bonusPerTask = tasks.length > 0 ? (totalBonus / tasks.length).toFixed(2) : 0;

    for (const task of tasks) {
      task.assignedTo = suggested.user._id;
      task.isCoverageTask = true;
      task.coverageBonus = Number(bonusPerTask);
      task.coveredFor = leavingUserId;
      task.handoverNote = task.handoverNote
        ? `${task.handoverNote} [auto-redistributed from ${leavingUserId}]`
        : `Auto-redistributed by Smart Redistribute (workload balancing).`;
      await task.save();
      reassignedIds.push(task._id);
      await Notification.create({
        userId: suggested.user._id,
        type: 'reminder',
        category: 'info',
        title: 'Task Reassigned with Coverage Bonus',
        message: `A task has been reassigned to you with a coverage bonus of ${bonusPerTask}: ${task.title}`,
        actionUrl: `/tasks/${task._id}`,
        sentBySystem: true
      });
    }

    if (totalBonus > 0 && tasks.length > 0) {
      await DeductionLedger.create({
        fromUser: leavingUserId,
        toUser: suggested.user._id,
        amount: Number(totalBonus.toFixed(2)),
        taskIds: reassignedIds,
        status: 'approved',
        createdBy: req.user._id,
        notes: `Auto-redistributed ${tasks.length} task(s) for ${overlappingDays} leave day(s) at ${percentage}% deduction.`
      });
    }

    res.status(200).json({
      success: true,
      message: `Reassigned ${reassignedIds.length} task(s) to ${suggested.user.name}`,
      data: {
        reassignedCount: reassignedIds.length,
        suggestedPeer: {
          _id: suggested.user._id,
          name: suggested.user.name,
          email: suggested.user.email,
          employeeId: suggested.user.employeeId,
          activeWorkload: suggested.activeWorkload
        },
        peers: peers.map((peer) => ({
          _id: peer.user._id,
          name: peer.user.name,
          email: peer.user.email,
          activeWorkload: peer.activeWorkload,
          available: peer.available,
          leaveConflicts: peer.leaveConflicts
        }))
      }
    });
  } catch (err) {
    console.error('[Tasks] Smart redistribute failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Preview smart redistribute candidates without committing.
// @route   GET /api/tasks/redistribute/preview?leavingUserId=...
// @access  Private (admin)
const previewRedistribution = async (req, res) => {
  try {
    const { leavingUserId, from, to } = req.query;
    if (!leavingUserId) {
      return res.status(400).json({ success: false, error: 'leavingUserId is required' });
    }
    const window = from || to ? { from, to } : null;
    const peers = await findAvailablePeers(leavingUserId, window);
    const suggested = await suggestLowestWorkload(peers);
    res.status(200).json({
      success: true,
      data: {
        suggestedPeer: suggested
          ? {
            _id: suggested.user._id,
            name: suggested.user.name,
            email: suggested.user.email,
            employeeId: suggested.user.employeeId,
            activeWorkload: suggested.activeWorkload
          }
          : null,
        peers: peers.map((peer) => ({
          _id: peer.user._id,
          name: peer.user.name,
          email: peer.user.email,
          activeWorkload: peer.activeWorkload,
          available: peer.available,
          leaveConflicts: peer.leaveConflicts
        }))
      }
    });
  } catch (err) {
    console.error('[Tasks] Redistribution preview failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Weekly workload heatmap (Mon-Sun) for one employee.
// @route   GET /api/tasks/workload/heatmap/:userId
// @access  Private (admin, or the employee themselves)
const getWorkloadHeatmap = async (req, res) => {
  try {
    const { userId } = req.params;
    const isSelf = String(req.user._id) === String(userId);
    if (req.user.role === 'employee' && !isSelf) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }
    const heatmap = await getWeeklyHeatmap(userId);
    res.status(200).json({ success: true, data: heatmap });
  } catch (err) {
    console.error('[Tasks] Heatmap failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Employee deep-dive: assigned tasks + parallel leave calendar.
// @route   GET /api/tasks/employee/:userId/deepdive?month=YYYY-MM
// @access  Private (admin/manager, or self)
const getEmployeeDeepDive = async (req, res) => {
  try {
    const { userId } = req.params;
    const isSelf = String(req.user._id) === String(userId);
    if (!['admin', 'manager', 'hr'].includes(req.user.role) && !isSelf) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    const monthParam = req.query.month;
    const now = new Date();
    const monthStart = monthParam
      ? new Date(`${monthParam}-01T00:00:00.000Z`)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = monthParam
      ? new Date(new Date(monthStart.getTime()).setMonth(monthStart.getMonth() + 1, 0))
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    const [user, tasks, leaves] = await Promise.all([
      User.findById(userId).select('name email employeeId department designation status'),
      populateTaskQuery(Task.find({ assignedTo: userId })).sort({ deadline: 1 }),
      LeaveRequest.find({
        userId,
        status: 'approved',
        startDate: { $lte: monthEnd },
        endDate: { $gte: monthStart }
      })
        .select('leaveType startDate endDate totalDays halfDayType status')
        .sort({ startDate: 1 })
    ]);

    if (!user) {
      return res.status(404).json({ success: false, error: 'Employee not found' });
    }

    res.status(200).json({
      success: true,
      data: {
        user,
        tasks,
        leaves: leaves.map((leave) => ({
          _id: leave._id,
          leaveType: leave.leaveType,
          startDate: leave.startDate,
          endDate: leave.endDate,
          totalDays: leave.totalDays,
          halfDayType: leave.halfDayType
        })),
        month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`
      }
    });
  } catch (err) {
    console.error('[Tasks] Deep dive failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Upload task attachments (PDF, Word docs)
// @route   POST /api/tasks/:id/attachments
const uploadTaskAttachments = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' });
    }

    // Add attachments
    const attachments = req.files.map(file => ({
      filename: file.originalname,
      storedFilename: file.filename,
      url: `/api/files/tasks/${req.params.id}/${file.filename}`,
      fileSize: file.size,
      mimeType: file.mimetype
    }));

    task.attachments = [...(task.attachments || []), ...attachments];
    await task.save();

    res.status(200).json({
      success: true,
      data: task,
      message: 'Attachments uploaded successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Delete multiple tasks
// @route   DELETE /api/tasks/bulk
// @body    { taskIds: [id1, id2, ...] }
const bulkDeleteTasks = async (req, res) => {
  try {
    const { taskIds } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, error: 'taskIds array is required' });
    }

    const result = await Task.deleteMany({ _id: { $in: taskIds } });
    await deleteTaskAssignmentNotificationsByTaskIds(taskIds);

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} tasks deleted successfully`,
      data: { deletedCount: result.deletedCount || 0 }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Update multiple tasks (Status, Priority, Assignee)
// @route   PUT /api/tasks/bulk
// @body    { taskIds: [id1, id2, ...], updates: { status, priority, assignedTo } }
const bulkEditTasks = async (req, res) => {
  try {
    const { taskIds, updates } = req.body;
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ success: false, error: 'taskIds array is required' });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'updates object is required' });
    }

    const allowedUpdates = {};
    if (updates.status) allowedUpdates.status = updates.status;
    if (updates.priority) allowedUpdates.priority = updates.priority;
    if (updates.assignedTo) allowedUpdates.assignedTo = updates.assignedTo;

    const result = await Task.updateMany({ _id: { $in: taskIds } }, { $set: allowedUpdates });

    // Handle reassignment notifications if assignedTo changed
    if (updates.assignedTo) {
      const newUser = await User.findById(updates.assignedTo);
      if (newUser) {
        const notifications = taskIds.map((id) => ({
          userId: updates.assignedTo,
          type: 'reminder',
          category: 'info',
          title: 'Task Reassigned',
          message: 'A task has been bulk-reassigned to you',
          actionUrl: `/tasks/${id}`,
          sentBySystem: true
        }));
        await Notification.insertMany(notifications, { ordered: false }).catch(() => { });
      }
    }

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} tasks updated successfully`,
      data: { modifiedCount: result.modifiedCount || 0 }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllTasks,
  getTasksKpi,
  createTask,
  bulkImportTasks,
  getTaskById,
  updateTask,
  evaluateTask,
  deleteTask,
  deleteAllTasks,
  getUsersForAssignment,
  smartRedistribute,
  previewRedistribution,
  getWorkloadHeatmap,
  getEmployeeDeepDive,
  uploadTaskAttachments,
  bulkDeleteTasks,
  bulkEditTasks,
  submitTaskForReview,
  reviewTaskSubmission
};
