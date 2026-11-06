const express = require('express');
const router = express.Router();
const { getSettings, updateSettings } = require('../controllers/settingsController');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getSettings)
  .put(adminOnly, updateSettings); // 'admin' is the CEO role in DB

module.exports = router;
