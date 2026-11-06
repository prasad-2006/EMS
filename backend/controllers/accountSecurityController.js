const crypto = require('crypto');
const UserSession = require('../models/UserSession');
const User = require('../models/User');
const {
  revokeAllOtherSessions,
  revokeAllSessions,
  hashSessionId,
  encodeBase32,
  encryptMfaSecret,
  decryptMfaSecret,
  verifyTotpCode
} = require('../services/accountSecurityService');
const { recordAuditEvent } = require('../services/auditService');

const listSessions = async (req, res) => {
  const sessions = await UserSession.find({
    userId: req.user._id,
    revokedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ lastSeenAt: -1 }).select('deviceName userAgent ipAddress lastSeenAt createdAt expiresAt tokenHash');
  const currentHash = req.sessionId ? hashSessionId(req.sessionId) : null;
  res.json({
    success: true,
    data: sessions.map((session) => ({
      ...session.toObject(),
      isCurrent: Boolean(currentHash && session.tokenHash === currentHash),
      tokenHash: undefined
    }))
  });
};

const revokeOneSession = async (req, res) => {
  const revoked = await UserSession.updateOne(
    { _id: req.params.sessionId, userId: req.user._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (!revoked.modifiedCount) return res.status(404).json({ success: false, error: 'Active session not found' });
  await recordAuditEvent({ req, action: 'session_revoked', resourceType: 'User', resourceId: req.user._id });
  res.json({ success: true, message: 'Session revoked' });
};

const revokeOtherSessions = async (req, res) => {
  if (!req.sessionId) return res.status(400).json({ success: false, error: 'Current session cannot be identified' });
  await revokeAllOtherSessions(req.user._id, req.sessionId);
  await recordAuditEvent({ req, action: 'other_sessions_revoked', resourceType: 'User', resourceId: req.user._id });
  res.json({ success: true, message: 'Other sessions revoked' });
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 10) {
    return res.status(400).json({ success: false, error: 'Current password and a new password of at least 10 characters are required' });
  }
  const user = await User.findById(req.user._id).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect' });
  }
  user.password = newPassword;
  await user.save();
  await revokeAllSessions(user._id);
  await recordAuditEvent({ req, action: 'password_changed', resourceType: 'User', resourceId: user._id });
  res.json({ success: true, message: 'Password changed. Please sign in again.' });
};

const logoutAllSessions = async (req, res) => {
  await revokeAllSessions(req.user._id);
  await recordAuditEvent({ req, action: 'all_sessions_revoked', resourceType: 'User', resourceId: req.user._id });
  res.json({ success: true, message: 'All sessions revoked' });
};

const createRecoveryCodes = () => Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));

const setupMfa = async (req, res) => {
  const user = await User.findById(req.user._id);
  const secret = encodeBase32(crypto.randomBytes(20));
  user.mfaSecretEncrypted = encryptMfaSecret(secret);
  user.mfaEnabled = false;
  await user.save({ validateBeforeSave: false });
  const issuer = encodeURIComponent('Employee Management System');
  const account = encodeURIComponent(user.email);
  res.json({
    success: true,
    data: {
      secret,
      otpauthUrl: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
    }
  });
};

const verifyMfaSetup = async (req, res) => {
  const user = await User.findById(req.user._id).select('+mfaSecretEncrypted');
  if (!user?.mfaSecretEncrypted || !verifyTotpCode(decryptMfaSecret(user.mfaSecretEncrypted), req.body.code)) {
    return res.status(400).json({ success: false, error: 'Invalid MFA code' });
  }
  const recoveryCodes = createRecoveryCodes();
  user.mfaEnabled = true;
  user.mfaRecoveryCodeHashes = recoveryCodes.map((code) => crypto.createHash('sha256').update(code).digest('hex'));
  await user.save({ validateBeforeSave: false });
  await recordAuditEvent({ req, action: 'mfa_enabled', resourceType: 'User', resourceId: user._id });
  res.json({ success: true, data: { recoveryCodes } });
};

const disableMfa = async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +mfaSecretEncrypted');
  if (!user?.mfaEnabled || !(await user.comparePassword(req.body.currentPassword || ''))) {
    return res.status(401).json({ success: false, error: 'Current password is incorrect' });
  }
  if (!verifyTotpCode(decryptMfaSecret(user.mfaSecretEncrypted), req.body.code)) {
    return res.status(400).json({ success: false, error: 'Invalid MFA code' });
  }
  user.mfaEnabled = false;
  user.mfaSecretEncrypted = undefined;
  user.mfaRecoveryCodeHashes = [];
  await user.save({ validateBeforeSave: false });
  await recordAuditEvent({ req, action: 'mfa_disabled', resourceType: 'User', resourceId: user._id });
  res.json({ success: true, message: 'MFA disabled' });
};

module.exports = {
  listSessions,
  revokeOneSession,
  revokeOtherSessions,
  changePassword,
  logoutAllSessions,
  createRecoveryCodes,
  setupMfa,
  verifyMfaSetup,
  disableMfa
};
