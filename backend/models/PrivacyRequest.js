const mongoose = require('mongoose');

const privacyRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['export', 'deactivation', 'deletion'], required: true },
  status: { type: String, enum: ['requested', 'in_review', 'completed', 'rejected', 'cancelled'], default: 'requested', index: true },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNote: { type: String, trim: true, maxlength: 2000 },
  completedAt: Date
}, { timestamps: true });

privacyRequestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PrivacyRequest', privacyRequestSchema);
