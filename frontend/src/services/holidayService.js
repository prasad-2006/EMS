import api from './api';

// Get all holidays
export const getAllHolidays = async (params = {}) => {
  return await api.get('/holidays', { params });
};

// Get upcoming holidays
export const getUpcomingHolidays = async (limit = 10) => {
  return await api.get('/holidays/upcoming', { params: { limit } });
};

// Check if date is holiday
export const checkHoliday = async (date, departmentId = null) => {
  const params = { date };
  if (departmentId) params.departmentId = departmentId;
  return await api.get('/holidays/check', { params });
};

// Get holiday by ID
export const getHolidayById = async (id) => {
  return await api.get(`/holidays/${id}`);
};

// Create holiday
export const createHoliday = async (holidayData) => {
  return await api.post('/holidays', holidayData);
};

// Update holiday
export const updateHoliday = async (id, holidayData) => {
  return await api.patch(`/holidays/${id}`, holidayData);
};

// Delete holiday
export const deleteHoliday = async (id) => {
  return await api.delete(`/holidays/${id}`);
};
