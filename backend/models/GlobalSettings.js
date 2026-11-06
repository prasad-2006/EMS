const mongoose = require('mongoose');

const globalSettingsSchema = new mongoose.Schema({
  leaveTaskDeductionPercentage: {
    type: Number,
    default: 10,
    min: 0,
    max: 100
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

const GlobalSettings = mongoose.model('GlobalSettings', globalSettingsSchema);

module.exports = GlobalSettings;
