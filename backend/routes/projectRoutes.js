const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const {
	createProject,
	getProjects,
	getProjectById,
	getProjectAuditEvents,
	updateProject,
	deleteProject,
	bulkDeleteProjects,
	assignProjectToHr,
	assignProjectToManager,
	startProjectExecution,
	submitProjectForManagerReview,
	requestProjectChanges,
	forwardProjectToHr,
	forwardProjectToCeo,
	decideProject,
	uploadProjectDocument,
	downloadProjectDocument
} = require('../controllers/projectController');
const { protect, adminOnly } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

const projectDocumentStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		const uploadDir = path.join(__dirname, '../uploads/projects');
		fs.mkdirSync(uploadDir, { recursive: true });
		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
		cb(null, `${uniqueSuffix}${path.extname(file.originalname).toLowerCase()}`);
	}
});

const allowedExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.md', '.txt'];
const projectDocumentUpload = multer({
	storage: projectDocumentStorage,
	fileFilter: (req, file, cb) => {
		if (allowedExtensions.includes(path.extname(file.originalname || '').toLowerCase())) {
			return cb(null, true);
		}
		return cb(new Error('Invalid document type. Use PDF, Word, Excel, CSV, Markdown, or text files'));
	},
	limits: { fileSize: 50 * 1024 * 1024 }
});

router.post('/', protect, adminOnly, projectDocumentUpload.single('document'), createProject);
router.get('/', protect, getProjects);
router.delete('/bulk', protect, adminOnly, bulkDeleteProjects);
router.get('/:id', protect, getProjectById);
router.get('/:id/audit-events', protect, getProjectAuditEvents);
router.get('/:id/documents/:filename', protect, downloadProjectDocument);
router.post('/:id/assign-hr', protect, authorize('admin'), assignProjectToHr);
router.post('/:id/assign-manager', protect, authorize('hr'), assignProjectToManager);
router.post('/:id/start-execution', protect, authorize('manager'), startProjectExecution);
router.post('/:id/submit-manager-review', protect, authorize('manager'), submitProjectForManagerReview);
router.post('/:id/request-changes', protect, authorize('manager', 'hr'), requestProjectChanges);
router.post('/:id/forward-to-hr', protect, authorize('manager'), forwardProjectToHr);
router.post('/:id/forward-to-ceo', protect, authorize('hr'), forwardProjectToCeo);
router.post('/:id/decision', protect, authorize('admin'), decideProject);
router.post('/:id/documents', protect, authorize('admin', 'hr', 'manager', 'employee'), projectDocumentUpload.single('document'), uploadProjectDocument);
router.put('/:id', protect, adminOnly, updateProject);
router.delete('/:id', protect, adminOnly, deleteProject);

module.exports = router;
