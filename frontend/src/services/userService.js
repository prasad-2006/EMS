import api from './api';

export const getAllUsers = async ({ status = '', page = 1, limit = 20 } = {}) => {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  params.set('page', page);
  params.set('limit', limit);

  return await api.get(`/users/all?${params.toString()}`);
};

export const approveUser = async (userId) => {
  return await api.put(`/users/${userId}/approve`);
};

export const rejectUser = async (userId) => {
  return await api.put(`/users/${userId}/reject`);
};

export const updateUser = async (userId, updates) => {
  return await api.put(`/users/${userId}`, updates);
};

export const updateMyProfile = async (updates) => {
  return await api.put('/users/me', updates);
};

export const getActionHistory = async (limit = 50) => {
  return await api.get(`/users/history?limit=${limit}`);
};

export const getUserById = async (userId) => {
  return await api.get(`/users/${userId}`);
};

export const undoAction = async (historyId) => {
  return await api.put(`/users/history/${historyId}/undo`);
};

export const deleteUser = async (userId) => {
  return await api.delete(`/users/${userId}`);
};

export const importUsers = async (file, role) => {
  const formData = new FormData();
  formData.append('file', file);
  if (role) formData.append('role', role);

  return await api.post('/users/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 120000
  });
};
