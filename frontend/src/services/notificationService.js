import api from './api';

export const getMyNotifications = async ({ page = 1, limit = 10, unread = false } = {}) => {
  const params = new URLSearchParams();
  params.set('page', page);
  params.set('limit', limit);
  if (unread) params.set('unread', 'true');

  return await api.get(`/notifications?${params.toString()}`);
};

export const markNotificationRead = async (notificationId) => {
  return await api.patch(`/notifications/${notificationId}/read`);
};

export const markAllNotificationsRead = async () => {
  return await api.patch('/notifications/read-all');
};