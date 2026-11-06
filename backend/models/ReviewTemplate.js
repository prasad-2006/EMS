const mongoose = require('mongoose');

const reviewTemplateSchema = new mongoose.Schema({
  projectType: { type: String, required: true, index: true },
  workItemType: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  checklist: [{ label: { type: String, required: true }, required: { type: Boolean, default: true } }],
  requiredEvidence: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

reviewTemplateSchema.index({ projectType: 1, workItemType: 1, isActive: 1 });

module.exports = mongoose.model('ReviewTemplate', reviewTemplateSchema);
