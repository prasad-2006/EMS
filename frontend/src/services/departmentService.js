import api from './api';

// Get all departments
export const getAllDepartments = async (params = {}) => {
  return await api.get('/departments', { params });
};

// Get department by ID
export const getDepartmentById = async (id) => {
  return await api.get(`/departments/${id}`);
};

// Get department employees
export const getDepartmentEmployees = async (id, params = {}) => {
  return await api.get(`/departments/${id}/employees`, { params });
};

// Create department
export const createDepartment = async (departmentData) => {
  return await api.post('/departments', departmentData);
};

// Update department
export const updateDepartment = async (id, departmentData) => {
  return await api.patch(`/departments/${id}`, departmentData);
};

// Delete department
export const deleteDepartment = async (id) => {
  return await api.delete(`/departments/${id}`);
};
