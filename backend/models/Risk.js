const mongoose = require('mongoose');

const riskSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 3000 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  probability: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  impact: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  status: { type: String, enum: ['open', 'mitigated', 'accepted', 'closed'], default: 'open', index: true },
  mitigation: { type: String, trim: true, maxlength: 3000 },
  dueDate: Date,
  escalatedAt: Date
}, { timestamps: true });

riskSchema.index({ projectId: 1, status: 1, impact: 1 });

module.exports = mongoose.model('Risk', riskSchema);
