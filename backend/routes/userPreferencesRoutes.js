const express = require('express');
const { protect } = require('../middleware/auth');
const {
  getNotificationPreferences,
  updateNotificationPreferences,
  getAppearancePreferences,
  updateAppearancePreferences
} = require('../controllers/userPreferencesController');

const router = express.Router();
router.use(protect);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

router.get('/notifications', asyncRoute(getNotificationPreferences));
router.put('/notifications', asyncRoute(updateNotificationPreferences));
router.get('/appearance', asyncRoute(getAppearancePreferences));
router.put('/appearance', asyncRoute(updateAppearancePreferences));

module.exports = router;
