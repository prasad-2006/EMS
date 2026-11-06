const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { protect } = require('../middleware/auth');
const { checkRole } = require('../middleware/roleCheck');

// All routes require authentication
router.use(protect);

// Get all departments - accessible by all authenticated users
router.get('/', departmentController.getAllDepartments);

// Get department by ID
router.get('/:id', departmentController.getDepartmentById);

// Get department employees
router.get('/:id/employees', departmentController.getDepartmentEmployees);

// Admin/HR only routes
router.post('/', checkRole(['admin', 'hr']), departmentController.createDepartment);
router.patch('/:id', checkRole(['admin', 'hr']), departmentController.updateDepartment);
router.delete('/:id', checkRole(['admin', 'hr']), departmentController.deleteDepartment);

module.exports = router;
