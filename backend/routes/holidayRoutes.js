const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holidayController');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// Public routes (for all authenticated users)
router.get('/', holidayController.getAllHolidays);
router.get('/upcoming', holidayController.getUpcomingHolidays);
router.get('/check', holidayController.checkHoliday);
router.get('/:id', holidayController.getHolidayById);

// Admin/HR only routes
router.post('/', checkRole(['admin', 'hr']), holidayController.createHoliday);
router.patch('/:id', checkRole(['admin', 'hr']), holidayController.updateHoliday);
router.delete('/:id', checkRole(['admin', 'hr']), holidayController.deleteHoliday);

module.exports = router;
