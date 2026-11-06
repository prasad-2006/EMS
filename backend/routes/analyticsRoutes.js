const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// Team availability - accessible by managers, hr, admin
router.get(
  '/availability/team',
  checkRole(['manager', 'hr', 'admin']),
  analyticsController.getTeamAvailability
);

// Department availability - hr and admin only
router.get(
  '/availability/department',
  checkRole(['hr', 'admin']),
  analyticsController.getDepartmentAvailability
);

// Leave analytics - hr and admin only
router.get(
  '/leave/analytics',
  checkRole(['hr', 'admin', 'auditor']),
  analyticsController.getLeaveAnalytics
);

// Leave trends - hr and admin only
router.get(
  '/leave/trends',
  checkRole(['hr', 'admin', 'auditor']),
  analyticsController.getLeaveTrends
);

// Leave conflicts - managers, hr, admin
router.get(
  '/leave/conflicts',
  checkRole(['manager', 'hr', 'admin']),
  analyticsController.getLeaveConflicts
);

// Impact analysis endpoint (managers/hr/admin)
router.get(
  '/impact',
  checkRole(['manager', 'hr', 'admin']),
  analyticsController.getImpactAnalysis
);

module.exports = router;
