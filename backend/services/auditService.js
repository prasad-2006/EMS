const AuditEvent = require('../models/AuditEvent');

const recordAuditEvent = async ({ req, action, resourceType, resourceId, before, after, note, metadata }) => {
  return AuditEvent.create({
    actorId: req.user._id,
    actorRole: req.user.role,
    action,
    resourceType,
    resourceId,
    before,
    after,
    note,
    correlationId: req.headers['x-correlation-id'],
    metadata
  });
};

module.exports = { recordAuditEvent };
