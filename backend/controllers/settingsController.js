const GlobalSettings = require('../models/GlobalSettings');

// @desc    Get global settings
// @route   GET /api/settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    let settings = await GlobalSettings.findOne();
    if (!settings) {
      settings = await GlobalSettings.create({
        leaveTaskDeductionPercentage: 10
      });
    }
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Update global settings
// @route   PUT /api/settings
// @access  Private (admin/ceo)
const updateSettings = async (req, res) => {
  try {
    const { leaveTaskDeductionPercentage } = req.body;
    let settings = await GlobalSettings.findOne();
    if (!settings) {
      settings = await GlobalSettings.create({
        leaveTaskDeductionPercentage: leaveTaskDeductionPercentage || 10,
        updatedBy: req.user._id
      });
    } else {
      if (leaveTaskDeductionPercentage !== undefined) {
        settings.leaveTaskDeductionPercentage = leaveTaskDeductionPercentage;
      }
      settings.updatedBy = req.user._id;
      await settings.save();
    }
    res.status(200).json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  getSettings,
  updateSettings
};
