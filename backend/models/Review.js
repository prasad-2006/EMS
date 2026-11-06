const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  decision: { type: String, enum: ['approved', 'changes_requested', 'rejected'], required: true },
  note: { type: String, trim: true, maxlength: 5000 },
  score: { type: Number, min: 0, max: 100 },
  checklist: [{ label: { type: String, required: true }, passed: { type: Boolean, default: false }, note: String }],
  reviewedAt: { type: Date, default: Date.now }
}, { timestamps: true });

reviewSchema.index({ submissionId: 1, reviewedAt: -1 });
reviewSchema.index({ projectId: 1, reviewedAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
