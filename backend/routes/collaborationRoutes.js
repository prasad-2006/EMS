const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  listConversations,
  createConversation,
  listComments,
  createComment,
  editComment,
  listDecisions,
  createDecision,
  updateDecision
} = require('../controllers/teamCollaborationController');

const router = express.Router();
router.use(protect);

router.get('/projects/:projectId/conversations', listConversations);
router.post('/projects/:projectId/conversations', createConversation);
router.get('/conversations/:conversationId/comments', listComments);
router.post('/conversations/:conversationId/comments', createComment);
router.patch('/comments/:id', editComment);
router.get('/projects/:projectId/decisions', listDecisions);
router.post('/projects/:projectId/decisions', createDecision);
router.patch('/decisions/:id', authorize('admin', 'hr', 'manager'), updateDecision);

module.exports = router;
