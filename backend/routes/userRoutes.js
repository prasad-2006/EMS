const express = require('express');
const router = express.createRouter ? express.createRouter() : express.Router();
const {
  getMe,
  updateMe,
  getAllUsers,
  getUserById,
  approveUser,
  rejectUser,
  updateUser,
  undoAction,
  getActionHistory,
  deleteUser,
  importEmployees,
  uploadEmployeeSheet
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

// Setup base routes (all authenticated users)
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);

// CEO/admin manages HR, managers, and employees. HR manages managers and employees.
const userManagers = authorize(['admin', 'hr', 'manager']);

router.get('/all', protect, userManagers, getAllUsers);
router.get('/history', protect, userManagers, getActionHistory);
router.get('/:id', protect, userManagers, getUserById);
router.post('/import', protect, userManagers, uploadEmployeeSheet, importEmployees);
router.put('/:id/approve', protect, userManagers, approveUser);
router.put('/:id/reject', protect, userManagers, rejectUser);
router.put('/:id', protect, userManagers, updateUser);
router.put('/history/:historyId/undo', protect, userManagers, undoAction);
router.delete('/:id', protect, userManagers, deleteUser);

module.exports = router;
