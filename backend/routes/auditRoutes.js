const express = require('express');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { listAuditEvents } = require('../controllers/auditController');

const router = express.Router();
router.use(protect, authorize('admin', 'hr'));
router.get('/events', listAuditEvents);

module.exports = router;
