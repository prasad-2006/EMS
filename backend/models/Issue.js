const mongoose = require('mongoose');

const issueSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 3000 },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium', index: true },
  status: { type: String, enum: ['open', 'in-progress', 'blocked', 'resolved', 'closed'], default: 'open', index: true },
  resolution: { type: String, trim: true, maxlength: 3000 },
  dueDate: Date,
  escalatedAt: Date
}, { timestamps: true });

issueSchema.index({ projectId: 1, status: 1, severity: 1 });

module.exports = mongoose.model('Issue', issueSchema);
