const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  workItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem', default: null, index: true },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isArchived: { type: Boolean, default: false, index: true }
}, { timestamps: true });

conversationSchema.index({ projectId: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
