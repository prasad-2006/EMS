const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  listSubmissions,
  listReviews,
  listGates,
  createGate,
  updateGate
  , listReviewTemplates, createReviewTemplate, listApprovalQueue
} = require('../controllers/reviewController');

const router = express.Router();
router.use(protect);

router.get('/projects/:projectId/submissions', listSubmissions);
router.get('/projects/:projectId/reviews', listReviews);
router.get('/projects/:projectId/gates', listGates);
router.post('/projects/:projectId/gates', authorize('admin', 'hr', 'manager'), createGate);
router.patch('/gates/:id', authorize('admin', 'hr', 'manager'), updateGate);
router.get('/templates', listReviewTemplates);
router.post('/templates', authorize('admin', 'hr'), createReviewTemplate);
router.get('/approval-queue', authorize('admin', 'hr', 'manager'), listApprovalQueue);

module.exports = router;
