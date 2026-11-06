const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
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
} = require('../controllers/handoverController');

// All routes require authentication
router.use(protect);

// Task check - get flagged tasks for a leave
router.get('/check/:leaveId', getFlaggedTasks);

// Assign task to colleague
router.post('/assign', assignTask);

// Defer task to after return
router.post('/defer/:taskId', deferTask);

// Accept handed-over task
router.patch('/accept/:taskId', acceptTask);

// Reject handed-over task
router.patch('/reject/:taskId', rejectTask);

// Get tasks currently covering for on-leave colleagues
router.get('/covering', getCoveringTasks);

// Complete handover
router.patch('/complete/:taskId', completeHandover);

// Return to work - pull tasks back
router.post('/return/:leaveId', returnToWork);

// Get return-to-work summary
router.get('/return-summary/:leaveId', getReturnSummary);

// My tasks
router.get('/my-tasks', getMyTasks);

// Task CRUD
router.post('/tasks', createTask);
router.put('/tasks/:taskId', updateTask);

// Manager: Get team workload
router.get('/team-workload', authorize('manager', 'admin', 'hr'), getTeamWorkload);

module.exports = router;