import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { login as apiLogin, getCurrentUser } from '../services/authService';
import { TOKEN_KEY } from '../utils/constants';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    toast.success('Logged out successfully');
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (storedToken) {
        const response = await getCurrentUser(storedToken);
        const userData = response.user || response;
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
      // Don't auto-logout on simple network errors, only on 401s which are handled by interceptor
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      if (token) {
        await loadUser();
      }
      setLoading(false);
    };
    initAuth();
  }, [token, loadUser]);

  const login = async (email, password, mfaCode = '') => {
    try {
      const response = await apiLogin(email, password, mfaCode);
      if (response.mfaRequired) {
        return response;
      }
      const { token: authToken, user: authUser } = response;
      
      localStorage.setItem(TOKEN_KEY, authToken);
      setToken(authToken);
      setUser(authUser);
      
      toast.success(`Welcome back, ${authUser.name}!`);
      return { success: true, user: authUser };
    } catch (error) {
      const errorMsg = error.response?.data?.error || error.message || 'Login failed. Please try again.';
      toast.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  };

  const refreshSessionUser = useCallback(async () => {
    await loadUser();
  }, [loadUser]);

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshSessionUser,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isHR: user?.role === 'hr',
    isEmployee: user?.role === 'employee' || user?.role === 'manager'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
