import api from './api';

// Get team availability
export const getTeamAvailability = async (params) => {
  return await api.get('/analytics/availability/team', { params });
};

// Get department availability
export const getDepartmentAvailability = async (date = null) => {
  const paramObj = date ? { date } : {};
  return await api.get('/analytics/availability/department', { params: paramObj });
};

// Get leave analytics
export const getLeaveAnalytics = async (params = {}) => {
  return await api.get('/analytics/leave/analytics', { params });
};

// Get leave trends
export const getLeaveTrends = async (year = new Date().getFullYear()) => {
  return await api.get('/analytics/leave/trends', { params: { year } });
};

// Get leave conflicts
export const getLeaveConflicts = async (params = {}) => {
  return await api.get('/analytics/leave/conflicts', { params });
};

// Advanced workforce analytics
export const getAdvancedWorkforceAnalytics = async (params = {}) => {
  return await api.get('/analytics/advanced/workforce', { params });
};

// Predictive leave patterns
export const getLeavePatternPredictions = async () => {
  return await api.get('/analytics/advanced/patterns');
};

// Department coverage risk assessment
export const getCoverageRisks = async (days = 30) => {
  return await api.get('/analytics/advanced/coverage-risks', { params: { days } });
};

// Executive summary for HR/Admin
export const getExecutiveSummary = async () => {
  return await api.get('/analytics/advanced/executive-summary');
};

// Handover risk analysis for a leave request
export const getHandoverRiskAnalysis = async (leaveId) => {
  return await api.get(`/analytics/handover/risks/${leaveId}`);
};

// Smart backup recommendations
export const getBackupSuggestions = async () => {
  return await api.get('/analytics/handover/backup-suggestions');
};

// Advanced leave filtering
export const filterLeavesAdvanced = async (params = {}) => {
  return await api.get('/analytics/filter/leaves', { params });
};

// Advanced task filtering
export const filterTasksAdvanced = async (params = {}) => {
  return await api.get('/analytics/filter/tasks', { params });
};

// Global search across leaves/tasks/users
export const globalAnalyticsSearch = async (q, types = ['leaves', 'tasks', 'users']) => {
  return await api.get('/analytics/search', { params: { q, types: types.join(',') } });
};

// Availability finder for manager planning
export const getAvailableEmployees = async (params = {}) => {
  return await api.get('/analytics/available-employees', { params });
};

export default {
  getTeamAvailability,
  getDepartmentAvailability,
  getLeaveAnalytics,
  getLeaveTrends,
  getLeaveConflicts,
  getAdvancedWorkforceAnalytics,
  getLeavePatternPredictions,
  getCoverageRisks,
  getExecutiveSummary,
  getHandoverRiskAnalysis,
  getBackupSuggestions,
  filterLeavesAdvanced,
  filterTasksAdvanced,
  globalAnalyticsSearch,
  getAvailableEmployees
};
