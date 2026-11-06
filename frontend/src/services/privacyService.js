import api from './api';

export const getPrivacySummary = () => api.get('/privacy/summary');
export const getPrivacyRequests = () => api.get('/privacy/requests');
export const requestDataExport = () => api.post('/privacy/export');
export const requestAccountAction = (type) => api.post('/privacy/account-action', { type });
