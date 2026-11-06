const express = require('express');
const { protect } = require('../middleware/auth');
const {
  listSessions,
  revokeOneSession,
  revokeOtherSessions,
  changePassword,
  logoutAllSessions,
  setupMfa,
  verifyMfaSetup,
  disableMfa
} = require('../controllers/accountSecurityController');

const router = express.Router();
router.use(protect);
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
router.get('/sessions', asyncRoute(listSessions));
router.delete('/sessions/:sessionId', asyncRoute(revokeOneSession));
router.post('/sessions/revoke-others', asyncRoute(revokeOtherSessions));
router.post('/sessions/revoke-all', asyncRoute(logoutAllSessions));
router.post('/password', asyncRoute(changePassword));
router.post('/mfa/setup', asyncRoute(setupMfa));
router.post('/mfa/verify', asyncRoute(verifyMfaSetup));
router.post('/mfa/disable', asyncRoute(disableMfa));

module.exports = router;
