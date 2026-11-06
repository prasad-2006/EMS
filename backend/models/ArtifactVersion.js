const mongoose = require('mongoose');

const artifactVersionSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  version: { type: Number, required: true, min: 1 },
  fileName: { type: String, required: true, trim: true },
  fileUrl: { type: String, required: true, trim: true },
  fileType: String,
  fileSize: Number,
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now }
}, { timestamps: true });

artifactVersionSchema.index({ submissionId: 1, version: 1 });

module.exports = mongoose.model('ArtifactVersion', artifactVersionSchema);
