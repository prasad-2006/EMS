const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  listRisks,
  createRisk,
  updateRisk,
  listIssues,
  createIssue,
  updateIssue,
  listChangeRequests,
  createChangeRequest,
  updateChangeRequest,
  getPortfolio,
  searchGovernance
} = require('../controllers/governanceController');

const router = express.Router();
router.use(protect);

router.get('/portfolio', authorize('admin', 'hr'), getPortfolio);
router.get('/search', authorize('admin', 'hr', 'manager'), searchGovernance);
router.get('/projects/:projectId/risks', listRisks);
router.post('/projects/:projectId/risks', authorize('admin', 'hr', 'manager'), createRisk);
router.patch('/risks/:id', authorize('admin', 'hr', 'manager'), updateRisk);
router.get('/projects/:projectId/issues', listIssues);
router.post('/projects/:projectId/issues', authorize('admin', 'hr', 'manager'), createIssue);
router.patch('/issues/:id', authorize('admin', 'hr', 'manager'), updateIssue);
router.get('/projects/:projectId/change-requests', listChangeRequests);
router.post('/projects/:projectId/change-requests', authorize('admin', 'hr', 'manager'), createChangeRequest);
router.patch('/change-requests/:id', authorize('admin', 'hr', 'manager'), updateChangeRequest);

module.exports = router;
