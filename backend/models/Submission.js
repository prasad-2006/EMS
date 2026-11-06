const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  version: { type: Number, required: true, min: 1 },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  repositoryUrl: { type: String, trim: true },
  pullRequestUrl: { type: String, trim: true },
  documentationLinks: [{ type: String, trim: true }],
  completionNotes: { type: String, trim: true, maxlength: 5000 },
  artifacts: [{ fileName: String, fileUrl: String, fileType: String, fileSize: Number }],
  status: { type: String, enum: ['submitted', 'under_review', 'changes_requested', 'approved', 'superseded'], default: 'submitted', index: true },
  submittedAt: { type: Date, default: Date.now },
  supersededAt: Date
}, { timestamps: true });

submissionSchema.index({ taskId: 1, version: -1 }, { unique: true });
submissionSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('Submission', submissionSchema);
