import api from './api';

const salaryService = {
  getMySalary: (month) => api.get('/salary/me', { params: month ? { month } : {} }),
  getSalaryByUser: (userId, month) => api.get(`/salary/${userId}`, { params: month ? { month } : {} }),
  getAllSalaries: (month) => api.get('/salary/all', { params: month ? { month } : {} }),
  updateSalary: (userId, updates) => api.put(`/salary/${userId}`, updates),
};

export default salaryService;