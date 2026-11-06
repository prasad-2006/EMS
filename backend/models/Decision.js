const mongoose = require('mongoose');

const decisionSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  context: { type: String, trim: true, maxlength: 5000 },
  options: [{ type: String, trim: true, maxlength: 1000 }],
  decision: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['proposed', 'approved', 'rejected', 'superseded'], default: 'proposed', index: true },
  proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  decidedAt: Date,
  dueDate: Date
}, { timestamps: true });

decisionSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model('Decision', decisionSchema);
