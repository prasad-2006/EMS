const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  listWorkItems,
  createWorkItem,
  updateWorkItem,
  bulkUpdateWorkItems,
  listMilestones,
  createMilestone,
  updateMilestone,
  listMembers,
  assignMember,
  getCapacity,
  getCriticalPath
} = require('../controllers/planningController');

const router = express.Router();
router.use(protect);

router.get('/projects/:projectId/work-items', listWorkItems);
router.post('/projects/:projectId/work-items', authorize('admin', 'hr', 'manager'), createWorkItem);
router.put('/work-items/bulk', authorize('admin', 'hr', 'manager'), bulkUpdateWorkItems);
router.put('/work-items/:id', authorize('admin', 'hr', 'manager'), updateWorkItem);
router.get('/projects/:projectId/milestones', listMilestones);
router.post('/projects/:projectId/milestones', authorize('admin', 'hr', 'manager'), createMilestone);
router.put('/milestones/:id', authorize('admin', 'hr', 'manager'), updateMilestone);
router.get('/projects/:projectId/members', listMembers);
router.post('/projects/:projectId/members', authorize('admin', 'hr', 'manager'), assignMember);
router.get('/projects/:projectId/capacity', getCapacity);
router.get('/projects/:projectId/critical-path', getCriticalPath);

module.exports = router;
