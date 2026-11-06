import React, { useState, useEffect } from 'react';
import { getAllLeaves } from '../services/leaveService';
import { getDefaultPolicy, updatePolicy } from '../services/policyService';
import { Link } from 'react-router-dom';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Inline SVG Icons
const CalendarIcon = () => (
  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const UsersIcon = () => (
  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const AdminDashboard = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    uniqueUsers: 0
  });
  const [defaultPolicy, setDefaultPolicy] = useState(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    weekendCountsAsLeave: false,
    holidayCountsAsLeave: false,
    coverageWarningPercentage: 30,
    coverageBlockPercentage: 50
  });
  const [autoApprovalRules, setAutoApprovalRules] = useState({
    enabled: false,
    maxDays: 3,
    leaveTypes: ['casual'],
    excludeDepartments: []
  });
  const [autoApprovalSaving, setAutoApprovalSaving] = useState(false);

  useEffect(() => {
    fetchLeaves();
    fetchDefaultPolicy();
  }, []);

  const fetchDefaultPolicy = async () => {
    try {
      const response = await getDefaultPolicy();
      const policy = response.data;
      setDefaultPolicy(policy);
      setPolicyForm({
        weekendCountsAsLeave: Boolean(policy?.rules?.weekendCountsAsLeave),
        holidayCountsAsLeave: Boolean(policy?.rules?.holidayCountsAsLeave),
        coverageWarningPercentage: Number(policy?.rules?.coverageWarningPercentage || 30),
        coverageBlockPercentage: Number(policy?.rules?.coverageBlockPercentage || 50)
      });
    } catch (err) {
      console.error('Failed to load default policy:', err);
    }
  };

  const handlePolicySave = async () => {
    if (!defaultPolicy?._id) {
      toast.error('No active policy found to update');
      return;
    }

    if (Number(policyForm.coverageBlockPercentage) < Number(policyForm.coverageWarningPercentage)) {
      toast.error('Block threshold must be greater than or equal to warning threshold');
      return;
    }

    try {
      setPolicySaving(true);
      await updatePolicy(defaultPolicy._id, {
        rules: {
          ...defaultPolicy.rules,
          weekendCountsAsLeave: policyForm.weekendCountsAsLeave,
          holidayCountsAsLeave: policyForm.holidayCountsAsLeave,
          coverageWarningPercentage: Number(policyForm.coverageWarningPercentage),
          coverageBlockPercentage: Number(policyForm.coverageBlockPercentage)
        }
      });
      toast.success('Policy settings updated');
      fetchDefaultPolicy();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update policy settings');
    } finally {
      setPolicySaving(false);
    }
  };

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await getAllLeaves({ page: 1, limit: 100 });
      const data = response.data;
      setLeaves(data);
      
      // Calculate stats
      const pending = data.filter(l => l.status === 'pending').length;
      const approved = data.filter(l => l.status === 'approved').length;
      const rejected = data.filter(l => l.status === 'rejected').length;
      const cancelled = data.filter(l => l.status === 'cancelled').length;
      const uniqueUsers = new Set(data.map(l => l.userId?._id)).size;
      
      setStats({
        total: data.length,
        pending,
        approved,
        rejected,
        cancelled,
        uniqueUsers
      });
      
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const recentRequests = leaves.slice(0, 5);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchLeaves} />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Overview of all leave requests in the system</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-full">
              <CalendarIcon />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Total Requests</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <UsersIcon />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Active Users</p>
              <p className="text-2xl font-semibold">{stats.uniqueUsers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-3 bg-yellow-100 rounded-full">
              <ClockIcon />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-semibold">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircleIcon />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-2xl font-semibold">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <div className="p-3 bg-red-100 rounded-full">
              <XCircleIcon />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">Rejected</p>
              <p className="text-2xl font-semibold">{stats.rejected}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex space-x-4 flex-wrap gap-4">
          <Link
            to="/admin/requests"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Manage All Requests
          </Link>
          <Link
            to="/admin/requests?status=pending"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Pending Requests
          </Link>
          <Link
            to="/admin/bulk-tasks"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Assign Tasks (Bulk)
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Coverage And Day Count Controls</h2>
          <button
            onClick={handlePolicySave}
            disabled={policySaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {policySaving ? 'Saving...' : 'Save Policy Controls'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={policyForm.weekendCountsAsLeave}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, weekendCountsAsLeave: e.target.checked }))}
            />
            Count weekends as leave days
          </label>

          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={policyForm.holidayCountsAsLeave}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, holidayCountsAsLeave: e.target.checked }))}
            />
            Count holidays as leave days
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coverage warning threshold (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={policyForm.coverageWarningPercentage}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, coverageWarningPercentage: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coverage block threshold (%)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={policyForm.coverageBlockPercentage}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, coverageBlockPercentage: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Auto-Approval Rules Configuration */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Auto-Approval Rules</h2>
          <button
            onClick={() => setAutoApprovalSaving(!autoApprovalSaving)}
            disabled={autoApprovalSaving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {autoApprovalSaving ? 'Saving...' : 'Save Rules'}
          </button>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 mb-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={autoApprovalRules.enabled}
              onChange={(e) =>
                setAutoApprovalRules((prev) => ({
                  ...prev,
                  enabled: e.target.checked
                }))
              }
              className="w-4 h-4 rounded"
            />
            <span className="text-sm font-medium text-gray-900">Enable automatic approval for eligible requests</span>
          </label>
          <p className="text-xs text-gray-500 mt-2">
            When enabled, leave requests matching these criteria will be auto-approved without manual review.
          </p>
        </div>

        {autoApprovalRules.enabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Max days for auto-approval</label>
              <input
                type="number"
                min="1"
                max="30"
                value={autoApprovalRules.maxDays}
                onChange={(e) =>
                  setAutoApprovalRules((prev) => ({
                    ...prev,
                    maxDays: parseInt(e.target.value) || 1
                  }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Leave types eligible for auto-approval</label>
              <div className="space-y-2">
                {['casual', 'earned', 'sick', 'wfh', 'emergency'].map((type) => (
                  <label key={type} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoApprovalRules.leaveTypes.includes(type)}
                      onChange={(e) => {
                        setAutoApprovalRules((prev) => ({
                          ...prev,
                          leaveTypes: e.target.checked
                            ? [...prev.leaveTypes, type]
                            : prev.leaveTypes.filter((t) => t !== type)
                        }));
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-700 capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Auto-approval will only execute if coverage remains above the minimum threshold ({policyForm.coverageWarningPercentage}%) and no blocking conditions are met.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Recent Requests */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Leave Requests</h2>
        </div>
        {recentRequests.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {recentRequests.map((leave) => (
              <div key={leave._id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {leave.userId?.name || 'Unknown User'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {leave.leaveType} leave • {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                  leave.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center text-gray-500">
            No leave requests yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
