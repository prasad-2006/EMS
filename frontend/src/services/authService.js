import api from './api';

export const login = async (email, password, mfaCode = '') => {
  return await api.post('/auth/login', { email, password, mfaCode });
};

export const getAdminSignupStatus = async () => {
  return await api.get('/auth/admin-signup-status');
};

export const getCurrentUser = async (customToken = null) => {
  const config = customToken ? { customToken } : {};
  return await api.get('/users/me', config);
};

export const register = async (name, email, password, role = 'employee') => {
  return await api.post('/auth/register', { name, email, password, role });
};

export const requestPasswordReset = async (email) => {
  return await api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token, password) => {
  return await api.post(`/auth/reset-password/${token}`, { password });
};
