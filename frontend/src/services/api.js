import axios from 'axios';
import { TOKEN_KEY } from '../utils/constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Helper to get token
const getCurrentToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

// Request interceptor to add token
api.interceptors.request.use(
  (config) => {
    // Use custom token if provided in config, otherwise get based on path
    const token = config.customToken || getCurrentToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // Handle 401 Unauthorized globally
    if (error.response?.status === 401) {
      const tokenSent = error.config?.headers?.Authorization?.split(' ')[1];
      const isAuthCheck = error.config?.url?.includes('/users/me');

      if (tokenSent && tokenSent === localStorage.getItem(TOKEN_KEY)) {
        localStorage.removeItem(TOKEN_KEY);
      }

      // Only force redirect if it wasn't the initial background auth check
      // AuthContext handles background check failures gracefully
      if (!isAuthCheck) {
        const path = window.location.pathname;
        const isAuthPage = path === '/login' || path === '/forgot-password' || path.startsWith('/reset-password');
        
        if (!isAuthPage) {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
