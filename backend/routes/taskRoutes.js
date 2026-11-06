const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const {
  getAllTasks,
  getTasksKpi,
  createTask,
  bulkImportTasks,
  getTaskById,
  updateTask,
  deleteTask,
  deleteAllTasks,
  getUsersForAssignment,
  smartRedistribute,
  previewRedistribution,
  getWorkloadHeatmap,
  getEmployeeDeepDive,
  uploadTaskAttachments,
  bulkDeleteTasks,
  bulkEditTasks,
  evaluateTask,
  submitTaskForReview,
  reviewTaskSubmission
} = require('../controllers/taskController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/tasks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Allow Excel and document files
  const allowedMimes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                        'application/vnd.ms-excel',
                        'text/csv',
                        'application/octet-stream',
                        'application/pdf',
                        'application/msword',
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = ['.xlsx', '.xls', '.csv', '.pdf', '.doc', '.docx'];
  
  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else if (allowedExtensions.includes(ext)) {
    // Some clients send generic mime types for office files.
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only Excel, PDF, and Word files are allowed'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// All routes require authentication
router.use(protect);

// SPECIFIC ROUTES FIRST (before parameterized routes)
// Utility routes
router.get('/kpi', getTasksKpi);
router.get('/users/list', getUsersForAssignment);
router.get('/employee/:userId/deepdive', getEmployeeDeepDive);
router.get('/workload/heatmap/:userId', getWorkloadHeatmap);
router.get('/redistribute/preview', authorize('admin', 'manager', 'hr'), previewRedistribution);
router.post('/redistribute/smart', authorize('admin'), smartRedistribute);

// Bulk operations
router.post('/bulk/import', upload.single('file'), bulkImportTasks);
router.delete('/bulk', authorize('admin'), bulkDeleteTasks);
router.put('/bulk', authorize('admin', 'manager'), bulkEditTasks);

// THEN GENERAL ROUTES
// GET routes
router.get('/', getAllTasks);

// POST routes
router.post('/', createTask);

// @route   POST /api/tasks/:id/evaluate
// @desc    Evaluate task
// @access  Private (admin/manager)
router.post('/:id/evaluate', authorize('admin', 'manager'), evaluateTask);
router.post('/:id/submit-review', authorize('employee'), submitTaskForReview);
router.post('/:id/review-submission', authorize('admin', 'manager'), reviewTaskSubmission);

// DELETE routes
router.delete('/', authorize('admin'), deleteAllTasks);

// PARAMETERIZED ROUTES LAST (/:id routes that could match anything)
router.get('/:id', getTaskById);
router.post('/:id/attachments', upload.array('attachments', 10), uploadTaskAttachments);
router.put('/:id', updateTask);
router.delete('/:id', authorize('admin'), deleteTask);

module.exports = router;
