const express = require('express');
const router = express.Router();
const {
  createLeaveRequest,
  precheckLeaveRequest,
  getMyLeaves,
  getAllLeaves,
  getLeaveById,
  updateLeaveStatus,
  cancelLeaveRequest,
  respondToCoverageRequest
} = require('../controllers/leaveController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { validateLeaveRequest, validateLeaveStatus, validateLeaveCancel, handleValidationErrors } = require('../middleware/validation');

// All leave routes are protected
router.use(protect);

// Employee routes
router.post('/precheck', validateLeaveRequest, handleValidationErrors, precheckLeaveRequest);
router.post('/', validateLeaveRequest, handleValidationErrors, createLeaveRequest);
router.get('/my', getMyLeaves);
router.post('/coverage/respond', respondToCoverageRequest);
router.patch('/:id/cancel', validateLeaveCancel, handleValidationErrors, cancelLeaveRequest);

// Admin and HR routes
router.get('/all', authorize(['admin', 'hr']), getAllLeaves);
router.get('/:id', authorize(['admin', 'hr']), getLeaveById);
router.put('/:id', authorize(['admin', 'hr']), validateLeaveStatus, handleValidationErrors, updateLeaveStatus);

module.exports = router;
