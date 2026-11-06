import api from './api';

// Get flagged tasks for a leave request
export const getFlaggedTasks = async (leaveId) => {
  return await api.get(`/handover/check/${leaveId}`);
};

// Assign a task to a colleague
export const assignTask = async (taskId, assignedToUserId, handoverNote) => {
  return await api.post('/handover/assign', {
    taskId,
    assignedToUserId,
    handoverNote
  });
};

// Defer a task to after return
export const deferTask = async (taskId, deferredUntil) => {
  return await api.post(`/handover/defer/${taskId}`, {
    deferredUntil
  });
};

// Accept a handed-over task
export const acceptTask = async (taskId) => {
  return await api.patch(`/handover/accept/${taskId}`);
};

// Reject a handed-over task
export const rejectTask = async (taskId, reason) => {
  return await api.patch(`/handover/reject/${taskId}`, { reason });
};

// Get tasks currently covering for on-leave colleagues
export const getCoveringTasks = async () => {
  return await api.get('/handover/covering');
};

// Complete handover
export const completeHandover = async (taskId) => {
  return await api.patch(`/handover/complete/${taskId}`);
};

// Return to work - pull tasks back
export const returnToWork = async (leaveId) => {
  return await api.post(`/handover/return/${leaveId}`);
};

// Get return-to-work summary
export const getReturnSummary = async (leaveId) => {
  return await api.get(`/handover/return-summary/${leaveId}`);
};

// Get my tasks
export const getMyTasks = async (params) => {
  return await api.get('/handover/my-tasks', { params });
};

// Create a new task
export const createTask = async (taskData) => {
  return await api.post('/handover/tasks', taskData);
};

// Update a task
export const updateTask = async (taskId, taskData) => {
  return await api.put(`/handover/tasks/${taskId}`, taskData);
};

// Get team workload for manager
export const getTeamWorkload = async (params) => {
  return await api.get('/handover/team-workload', { params });
};

export default {
  getFlaggedTasks,
  assignTask,
  deferTask,
  acceptTask,
  rejectTask,
  getCoveringTasks,
  completeHandover,
  returnToWork,
  getReturnSummary,
  getMyTasks,
  createTask,
  updateTask,
  getTeamWorkload
};