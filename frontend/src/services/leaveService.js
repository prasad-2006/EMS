import api from './api';

export const createLeaveRequest = async (leaveData) => {
  return await api.post('/leave', leaveData);
};

export const precheckLeaveRequest = async (leaveData) => {
  return await api.post('/leave/precheck', leaveData);
};

export const getMyLeaves = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const url = queryParams ? `/leave/my?${queryParams}` : '/leave/my';
  return await api.get(url);
};

export const getAllLeaves = async (filters = {}) => {
  const queryParams = new URLSearchParams(filters).toString();
  const url = queryParams ? `/leave/all?${queryParams}` : '/leave/all';
  return await api.get(url);
};

export const updateLeaveStatus = async (leaveId, status, adminComment = '') => {
  return await api.put(`/leave/${leaveId}`, { status, adminComment });
};

export const cancelLeaveRequest = async (leaveId, reason = '') => {
  return await api.patch(`/leave/${leaveId}/cancel`, { reason });
};

export const respondToCoverage = async (notificationId, accept) => {
  return await api.post('/leave/coverage/respond', { notificationId, accept });
};
