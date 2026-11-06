const mongoose = require('mongoose');

const userSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  deviceName: { type: String, trim: true, maxlength: 120 },
  userAgent: { type: String, trim: true, maxlength: 500 },
  ipAddress: { type: String, trim: true, maxlength: 100 },
  lastSeenAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

userSessionSchema.index({ userId: 1, revokedAt: 1, lastSeenAt: -1 });
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserSession', userSessionSchema);
