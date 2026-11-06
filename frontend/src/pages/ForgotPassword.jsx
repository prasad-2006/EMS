import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { requestPasswordReset } from '../services/authService';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setServerError('');
    setResetUrl('');

    try {
      const response = await requestPasswordReset(email.trim().toLowerCase());
      toast.success(response.message || 'If the account exists, a reset link has been sent.');
      if (response.resetUrl) {
        setResetUrl(response.resetUrl);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message || 'Unable to request password reset';
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
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Account Recovery</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Forgot Password</h1>
          <p className="mt-2 text-slate-600">Enter your email and we’ll send a reset link.</p>
        </div>

        {serverError && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
            {serverError}
          </div>
        )}

        {resetUrl && (
          <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm break-all">
            <p className="font-semibold mb-1">Development reset link</p>
            <a href={resetUrl} className="underline">{resetUrl}</a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              className="w-full px-4 py-3 border rounded-xl bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-300 border-slate-300"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 disabled:bg-teal-300 text-white font-semibold rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600 space-y-2">
          <p>
            Remembered it?{' '}
            <Link to="/login" className="font-semibold text-teal-700 hover:text-teal-600">Employee Login</Link>
          </p>
          <p>
            Admin?{' '}
            <Link to="/admin/login" className="font-semibold text-emerald-700 hover:text-emerald-600">Admin Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;