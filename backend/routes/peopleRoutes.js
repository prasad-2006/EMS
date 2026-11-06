const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  listSkills,
  createSkill,
  listUserSkills,
  upsertUserSkill,
  getManagerProfile,
  listResourceRequests,
  createResourceRequest,
  updateResourceRequest,
  getWeeklyCapacity,
  createFeedback,
  listFeedback
} = require('../controllers/peopleController');

const router = express.Router();
router.use(protect);

router.get('/skills', listSkills);
router.post('/skills', authorize('admin', 'hr'), createSkill);
router.get('/users/:userId/skills', listUserSkills);
router.post('/users/:userId/skills', upsertUserSkill);
router.get('/managers/:userId/delivery-profile', authorize('admin', 'hr', 'manager'), getManagerProfile);
router.get('/resource-requests', authorize('admin', 'hr', 'manager'), listResourceRequests);
router.post('/projects/:projectId/resource-requests', authorize('admin', 'hr', 'manager'), createResourceRequest);
router.patch('/resource-requests/:id', authorize('admin', 'hr', 'manager'), updateResourceRequest);
router.get('/projects/:projectId/weekly-capacity', getWeeklyCapacity);
router.post('/projects/:projectId/feedback', authorize('admin', 'hr', 'manager'), createFeedback);
router.get('/projects/:projectId/feedback', listFeedback);

module.exports = router;
