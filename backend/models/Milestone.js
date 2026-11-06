const mongoose = require('mongoose');

const milestoneSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['planned', 'in-progress', 'at-risk', 'completed', 'cancelled'], default: 'planned', index: true },
  startDate: Date,
  dueDate: { type: Date, index: true },
  completedAt: Date,
  acceptanceCriteria: [{ type: String, trim: true, maxlength: 1000 }]
}, { timestamps: true });

milestoneSchema.index({ projectId: 1, dueDate: 1 });

module.exports = mongoose.model('Milestone', milestoneSchema);
