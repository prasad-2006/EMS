import api from './api';

const TASKS_API = '/tasks';

const taskService = {
  // Get all tasks with pagination (drill-able filter stack via params)
  getAllTasks: (params = {}) => {
    return api.get(TASKS_API, { params });
  },

  // KPI metrics for the current drill-down stack
  getTasksKpi: (params = {}) => {
    return api.get(`${TASKS_API}/kpi`, { params });
  },

  // Smart redistribution preview (candidate peers + lowest workload suggestion)
  previewRedistribution: (params = {}) => {
    return api.get(`${TASKS_API}/redistribute/preview`, { params });
  },

  // Smart redistribute — commit reassignment to the lowest-workload peer
  smartRedistribute: (payload) => {
    return api.post(`${TASKS_API}/redistribute/smart`, payload);
  },

  // Weekly workload heatmap (Mon-Sun) for one employee
  getWorkloadHeatmap: (userId) => {
    return api.get(`${TASKS_API}/workload/heatmap/${userId}`);
  },

  // Employee deep-dive: assigned tasks + parallel leave calendar
  getEmployeeDeepDive: (userId, params = {}) => {
    return api.get(`${TASKS_API}/employee/${userId}/deepdive`, { params });
  },

  // Get single task by ID
  getTaskById: (taskId) => {
    return api.get(`${TASKS_API}/${taskId}`);
  },

  // Create a single task
  createTask: (taskData) => {
    return api.post(TASKS_API, taskData);
  },

  // Bulk import tasks from Excel
  bulkImportTasks: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`${TASKS_API}/bulk/import`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      // Bulk import can take longer for large day-wise sheets.
      timeout: 300000
    });
  },

  // Update task
  updateTask: (taskId, taskData) => {
    return api.put(`${TASKS_API}/${taskId}`, taskData);
  },

  // Bulk update tasks
  bulkUpdate: (taskIds, updates) => {
    return api.put(`${TASKS_API}/bulk`, { taskIds, updates });
  },

  // Delete task
  deleteTask: (taskId) => {
    return api.delete(`${TASKS_API}/${taskId}`);
  },

  // Bulk delete tasks
  bulkDelete: (taskIds) => {
    return api.delete(`${TASKS_API}/bulk`, { data: { taskIds } });
  },

  // Delete all tasks (admin only)
  deleteAllTasks: () => {
    return api.delete(TASKS_API);
  },

  // Get users for task assignment
  getUsersForAssignment: (params = {}) => {
    return api.get(`${TASKS_API}/users/list`, { params });
  },

  // Upload attachments to task
  uploadAttachments: (taskId, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('attachments', file);
    });
    return api.post(`${TASKS_API}/${taskId}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  // Evaluate task (approve/reject)
  evaluateTask: (taskId, evaluationData) => {
    return api.post(`${TASKS_API}/${taskId}/evaluate`, evaluationData);
  },

  submitForReview: (taskId, submissionData) => {
    return api.post(`${TASKS_API}/${taskId}/submit-review`, submissionData);
  },

  reviewSubmission: (taskId, reviewData) => {
    return api.post(`${TASKS_API}/${taskId}/review-submission`, reviewData);
  }
};

export default taskService;