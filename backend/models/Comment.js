const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  workItemId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkItem', default: null, index: true },
  parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  attachments: [{ fileName: String, fileUrl: String, fileType: String, fileSize: Number }],
  editedAt: Date,
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

commentSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
