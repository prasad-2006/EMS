import api from './api';

export const getNotificationPreferences = () => api.get('/user-preferences/notifications');
export const updateNotificationPreferences = (data) => api.put('/user-preferences/notifications', data);
export const getAppearancePreferences = () => api.get('/user-preferences/appearance');
export const updateAppearancePreferences = (data) => api.put('/user-preferences/appearance', data);
