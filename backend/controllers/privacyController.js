const User = require('../models/User');
const PrivacyRequest = require('../models/PrivacyRequest');
const { recordAuditEvent } = require('../services/auditService');

const getPrivacySummary = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('name email employeeId role status designation phoneNumber alternateEmail address emergencyContact joiningDate employmentType createdAt');
  res.json({
    success: true,
    data: {
      profile: user,
      excluded: ['password', 'passwordResetToken', 'sessionToken', 'mfaSecretEncrypted', 'mfaRecoveryCodeHashes', 'auditEvents']
    }
  });
};

const requestExport = async (req, res) => {
  const request = await PrivacyRequest.create({ userId: req.user._id, type: 'export' });
  await recordAuditEvent({ req, action: 'privacy_export_requested', resourceType: 'User', resourceId: req.user._id, after: { requestId: request._id } });
  res.status(201).json({ success: true, data: request });
};

const requestAccountAction = async (req, res) => {
  const { type } = req.body;
  if (!['deactivation', 'deletion'].includes(type)) {
    return res.status(400).json({ success: false, error: 'Request type must be deactivation or deletion' });
  }
  const existing = await PrivacyRequest.findOne({ userId: req.user._id, type, status: { $in: ['requested', 'in_review'] } });
  if (existing) return res.status(409).json({ success: false, error: 'An active request already exists' });
  const request = await PrivacyRequest.create({ userId: req.user._id, type });
  await recordAuditEvent({ req, action: `privacy_${type}_requested`, resourceType: 'User', resourceId: req.user._id, after: { requestId: request._id } });
  res.status(201).json({ success: true, data: request });
};

const listMyPrivacyRequests = async (req, res) => {
  const requests = await PrivacyRequest.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ success: true, data: requests });
};

module.exports = {
  getPrivacySummary,
  requestExport,
  requestAccountAction,
  listMyPrivacyRequests
};
