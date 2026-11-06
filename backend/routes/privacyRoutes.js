const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getPrivacySummary,
  requestExport,
  requestAccountAction,
  listMyPrivacyRequests
} = require('../controllers/privacyController');

const router = express.Router();
router.use(protect);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.get('/summary', asyncRoute(getPrivacySummary));
router.get('/requests', asyncRoute(listMyPrivacyRequests));
router.post('/export', asyncRoute(requestExport));
router.post('/account-action', asyncRoute(requestAccountAction));

module.exports = router;
