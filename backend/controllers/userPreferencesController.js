const UserNotificationPreferences = require('../models/UserNotificationPreferences');
const UserAppearancePreferences = require('../models/UserAppearancePreferences');

const getOrCreate = async (Model, userId) => Model.findOneAndUpdate(
  { userId },
  { $setOnInsert: { userId } },
  { new: true, upsert: true, setDefaultsOnInsert: true }
);

const getNotificationPreferences = async (req, res) => {
  const preferences = await getOrCreate(UserNotificationPreferences, req.user._id);
  res.json({ success: true, data: preferences });
};

const updateNotificationPreferences = async (req, res) => {
  const allowed = ['channels', 'categories'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] && typeof req.body[field] === 'object') updates[field] = req.body[field];
  });
  const preferences = await UserNotificationPreferences.findOneAndUpdate(
    { userId: req.user._id },
    { $set: updates, $setOnInsert: { userId: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, data: preferences });
};

const getAppearancePreferences = async (req, res) => {
  const preferences = await getOrCreate(UserAppearancePreferences, req.user._id);
  res.json({ success: true, data: preferences });
};

const updateAppearancePreferences = async (req, res) => {
  const allowed = ['theme', 'fontScale', 'reducedMotion', 'timezone', 'locale', 'dateFormat', 'weekStartsOn'];
  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });
  const preferences = await UserAppearancePreferences.findOneAndUpdate(
    { userId: req.user._id },
    { $set: updates, $setOnInsert: { userId: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json({ success: true, data: preferences });
};

module.exports = {
  getNotificationPreferences,
  updateNotificationPreferences,
  getAppearancePreferences,
  updateAppearancePreferences
};
