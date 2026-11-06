const mongoose = require('mongoose');

const userNotificationPreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  channels: {
    inApp: { type: Boolean, default: true },
    email: { type: Boolean, default: true },
    push: { type: Boolean, default: false },
    sms: { type: Boolean, default: false }
  },
  categories: {
    leave: { type: Boolean, default: true },
    approvals: { type: Boolean, default: true },
    tasks: { type: Boolean, default: true },
    projects: { type: Boolean, default: true },
    policy: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true }
  },
  securityAlerts: { type: Boolean, default: true, immutable: true }
}, { timestamps: true });

module.exports = mongoose.model('UserNotificationPreferences', userNotificationPreferencesSchema);
