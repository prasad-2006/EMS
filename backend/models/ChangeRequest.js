const mongoose = require('mongoose');

const changeRequestSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 5000 },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  impact: { type: String, trim: true, maxlength: 3000 },
  effortHours: { type: Number, min: 0 },
  scheduleImpactDays: { type: Number, min: 0 },
  status: { type: String, enum: ['proposed', 'under_review', 'approved', 'rejected', 'implemented'], default: 'proposed', index: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decisionNote: { type: String, trim: true, maxlength: 3000 },
  decidedAt: Date
}, { timestamps: true });

changeRequestSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('ChangeRequest', changeRequestSchema);
