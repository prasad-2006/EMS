const Notification = require('../models/Notification');
const Task = require('../models/Task');

const extractTaskIdFromActionUrl = (actionUrl = '') => {
  const match = String(actionUrl).match(/^\/(?:employee\/)?tasks\/([a-fA-F0-9]{24})$/);
  return match ? match[1] : null;
};

const cleanupStaleTaskNotifications = async (userId) => {
  const candidates = await Notification.find({
    userId,
    type: 'reminder',
    title: { $in: ['New Task Assigned', 'Task Reassigned'] },
    actionUrl: { $regex: '^/(?:employee/)?tasks/[a-fA-F0-9]{24}$' }
  })
    .select('_id actionUrl')
    .limit(1000);

  if (candidates.length === 0) return;

  const taskIdSet = new Set();
  const notificationTaskPairs = [];

  candidates.forEach((notification) => {
    const taskId = extractTaskIdFromActionUrl(notification.actionUrl);
    if (!taskId) return;
    taskIdSet.add(taskId);
    notificationTaskPairs.push({ notificationId: notification._id, taskId });
  });

  if (taskIdSet.size === 0) return;

  const existingTasks = await Task.find({
    _id: { $in: Array.from(taskIdSet) },
    assignedTo: userId
  }).select('_id');

  const existingTaskIds = new Set(existingTasks.map((task) => String(task._id)));
  const staleNotificationIds = notificationTaskPairs
    .filter((item) => !existingTaskIds.has(item.taskId))
    .map((item) => item.notificationId);

  if (staleNotificationIds.length > 0) {
    await Notification.deleteMany({ _id: { $in: staleNotificationIds } });
  }
};

// @desc    Get current user's notifications
// @route   GET /api/notifications
// @access  Private
const getMyNotifications = async (req, res) => {
  try {
    await cleanupStaleTaskNotifications(req.user.id);

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const query = { userId: req.user.id };
    if (req.query.unread === 'true') {
      query.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query)
    ]);

    const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });

    return res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
};

// @desc    Mark one notification as read
// @route   PATCH /api/notifications/:id/read
// @access  Private
const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true, readAt: new Date(), 'deliveryStatus.status': 'read' },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
};

// @desc    Mark all notifications as read
// @route   PATCH /api/notifications/read-all
// @access  Private
const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true, readAt: new Date(), 'deliveryStatus.status': 'read' });
    return res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
};

module.exports = {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead
};