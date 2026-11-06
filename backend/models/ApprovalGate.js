const mongoose = require('mongoose');

const approvalGateSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  stage: { type: String, enum: ['manager_review', 'qa_review', 'hr_review', 'stakeholder_review', 'ceo_review'], required: true, index: true },
  required: { type: Boolean, default: true },
  requiredEvidence: [{ type: String, trim: true }],
  approverRole: { type: String, enum: ['manager', 'qa', 'hr', 'stakeholder', 'admin'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'skipped'], default: 'pending', index: true },
  decisionNote: { type: String, trim: true, maxlength: 5000 },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  dueDate: Date
}, { timestamps: true });

approvalGateSchema.index({ projectId: 1, stage: 1, status: 1 });

module.exports = mongoose.model('ApprovalGate', approvalGateSchema);
