const express = require('express');
const router = express.Router();
const {
  getMySalary,
  getSalaryByUser,
  getAllSalaries,
  updateSalary
} = require('../controllers/salaryController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// All salary routes are protected
router.use(protect);

// Own salary report
router.get('/me', getMySalary);

// Admin only routes
router.get('/all', authorize('admin'), getAllSalaries);
router.get('/:userId', authorize('admin'), getSalaryByUser);
router.put('/:userId', authorize('admin'), updateSalary);

module.exports = router;