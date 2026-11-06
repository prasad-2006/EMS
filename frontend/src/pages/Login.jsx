import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { register } from '../services/authService';
import toast from 'react-hot-toast';

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    mfaCode: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (user.role === 'hr') {
        navigate('/hr/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const validateForm = () => {
    const newErrors = {};
    
    if (isSignUp && !formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 10) {
      newErrors.password = 'Password must be at least 10 characters';
    }
    
    if (isSignUp && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    return newErrors;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setServerError('');
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    
    try {
      if (isSignUp) {
        // As per requirements, sign up is ONLY for admin accounts
        await register(formData.name.trim(), formData.email.toLowerCase().trim(), formData.password, 'admin');
        toast.success('Admin Registration successful! You can now log in.');
        setIsSignUp(false);
        setFormData({ name: '', email: formData.email, password: '', mfaCode: '', confirmPassword: '' });
        setErrors({});
        setServerError('');
      } else {
        const result = await login(formData.email.toLowerCase().trim(), formData.password, formData.mfaCode);
        if (result.mfaRequired) {
          setMfaRequired(true);
          setServerError('');
          return;
        }
        if (result.success) {
          const role = result.user.role;
          if (role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
          } else if (role === 'hr') {
            navigate('/hr/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        } else {
          setServerError(result.error || 'Invalid email or password');
        }
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error 
        || error.response?.data?.errors?.[0]?.message
        || error.message 
        || (isSignUp ? 'Registration failed' : 'Login failed');
      setServerError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setErrors({});
    setServerError('');
    setFormData({ name: '', email: '', password: '', mfaCode: '', confirmPassword: '' });
    setMfaRequired(false);
  };

  return (
    <div className="min-h-screen app-shell-bg relative overflow-hidden">
      <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl" />

      <div className="min-h-screen w-full grid lg:grid-cols-2 relative z-10">
        <section className="hidden lg:flex px-14 py-12 flex-col justify-between">
          <div className="inline-flex items-center gap-3 text-slate-800">
            <span className="h-11 w-11 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-teal-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Vacation Tracking</p>
              <p className="text-xl font-bold">Employee Workspace</p>
            </div>
          </div>

          <div>
            <h2 className="text-5xl font-bold text-slate-900 leading-tight">Leave management that feels effortless.</h2>
            <p className="mt-4 max-w-xl text-slate-600 text-lg">
              Apply faster, monitor approvals in real time, and keep your team planning smooth with one focused interface.
            </p>
            <div className="mt-8 space-y-3 max-w-lg">
              {['Fast leave filing workflow', 'Live status + notifications', 'Auto-synced leave balances'].map((item) => (
                <div key={item} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-700">
                  <span className="h-6 w-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span className="font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-sm text-slate-500">© 2026 Vacation Tracking System</p>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md animate-fade-in-up">
            <div className="lg:hidden text-center mb-6">
              <h1 className="text-2xl font-bold text-slate-900">Vacation Tracking System</h1>
              <p className="text-sm text-slate-600 mt-1">Employee Portal</p>
            </div>

            <div className="glass-card rounded-2xl p-7 sm:p-8">
              <div className="text-center mb-7">
                <h2 className="text-2xl font-bold text-slate-900">{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="mt-2 text-slate-600">{isSignUp ? 'Sign up to get started' : 'Sign in to continue'}</p>
              </div>

              {serverError && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {isSignUp && (
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="John Doe"
                      className={`w-full px-4 py-3 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 ${
                        errors.name ? 'border-rose-300' : 'border-slate-300'
                      }`}
                    />
                    {errors.name && <p className="mt-1 text-sm text-rose-600">{errors.name}</p>}
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={`w-full px-4 py-3 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 ${
                      errors.email ? 'border-rose-300' : 'border-slate-300'
                    }`}
                  />
                  {errors.email && <p className="mt-1 text-sm text-rose-600">{errors.email}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="Enter your password"
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      className={`w-full px-4 py-3 pr-12 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 ${
                        errors.password ? 'border-rose-300' : 'border-slate-300'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-rose-600">{errors.password}</p>}
                </div>

                {mfaRequired && !isSignUp && (
                  <div>
                    <label htmlFor="mfaCode" className="block text-sm font-medium text-slate-700 mb-1">MFA verification code</label>
                    <input
                      id="mfaCode"
                      name="mfaCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={formData.mfaCode}
                      onChange={handleChange}
                      disabled={loading}
                      placeholder="6-digit code"
                      className="w-full px-4 py-3 border rounded-xl bg-white text-slate-900"
                    />
                  </div>
                )}

                {!isSignUp && (
                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-sm font-semibold text-teal-700 hover:text-teal-600">
                      Forgot password?
                    </Link>
                  </div>
                )}

                {isSignUp && (
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="Confirm your password"
                        autoComplete="new-password"
                        className={`w-full px-4 py-3 pr-12 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 ${
                          errors.confirmPassword ? 'border-rose-300' : 'border-slate-300'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && <p className="mt-1 text-sm text-rose-600">{errors.confirmPassword}</p>}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-300 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-teal-300"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      {isSignUp ? 'Creating Account...' : 'Signing In...'}
                    </span>
                  ) : (
                    isSignUp ? 'Create Account' : 'Sign In'
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-sm">
                <p className="text-slate-600">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  <button
                    type="button"
                    onClick={toggleMode}
                    disabled={loading}
                    className="ml-1 font-semibold text-teal-700 hover:text-teal-600 disabled:opacity-50"
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;
