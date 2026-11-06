import api from './api';

// Get all policies
export const getAllPolicies = async (params = {}) => {
  return await api.get('/policies', { params });
};

// Get default policy
export const getDefaultPolicy = async () => {
  return await api.get('/policies/default');
};

// Get policy by ID
export const getPolicyById = async (id) => {
  return await api.get(`/policies/${id}`);
};

// Validate leave request
export const validateLeaveRequest = async (requestData) => {
  return await api.post('/policies/validate', requestData);
};

// Create policy
export const createPolicy = async (policyData) => {
  return await api.post('/policies', policyData);
};

// Update policy
export const updatePolicy = async (id, policyData) => {
  return await api.patch(`/policies/${id}`, policyData);
};

// Delete policy
export const deletePolicy = async (id) => {
  return await api.delete(`/policies/${id}`);
};
