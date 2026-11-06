import api from './api';

export const getSessions = () => api.get('/account-security/sessions');
export const revokeSession = (sessionId) => api.delete(`/account-security/sessions/${sessionId}`);
export const revokeOtherSessions = () => api.post('/account-security/sessions/revoke-others');
export const revokeAllSessions = () => api.post('/account-security/sessions/revoke-all');
export const setupMfa = () => api.post('/account-security/mfa/setup');
export const verifyMfa = (code) => api.post('/account-security/mfa/verify', { code });
export const disableMfa = (currentPassword, code) => api.post('/account-security/mfa/disable', { currentPassword, code });
