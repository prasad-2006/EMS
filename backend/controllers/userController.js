const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const User = require('../models/User');
const Department = require('../models/Department');
const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');
const ActionHistory = require('../models/ActionHistory');
const Notification = require('../models/Notification');
const { revokeAllSessions } = require('../services/accountSecurityService');
const {
  departmentMembershipQuery,
  normalizeDepartmentIds
} = require('../services/userDepartmentService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExtension = allowedExtensions.some((extension) =>
      file.originalname.toLowerCase().endsWith(extension)
    );

    if (!hasValidExtension) {
      return cb(new Error('Only Excel or CSV files are allowed'));
    }

    cb(null, true);
  }
});

const allowedStatuses = ['pending', 'approved', 'rejected'];
const allowedEmploymentTypes = ['full_time', 'part_time', 'contract', 'intern'];
const manageableRoles = {
  admin: ['employee', 'hr', 'manager'],
  hr: ['employee', 'manager'],
  manager: ['employee']
};

const canManageUserRole = (actorRole, targetRole) => manageableRoles[actorRole]?.includes(targetRole);

const normalizeHeader = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const normalizeText = (value) => String(value || '').trim();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLookupValue = (value) => normalizeText(value)
  .toLowerCase()
  .replace(/\s+/g, ' ');

const normalizeRow = (row = {}) => Object.entries(row).reduce((accumulator, [key, value]) => {
  accumulator[normalizeHeader(key)] = typeof value === 'string' ? value.trim() : value;
  return accumulator;
}, {});

const getRowValue = (row, aliases) => {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
};

const formatNameFromEmail = (email) => {
  const localPart = normalizeText(email).split('@')[0] || 'Employee';
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const parseDateValue = (value) => {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate;
};

const generateTemporaryPassword = () => `Emp@${crypto.randomBytes(4).toString('hex')}`;

const syncDepartmentEmployeeCounts = async (departmentIds = []) => {
  const uniqueDepartmentIds = [...new Set(
    departmentIds
      .filter(Boolean)
      .map((departmentId) => departmentId.toString())
  )];

  await Promise.all(uniqueDepartmentIds.map(async (departmentId) => {
    const employeeCount = await User.countDocuments({
      ...departmentMembershipQuery(departmentId),
      role: 'employee',
      isDeleted: { $ne: true }
    });

    await Department.findByIdAndUpdate(departmentId, { employeeCount });
  }));
};

const findDepartmentForRow = (row, departmentByName, departmentByCode) => {
  const departmentName = getRowValue(row, ['department_name', 'department', 'dept_name', 'dept']);
  const departmentCode = getRowValue(row, ['department_code', 'dept_code']);

  const normalizedDepartmentName = normalizeLookupValue(departmentName);
  const normalizedDepartmentCode = normalizeLookupValue(departmentCode).toUpperCase();

  if (normalizedDepartmentCode && departmentByCode.has(normalizedDepartmentCode)) {
    return departmentByCode.get(normalizedDepartmentCode);
  }

  if (normalizedDepartmentName && departmentByName.has(normalizedDepartmentName)) {
    return departmentByName.get(normalizedDepartmentName);
  }

  return null;
};

const uploadEmployeeSheet = (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (!error) {
      return next();
    }

    const errorMessage = error.code === 'LIMIT_FILE_SIZE'
      ? 'File size must be 5MB or less'
      : error.message;

    return res.status(400).json({
      success: false,
      error: errorMessage
    });
  });
};

// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('department', 'name code')
      .populate('departments', 'name code')
      .populate('managerId', 'name email employeeId');
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        employeeId: user.employeeId,
        employmentType: user.employmentType,
        joiningDate: user.joiningDate,
        manager: user.managerId,
        designation: user.designation,
        phoneNumber: user.phoneNumber,
        alternateEmail: user.alternateEmail,
        address: user.address,
        emergencyContact: user.emergencyContact,
        department: user.department,
        departments: user.departments?.length ? user.departments : (user.department ? [user.department] : []),
        leaveBalance: user.leaveBalance,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user profile'
    });
  }
};

// @desc    Update current user profile
// @route   PUT /api/users/me
// @access  Private
const updateMe = async (req, res) => {
  try {
    const allowedUpdates = ['name', 'phoneNumber', 'designation', 'alternateEmail', 'address', 'emergencyContact'];
    const updates = {};

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const requestedEmail = req.body.email ? normalizeEmail(req.body.email) : '';
    const currentPassword = normalizeText(req.body.currentPassword);
    const newPassword = normalizeText(req.body.newPassword);

    if (requestedEmail && requestedEmail !== normalizeEmail(req.user.email)) {
      const emailInUse = await User.findOne({
        _id: { $ne: req.user.id },
        email: { $regex: `^${escapeRegExp(requestedEmail)}$`, $options: 'i' }
      });

      if (emailInUse) {
        return res.status(400).json({
          success: false,
          error: 'Email is already in use'
        });
      }

      updates.email = requestedEmail;
    }

    if ((newPassword || updates.email) && !currentPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password is required to change email or password'
      });
    }

    if (newPassword) {
      if (newPassword.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 10 characters'
        });
      }

    }

    if (Object.keys(updates).length === 0 && !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update'
      });
    }

    const updatedUser = await User.findById(req.user.id).select('+password');
    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    Object.assign(updatedUser, updates);

    if (newPassword || updates.email) {
      const isPasswordMatch = await updatedUser.comparePassword(currentPassword);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      updatedUser.password = newPassword;
    }

    await updatedUser.save();
    if (newPassword) {
      await revokeAllSessions(updatedUser._id);
    }
    await updatedUser.populate('department', 'name code');
    await updatedUser.populate('departments', 'name code');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        designation: updatedUser.designation,
        phoneNumber: updatedUser.phoneNumber,
        alternateEmail: updatedUser.alternateEmail,
        address: updatedUser.address,
        emergencyContact: updatedUser.emergencyContact,
        department: updatedUser.department,
        departments: updatedUser.departments?.length ? updatedUser.departments : (updatedUser.department ? [updatedUser.department] : []),
        leaveBalance: updatedUser.leaveBalance,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating profile'
    });
  }
};

// @desc    Get all employees (for admin)
// @route   GET /api/users/all
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const { status } = req.query;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;
    
    let query = {};
    
    const permittedRoles = manageableRoles[req.user.role] || [];
    const requestedRoles = req.query.role ? req.query.role.split(',') : permittedRoles;
    query.role = { $in: requestedRoles.filter((role) => permittedRoles.includes(role)) };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      query.status = status;
    }
    
    const [users, total] = await Promise.all([
      User.find(query)
        .populate('department', 'name code')
        .populate('departments', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ]);
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users.map(user => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        designation: user.designation,
        department: user.department
          ? {
              id: user.department._id,
              name: user.department.name,
              code: user.department.code
            }
          : null,
        departments: user.departments?.length
          ? user.departments.map((department) => ({
              id: department._id,
              name: department.name,
              code: department.code
            }))
          : user.department
            ? [{ id: user.department._id, name: user.department.name, code: user.department.code }]
            : [],
        leaveBalance: user.leaveBalance,
        createdAt: user.createdAt
      })),
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
      error: 'Server error while fetching users'
    });
  }
};

// @desc    Approve a user
// @route   PUT /api/users/:id/approve
// @access  Private/Admin
const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!canManageUserRole(req.user.role, user.role)) {
      return res.status(403).json({ success: false, error: 'You are not allowed to manage this user role' });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify admin users'
      });
    }

    const previousStatus = user.status;
    user.status = 'approved';
    await user.save();

    // Create history record
    await ActionHistory.create({
      actionType: 'approve',
      targetUser: user._id,
      targetUserName: user.name,
      targetUserEmail: user.email,
      performedBy: req.user.id,
      performedByName: req.user.name,
      previousStatus,
      newStatus: 'approved'
    });

    await Notification.create({
      userId: user._id,
      type: 'account',
      title: 'Account approved',
      message: 'Your account has been approved. You can now log in and apply for leave.'
    });
    
    res.status(200).json({
      success: true,
      message: 'User approved successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while approving user'
    });
  }
};

// @desc    Reject a user
// @route   PUT /api/users/:id/reject
// @access  Private/Admin
const rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!canManageUserRole(req.user.role, user.role)) {
      return res.status(403).json({ success: false, error: 'You are not allowed to manage this user role' });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify admin users'
      });
    }

    const previousStatus = user.status;
    user.status = 'rejected';
    await user.save();

    // Create history record
    await ActionHistory.create({
      actionType: 'reject',
      targetUser: user._id,
      targetUserName: user.name,
      targetUserEmail: user.email,
      performedBy: req.user.id,
      performedByName: req.user.name,
      previousStatus,
      newStatus: 'rejected'
    });

    await Notification.create({
      userId: user._id,
      type: 'account',
      title: 'Account rejected',
      message: 'Your account registration request has been rejected. Please contact the administrator.'
    });
    
    res.status(200).json({
      success: true,
      message: 'User rejected successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while rejecting user'
    });
  }
};

// @desc    Undo an action (restore to previous status)
// @route   PUT /api/users/history/:historyId/undo
// @access  Private/Admin
const undoAction = async (req, res) => {
  try {
    const history = await ActionHistory.findById(req.params.historyId);
    
    if (!history) {
      return res.status(404).json({
        success: false,
        error: 'History record not found'
      });
    }

    if (history.isUndone) {
      return res.status(400).json({
        success: false,
        error: 'Action has already been undone'
      });
    }

    const user = await User.findById(history.targetUser);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!canManageUserRole(req.user.role, user.role)) {
      return res.status(403).json({ success: false, error: 'You are not allowed to manage this user role' });
    }

    // Restore previous status
    const currentStatus = user.status;
    user.status = history.previousStatus;
    await user.save();

    // Mark history as undone
    history.isUndone = true;
    await history.save();

    // Create undo history record
    await ActionHistory.create({
      actionType: history.actionType === 'approve' ? 'undo_approve' : 'undo_reject',
      targetUser: user._id,
      targetUserName: user.name,
      targetUserEmail: user.email,
      performedBy: req.user.id,
      performedByName: req.user.name,
      previousStatus: currentStatus,
      newStatus: history.previousStatus
    });
    
    res.status(200).json({
      success: true,
      message: 'Action undone successfully',
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while undoing action'
    });
  }
};

// @desc    Get action history
// @route   GET /api/users/history
// @access  Private/Admin
const getActionHistory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const [history, total] = await Promise.all([
      ActionHistory.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      ActionHistory.countDocuments()
    ]);
    
    res.status(200).json({
      success: true,
      count: history.length,
      data: history,
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
      error: 'Server error while fetching history'
    });
  }
};

// @desc    Get user details by id (with assigned tasks)
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -passwordResetToken -passwordResetExpires -sessionToken')
      .populate('department', 'name code')
      .populate('departments', 'name code')
      .populate('managerId', 'name email');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!canManageUserRole(req.user.role, user.role)) {
      return res.status(403).json({ success: false, error: 'You are not allowed to manage this user role' });
    }

    const tasks = await Task.find({ assignedTo: user._id })
      .populate('projectId', 'name code')
      .populate('assignedTo', 'name email role')
      .sort({ deadline: 1, priority: -1 });
    const leaveRequests = await LeaveRequest.find({ userId: user._id })
      .select('leaveType startDate endDate totalDays status workflowStage reason createdAt')
      .sort({ startDate: -1 })
      .limit(100);
    const actionHistory = await ActionHistory.find({ targetUser: user._id })
      .select('actionType previousStatus newStatus performedByName createdAt isUndone')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      data: {
        user: user.toObject(),
        tasks,
        leaveRequests,
        actionHistory
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching user details'
    });
  }
};

// @desc    Update user details (admin can update department, designation, etc.)
// @route   PUT /api/users/:id
// @access  Private/Admin
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    if (user.role === 'admin' && req.body.role !== 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot modify admin role'
      });
    }

    if (req.body.role !== undefined && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only the CEO can change user roles'
      });
    }

    const allowedUpdates = [
      'name',
      'email',
      'employeeId',
      'department',
      'departments',
      'designation',
      'grade',
      'employmentType',
      'phoneNumber',
      'alternateEmail',
      'address',
      'emergencyContact',
      'status',
      'leaveBalance',
      'leaveCarryForward',
      'role',
      'managerId'
    ];
    const updates = {};
    const touchedDepartmentIds = new Set();

    if (req.body.password) {
      if (req.body.password.length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 10 characters'
        });
      }
      user.password = req.body.password;
      await user.save();
    }

    normalizeDepartmentIds(user.departments, user.department).forEach((departmentId) => touchedDepartmentIds.add(departmentId));
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (req.body.salary) {
      updates.salary = {
        ...user.salary,
        ...req.body.salary,
        updatedAt: Date.now(),
        updatedBy: req.user._id
      };
    }

    if (req.body.departments !== undefined || req.body.department !== undefined) {
      const requestedDepartmentIds = normalizeDepartmentIds(req.body.departments, req.body.department);
      const departments = await Department.find({ _id: { $in: requestedDepartmentIds } }).select('_id');
      if (departments.length !== requestedDepartmentIds.length) {
        return res.status(404).json({
          success: false,
          error: 'One or more departments were not found'
        });
      }

      updates.departments = requestedDepartmentIds;
      updates.department = requestedDepartmentIds[0] || null;
      requestedDepartmentIds.forEach((departmentId) => touchedDepartmentIds.add(departmentId));
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    ).populate('department', 'name code').populate('departments', 'name code');

    await syncDepartmentEmployeeCounts([...touchedDepartmentIds]);

    // Create notification for user
    await Notification.create({
      userId: user._id,
      type: 'account',
      title: 'Profile Updated',
      message: 'Your profile has been updated by an administrator.'
    });
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating user'
    });
  }
};

// @desc    Delete a user permanently
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!canManageUserRole(req.user.role, user.role)) {
      return res.status(403).json({ success: false, error: 'You are not allowed to manage this user role' });
    }
    
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete admin users'
      });
    }
    
    const affectedDepartmentId = user.department ? user.department.toString() : null;

    await User.findByIdAndDelete(req.params.id);

    await syncDepartmentEmployeeCounts([affectedDepartmentId]);
    
    res.status(200).json({
      success: true,
      message: 'User deleted permanently'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting user'
    });
  }
};

// @desc    Import employees from Excel/CSV
// @route   POST /api/users/import
// @access  Private/Admin
const importEmployees = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload an Excel or CSV file'
      });
    }

    const workbook = XLSX.read(req.file.buffer, {
      type: 'buffer',
      cellDates: true
    });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return res.status(400).json({
        success: false,
        error: 'The uploaded file does not contain any sheets'
      });
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
      defval: '',
      raw: false
    });

    const normalizedRows = sheetRows
      .map((row, index) => ({
        rowNumber: index + 2,
        values: normalizeRow(row)
      }))
      .filter(({ values }) => Object.values(values).some((value) => String(value).trim() !== ''));

    if (normalizedRows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'The uploaded file does not contain any employee rows'
      });
    }

    const departments = await Department.find({ isActive: true }).select('_id name code');
    const departmentByName = new Map(
      departments.map((department) => [normalizeLookupValue(department.name), department])
    );
    const departmentByCode = new Map(
      departments.map((department) => [normalizeLookupValue(department.code).toUpperCase(), department])
    );

    const emails = normalizedRows
      .map(({ values }) => normalizeText(getRowValue(values, ['email', 'email_address', 'employee_email'])).toLowerCase())
      .filter(Boolean);

    const existingUsers = await User.find({ email: { $in: emails } });
    const existingUsersByEmail = new Map(
      existingUsers.map((user) => [user.email.toLowerCase(), user])
    );

    const seenEmails = new Set();
    const touchedDepartmentIds = new Set();
    const results = {
      created: [],
      updated: [],
      skipped: []
    };

    for (const { rowNumber, values } of normalizedRows) {
      try {
      const email = normalizeText(getRowValue(values, ['email', 'email_address', 'employee_email'])).toLowerCase();

      if (!email) {
        results.skipped.push({ row: rowNumber, reason: 'Email is required' });
        continue;
      }

      if (seenEmails.has(email)) {
        results.skipped.push({ row: rowNumber, email, reason: 'Duplicate email in uploaded file' });
        continue;
      }

      seenEmails.add(email);

      const department = findDepartmentForRow(values, departmentByName, departmentByCode);
      if (!department) {
        results.skipped.push({
          row: rowNumber,
          email,
          reason: 'Department not found. Use an existing department name or code.'
        });
        continue;
      }
      if (req.user.role === 'manager' && req.user.department?.toString() !== department._id.toString()) {
        results.skipped.push({ row: rowNumber, email, reason: 'Managers can only import employees into their own department' });
        continue;
      }

      const allowedRoles = ['employee', 'hr', 'manager'];
      const forcedRole = normalizeText(req.body.role).toLowerCase();
      const importableRoles = manageableRoles[req.user.role] || [];
      if (forcedRole && !importableRoles.includes(forcedRole)) {
        return res.status(403).json({ success: false, error: `Your role cannot import ${forcedRole} users` });
      }
      
      const existingUser = existingUsersByEmail.get(email);
      if (existingUser && existingUser.role === 'admin') {
        results.skipped.push({ row: rowNumber, email, reason: 'Admin accounts cannot be modified via bulk import' });
        continue;
      }

      const name = normalizeText(getRowValue(values, ['name', 'employee_name', 'full_name'])) || formatNameFromEmail(email);
      const designation = normalizeText(getRowValue(values, ['designation', 'title', 'job_title']));
      const phoneNumber = normalizeText(getRowValue(values, ['phone_number', 'phone', 'mobile', 'contact_number']));
      const employeeId = normalizeText(getRowValue(values, ['employee_id', 'emp_id'])).toUpperCase();
      const password = normalizeText(getRowValue(values, ['password', 'temporary_password', 'temp_password']));
      const joiningDate = parseDateValue(getRowValue(values, ['joining_date', 'date_of_joining', 'start_date']));
      const statusValue = normalizeText(getRowValue(values, ['status'])).toLowerCase();
      const roleValue = normalizeText(getRowValue(values, ['role', 'user_role', 'account_type'])).toLowerCase();
      const employmentTypeValue = normalizeText(getRowValue(values, ['employment_type', 'employment', 'employee_type']))
        .toLowerCase()
        .replace(/\s+/g, '_');
        
      const finalRole = allowedRoles.includes(forcedRole)
        ? forcedRole
        : allowedRoles.includes(roleValue)
          ? roleValue
          : 'employee';
      if (!importableRoles.includes(finalRole)) {
        results.skipped.push({ row: rowNumber, email, reason: `You are not allowed to import ${finalRole} users` });
        continue;
      }

      if (existingUser) {
        const previousDepartmentId = existingUser.department ? existingUser.department.toString() : null;

        existingUser.name = name;
        existingUser.departments = normalizeDepartmentIds(existingUser.departments, department._id);
        existingUser.department = department._id;
        
        // Update role if explicitly provided and valid
        if (forcedRole || (roleValue && allowedRoles.includes(roleValue))) {
          existingUser.role = finalRole;
        }

        if (designation) {
          existingUser.designation = designation;
        }

        if (phoneNumber) {
          existingUser.phoneNumber = phoneNumber;
        }

        if (employeeId) {
          existingUser.employeeId = employeeId;
        }

        if (joiningDate) {
          existingUser.joiningDate = joiningDate;
        }

        if (statusValue && allowedStatuses.includes(statusValue)) {
          existingUser.status = statusValue;
        }

        if (employmentTypeValue && allowedEmploymentTypes.includes(employmentTypeValue)) {
          existingUser.employmentType = employmentTypeValue;
        }

        await existingUser.save();

        if (previousDepartmentId) {
          touchedDepartmentIds.add(previousDepartmentId);
        }
        touchedDepartmentIds.add(department._id.toString());

        results.updated.push({
          row: rowNumber,
          email,
          name: existingUser.name,
          department: department.name
        });
        continue;
      }

      const temporaryPassword = password || generateTemporaryPassword();
      const newUser = await User.create({
        name,
        email,
        password: temporaryPassword,
        role: finalRole,
        status: allowedStatuses.includes(statusValue) ? statusValue : 'approved',
        department: department._id,
        departments: [department._id],
        designation: designation || undefined,
        phoneNumber: phoneNumber || undefined,
        employeeId: employeeId || undefined,
        joiningDate: joiningDate || undefined,
        employmentType: allowedEmploymentTypes.includes(employmentTypeValue) ? employmentTypeValue : 'full_time'
      });

      touchedDepartmentIds.add(department._id.toString());
      existingUsersByEmail.set(email, newUser);

      results.created.push({
        row: rowNumber,
        email,
        name: newUser.name,
        department: department.name,
        role: finalRole,
        temporaryPassword: password ? undefined : temporaryPassword
      });
      } catch (rowError) {
        const rowErrorMessage = rowError.code === 11000
          ? 'Duplicate email or employee ID already exists'
          : rowError.name === 'ValidationError'
            ? Object.values(rowError.errors).map((item) => item.message).join(', ')
            : rowError.message;

        results.skipped.push({
          row: rowNumber,
          email: normalizeText(getRowValue(values, ['email', 'email_address', 'employee_email'])).toLowerCase() || undefined,
          reason: rowErrorMessage
        });
      }
    }

    await syncDepartmentEmployeeCounts([...touchedDepartmentIds]);

    res.status(200).json({
      success: true,
      message: 'Employee import completed',
      data: {
        totalRows: normalizedRows.length,
        createdCount: results.created.length,
        updatedCount: results.updated.length,
        skippedCount: results.skipped.length,
        ...results
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: 'Server error while importing employees'
    });
  }
};

module.exports = {
  uploadEmployeeSheet,
  getMe,
  updateMe,
  getAllUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUser,
  undoAction,
  getActionHistory,
  deleteUser,
  importEmployees
};
