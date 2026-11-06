const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// Public routes
router.get('/', policyController.getAllPolicies);
router.get('/default', policyController.getDefaultPolicy);

// Validate leave request against policy
router.post('/validate', policyController.validateLeaveRequest);

router.get('/:id', policyController.getPolicyById);

// Admin/HR only routes
router.post('/', checkRole(['admin', 'hr']), policyController.createPolicy);
router.patch('/:id', checkRole(['admin', 'hr']), policyController.updatePolicy);
router.delete('/:id', checkRole(['admin', 'hr']), policyController.deletePolicy);

module.exports = router;
