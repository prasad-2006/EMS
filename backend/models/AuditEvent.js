const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actorRole: { type: String, required: true, index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true, index: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  note: { type: String, trim: true, maxlength: 2000 },
  correlationId: { type: String, trim: true, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

auditEventSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
