import api from './api';

const PROJECTS_API = '/projects';
const PLANNING_API = '/planning';

const projectService = {
  getProjects: (params = {}) => api.get(PROJECTS_API, { params }),
  getProjectById: (projectId) => api.get(`${PROJECTS_API}/${projectId}`),
  getAuditEvents: (projectId) => api.get(`${PROJECTS_API}/${projectId}/audit-events`),
  getWorkItems: (projectId) => api.get(`${PLANNING_API}/projects/${projectId}/work-items`),
  createWorkItem: (projectId, data) => api.post(`${PLANNING_API}/projects/${projectId}/work-items`, data),
  updateWorkItem: (workItemId, data) => api.put(`${PLANNING_API}/work-items/${workItemId}`, data),
  bulkUpdateWorkItems: (data) => api.put(`${PLANNING_API}/work-items/bulk`, data),
  getMilestones: (projectId) => api.get(`${PLANNING_API}/projects/${projectId}/milestones`),
  createMilestone: (projectId, data) => api.post(`${PLANNING_API}/projects/${projectId}/milestones`, data),
  updateMilestone: (milestoneId, data) => api.put(`${PLANNING_API}/milestones/${milestoneId}`, data),
  getProjectMembers: (projectId) => api.get(`${PLANNING_API}/projects/${projectId}/members`),
  assignProjectMember: (projectId, data) => api.post(`${PLANNING_API}/projects/${projectId}/members`, data),
  getProjectCapacity: (projectId) => api.get(`${PLANNING_API}/projects/${projectId}/capacity`),
  getCriticalPath: (projectId) => api.get(`${PLANNING_API}/projects/${projectId}/critical-path`),
  getConversations: (projectId) => api.get(`/collaboration/projects/${projectId}/conversations`),
  createConversation: (projectId, data) => api.post(`/collaboration/projects/${projectId}/conversations`, data),
  getComments: (conversationId) => api.get(`/collaboration/conversations/${conversationId}/comments`),
  createComment: (conversationId, data) => api.post(`/collaboration/conversations/${conversationId}/comments`, data),
  updateComment: (commentId, data) => api.patch(`/collaboration/comments/${commentId}`, data),
  getDecisions: (projectId) => api.get(`/collaboration/projects/${projectId}/decisions`),
  createDecision: (projectId, data) => api.post(`/collaboration/projects/${projectId}/decisions`, data),
  updateDecision: (decisionId, data) => api.patch(`/collaboration/decisions/${decisionId}`, data),
  getSubmissions: (projectId) => api.get(`/reviews/projects/${projectId}/submissions`),
  getReviews: (projectId) => api.get(`/reviews/projects/${projectId}/reviews`),
  getApprovalGates: (projectId) => api.get(`/reviews/projects/${projectId}/gates`),
  createApprovalGate: (projectId, data) => api.post(`/reviews/projects/${projectId}/gates`, data),
  updateApprovalGate: (gateId, data) => api.patch(`/reviews/gates/${gateId}`, data),
  getWeeklyCapacity: (projectId, weekStart) => api.get(`/people/projects/${projectId}/weekly-capacity`, { params: weekStart ? { weekStart } : {} }),
  getResourceRequests: (projectId) => api.get('/people/resource-requests', { params: { projectId } }),
  getSkills: (params = {}) => api.get('/people/skills', { params }),
  createResourceRequest: (projectId, data) => api.post(`/people/projects/${projectId}/resource-requests`, data),
  updateResourceRequest: (requestId, data) => api.patch(`/people/resource-requests/${requestId}`, data),
  getProjectFeedback: (projectId) => api.get(`/people/projects/${projectId}/feedback`),
  createProjectFeedback: (projectId, data) => api.post(`/people/projects/${projectId}/feedback`, data),
  getRisks: (projectId) => api.get(`/governance/projects/${projectId}/risks`),
  createRisk: (projectId, data) => api.post(`/governance/projects/${projectId}/risks`, data),
  updateRisk: (riskId, data) => api.patch(`/governance/risks/${riskId}`, data),
  getIssues: (projectId) => api.get(`/governance/projects/${projectId}/issues`),
  createIssue: (projectId, data) => api.post(`/governance/projects/${projectId}/issues`, data),
  updateIssue: (issueId, data) => api.patch(`/governance/issues/${issueId}`, data),
  getChangeRequests: (projectId) => api.get(`/governance/projects/${projectId}/change-requests`),
  createChangeRequest: (projectId, data) => api.post(`/governance/projects/${projectId}/change-requests`, data),
  updateChangeRequest: (requestId, data) => api.patch(`/governance/change-requests/${requestId}`, data),
  getPortfolioSummary: () => api.get('/governance/portfolio'),
  getReviewTemplates: (params = {}) => api.get('/reviews/templates', { params }),
  getApprovalQueue: () => api.get('/reviews/approval-queue'),
  createProject: (projectData) => api.post(PROJECTS_API, projectData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  updateProject: (projectId, updates) => api.put(`${PROJECTS_API}/${projectId}`, updates),
  deleteProject: (projectId) => api.delete(`${PROJECTS_API}/${projectId}`),
  bulkDeleteProjects: (projectIds) => api.delete(`${PROJECTS_API}/bulk`, { data: { projectIds } }),
  assignToHr: (projectId, payload) => api.post(`${PROJECTS_API}/${projectId}/assign-hr`, payload),
  assignToManager: (projectId, payload) => api.post(`${PROJECTS_API}/${projectId}/assign-manager`, payload),
  startExecution: (projectId, payload = {}) => api.post(`${PROJECTS_API}/${projectId}/start-execution`, payload),
  submitManagerReview: (projectId, payload = {}) => api.post(`${PROJECTS_API}/${projectId}/submit-manager-review`, payload),
  requestChanges: (projectId, payload) => api.post(`${PROJECTS_API}/${projectId}/request-changes`, payload),
  forwardToHr: (projectId, payload = {}) => api.post(`${PROJECTS_API}/${projectId}/forward-to-hr`, payload),
  forwardToCeo: (projectId, payload = {}) => api.post(`${PROJECTS_API}/${projectId}/forward-to-ceo`, payload),
  decide: (projectId, payload) => api.post(`${PROJECTS_API}/${projectId}/decision`, payload),
  uploadDocument: (projectId, file, note = '') => {
    const formData = new FormData();
    formData.append('document', file);
    if (note) formData.append('note', note);
    return api.post(`${PROJECTS_API}/${projectId}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

export default projectService;
