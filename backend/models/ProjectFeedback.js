const mongoose = require('mongoose');

const projectFeedbackSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  revieweeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  period: { type: String, required: true, trim: true, maxlength: 50 },
  deliveryQuality: { type: Number, min: 1, max: 5 },
  communication: { type: Number, min: 1, max: 5 },
  reliability: { type: Number, min: 1, max: 5 },
  strengths: { type: String, trim: true, maxlength: 2000 },
  improvementAreas: { type: String, trim: true, maxlength: 2000 },
  privateToHr: { type: Boolean, default: false }
}, { timestamps: true });

projectFeedbackSchema.index({ revieweeId: 1, period: 1 });
projectFeedbackSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('ProjectFeedback', projectFeedbackSchema);
