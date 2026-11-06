const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  getWorkforceAnalytics,
  predictLeavePatterns,
  identifyCoverageRisks,
  generateExecutiveSummary
} = require('../services/advancedAnalyticsService');
const {
  analyzeHandoverRisks,
  suggestOptimalBackup
} = require('../services/handoverIntelligenceService');
const {
  filterLeaves,
  filterTasks,
  globalSearch,
  findAvailableEmployees
} = require('../services/advancedFilterService');

// All routes require authentication
router.use(protect);

/**
 * ANALYTICS ENDPOINTS
 */

// @route   GET /api/analytics/advanced/workforce
// @desc    Get comprehensive workforce analytics
// @access  Private (Manager, Admin)
router.get('/advanced/workforce', authorize('manager', 'admin', 'hr'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateRange = {};
    if (startDate) dateRange.startDate = new Date(startDate);
    if (endDate) dateRange.endDate = new Date(endDate);

    const analytics = await getWorkforceAnalytics(dateRange);
    res.json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/analytics/advanced/patterns
// @desc    Predict future leave patterns
// @access  Private (Admin, HR)
router.get('/advanced/patterns', authorize('admin', 'hr'), async (req, res) => {
  try {
    const predictions = await predictLeavePatterns();
    res.json({ success: true, data: predictions });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/analytics/advanced/coverage-risks
// @desc    Identify department coverage risks
// @access  Private (Manager, Admin)
router.get('/advanced/coverage-risks', authorize('manager', 'admin', 'hr'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const risks = await identifyCoverageRisks(parseInt(days));
    res.json({ success: true, data: risks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/analytics/advanced/executive-summary
// @desc    Get executive summary of leave management
// @access  Private (Admin, HR)
router.get('/advanced/executive-summary', authorize('admin', 'hr'), async (req, res) => {
  try {
    const summary = await generateExecutiveSummary();
    res.json({ success: true, data: summary });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * HANDOVER INTELLIGENCE ENDPOINTS
 */

// @route   GET /api/analytics/handover/risks/:leaveId
// @desc    Analyze handover risks for a leave
// @access  Private (Employee, Manager)
router.get('/handover/risks/:leaveId', async (req, res) => {
  try {
    const { leaveId } = req.params;
    const analysis = await analyzeHandoverRisks(leaveId, req.user._id);
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/analytics/handover/backup-suggestions
// @desc    Get suggested backup persons for flagged tasks
// @access  Private (Employee)
router.get('/handover/backup-suggestions', async (req, res) => {
  try {
    // Get user's flagged tasks for current/upcoming leaves
    const Task = require('../models/Task');
    const LeaveRequest = require('../models/LeaveRequest');

    const activeLeaves = await LeaveRequest.find({
      userId: req.user._id,
      status: { $in: ['pending', 'approved'] }
    });

    if (activeLeaves.length === 0) {
      return res.json({ success: true, data: { suggestions: [] } });
    }

    const leave = activeLeaves[0];
    const flaggedTasks = await Task.find({
      assignedTo: req.user._id,
      $or: [
        { deadline: { $gte: leave.startDate, $lte: leave.endDate } },
        { isRecurring: true }
      ],
      status: { $nin: ['done', 'cancelled'] }
    });

    const suggestions = await suggestOptimalBackup(flaggedTasks, req.user.department);
    res.json({ success: true, data: { suggestions, flaggedTasks: flaggedTasks.length } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * ADVANCED FILTERING ENDPOINTS
 */

// @route   GET /api/analytics/filter/leaves
// @desc    Filter leaves with multiple criteria
// @access  Private
router.get('/filter/leaves', async (req, res) => {
  try {
    const criteria = {
      status: req.query.status,
      leaveType: req.query.leaveType,
      department: req.query.department,
      approvalLevel: req.query.approvalLevel,
      priorityLevel: req.query.priorityLevel,
      dateRange: {
        start: req.query.dateStart,
        end: req.query.dateEnd
      },
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20
    };

    const results = await filterLeaves(criteria);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/analytics/filter/tasks
// @desc    Filter tasks with multiple criteria
// @access  Private
router.get('/filter/tasks', async (req, res) => {
  try {
    const criteria = {
      status: req.query.status,
      priority: req.query.priority,
      assignedTo: req.query.assignedTo,
      assignedBy: req.query.assignedBy,
      isRecurring: req.query.isRecurring === 'true',
      hasDeadline: req.query.hasDeadline === 'true',
      deadlineRange: {
        start: req.query.deadlineStart,
        end: req.query.deadlineEnd
      },
      department: req.query.department,
      isHandedOver: req.query.isHandedOver === 'true',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || 'deadline',
      sortOrder: parseInt(req.query.sortOrder) || -1
    };

    const results = await filterTasks(criteria);
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/analytics/search
// @desc    Global search across leaves, tasks, and users
// @access  Private
router.get('/search', async (req, res) => {
  try {
    const { q, types } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search term required' });
    }

    const entityTypes = types ? types.split(',') : ['leaves', 'tasks', 'users'];
    const results = await globalSearch(q, entityTypes);

    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/analytics/available-employees
// @desc    Find employees available for a given period
// @access  Private (Manager, Admin)
router.get('/available-employees', authorize('manager', 'admin', 'hr'), async (req, res) => {
  try {
    const criteria = {
      dateRange: {
        start: req.query.dateStart,
        end: req.query.dateEnd
      },
      department: req.query.department,
      minAvailableDays: parseInt(req.query.minDays) || 1,
      excludeUsers: req.query.exclude ? req.query.exclude.split(',') : []
    };

    const available = await findAvailableEmployees(criteria);
    res.json({ success: true, data: available });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
