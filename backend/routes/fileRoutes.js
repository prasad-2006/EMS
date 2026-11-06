const express = require('express');
const { protect } = require('../middleware/auth');
const { downloadTaskArtifact } = require('../controllers/fileAccessController');

const router = express.Router();
router.use(protect);
router.get('/tasks/:taskId/:filename', downloadTaskArtifact);

module.exports = router;
