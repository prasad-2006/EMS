const mongoose = require('mongoose');

const projectMemberSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectRole: { type: String, enum: ['sponsor', 'manager', 'lead', 'developer', 'designer', 'qa', 'stakeholder', 'member'], default: 'member' },
  allocationPercent: { type: Number, min: 1, max: 100, default: 100 },
  startDate: Date,
  endDate: Date,
  status: { type: String, enum: ['planned', 'active', 'released'], default: 'planned', index: true }
}, { timestamps: true });

projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
projectMemberSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('ProjectMember', projectMemberSchema);
