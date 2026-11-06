import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { resetPassword } from '../services/authService';

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');

    if (formData.password.length < 10) {
      setServerError('Password must be at least 10 characters');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setServerError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await resetPassword(token, formData.password);
      toast.success(response.message || 'Password reset successfully');
      navigate('/login', { replace: true });
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unable to reset password';
      setServerError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen app-shell-bg relative overflow-hidden flex items-center justify-center px-6 py-10">
      <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-teal-200/40 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-orange-200/40 blur-3xl" />

      <div className="relative z-10 w-full max-w-md glass-card rounded-3xl p-8 sm:p-10">
        <div className="text-center mb-7">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Secure Reset</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Set a New Password</h1>
          <p className="mt-2 text-slate-600">Choose a new password for your account.</p>
        </div>

        {serverError && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">New Password</span>
            <input
              type="password"
              value={formData.password}
              onChange={(event) => setFormData((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Enter a new password"
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 border-slate-300"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</span>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(event) => setFormData((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              placeholder="Confirm the new password"
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 border-slate-300"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-300 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600 space-y-2">
          <p>
            Back to{' '}
            <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-600">Employee Login</Link>
          </p>
          <p>
            Or{' '}
            <Link to="/admin/login" className="font-semibold text-emerald-700 hover:text-emerald-600">Admin Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;