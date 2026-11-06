import api from './api';

const HIERARCHY_API = '/hierarchy';

const hierarchyService = {
  // Deeply nested Department + Project tree (scoped by role on the backend).
  getHierarchy: (params = {}) => api.get(HIERARCHY_API, { params })
};

export default hierarchyService;