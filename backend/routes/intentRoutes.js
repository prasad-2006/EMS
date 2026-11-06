const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { handleGetIntents, handleCreateIntent } = require('../controllers/intentController');

// All routes require authentication
router.use(protect);

// Get user's intents
router.get('/', handleGetIntents);

// Create new intent
router.post('/', handleCreateIntent);

module.exports = router;
