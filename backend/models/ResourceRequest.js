const mongoose = require('mongoose');

const resourceRequestSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  skillId: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
  roleTitle: { type: String, required: true, trim: true, maxlength: 150 },
  headcount: { type: Number, min: 1, max: 100, default: 1 },
  allocationPercent: { type: Number, min: 1, max: 100, default: 100 },
  startDate: Date,
  endDate: Date,
  reason: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'fulfilled', 'cancelled'], default: 'pending', index: true },
  assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
  reviewNote: { type: String, trim: true, maxlength: 2000 }
}, { timestamps: true });

resourceRequestSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('ResourceRequest', resourceRequestSchema);
