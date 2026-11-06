const { body, validationResult } = require('express-validator');

// Validation rules
const validateRegister = [
  body('name').trim().notEmpty().withMessage('Name is required')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters'),
  body('role').optional().isIn(['employee', 'admin']).withMessage('Invalid role')
];

const validateLogin = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  body('mfaCode').optional().isLength({ min: 6, max: 40 }).matches(/^[A-Za-z0-9]+$/).withMessage('MFA code is invalid')
];

const validateForgotPassword = [
  body('email').isEmail().withMessage('Please provide a valid email').normalizeEmail()
];

const validateResetPassword = [
  body('password').isLength({ min: 10 }).withMessage('Password must be at least 10 characters')
];

const validateLeaveRequest = [
  body('leaveType').isIn(['casual', 'sick', 'earned', 'wfh', 'emergency']).withMessage('Invalid leave type'),
  body('startDate').isISO8601().toDate().withMessage('Valid start date required'),
  body('endDate').isISO8601().toDate().withMessage('Valid end date required')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('reason').trim().notEmpty().withMessage('Reason is required')
    .isLength({ max: 500 }).withMessage('Reason cannot exceed 500 characters')
];

const validateLeaveStatus = [
  body('status').isIn(['approved', 'rejected']).withMessage('Status must be approved or rejected'),
  body('adminComment').optional().trim().isLength({ max: 500 }).withMessage('Admin comment cannot exceed 500 characters')
];

const validateLeaveCancel = [
  body('reason').optional().trim().isLength({ max: 500 }).withMessage('Cancel reason cannot exceed 500 characters')
];

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateLeaveRequest,
  validateLeaveStatus,
  validateLeaveCancel,
  handleValidationErrors
};
