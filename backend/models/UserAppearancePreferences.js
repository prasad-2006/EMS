const mongoose = require('mongoose');

const userAppearancePreferencesSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  theme: { type: String, enum: ['system', 'light', 'dark', 'high-contrast'], default: 'system' },
  fontScale: { type: String, enum: ['compact', 'normal', 'large'], default: 'normal' },
  reducedMotion: { type: Boolean, default: false },
  timezone: { type: String, default: 'Asia/Kolkata', trim: true },
  locale: { type: String, default: 'en-IN', trim: true },
  dateFormat: { type: String, enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'], default: 'DD/MM/YYYY' },
  weekStartsOn: { type: Number, enum: [0, 1], default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('UserAppearancePreferences', userAppearancePreferencesSchema);
