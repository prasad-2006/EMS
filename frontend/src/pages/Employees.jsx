import React, { useState, useEffect } from 'react';
import { getAllUsers, getUserById, approveUser, rejectUser, getActionHistory, undoAction, importUsers, deleteUser } from '../services/userService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';
import EmployeeEditModal from '../components/Users/EmployeeEditModal';
import UserDetailsDrawer from '../components/Users/UserDetailsDrawer';
import { useAuth } from '../context/AuthContext';

const Employees = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('employees');
  const [actionLoading, setActionLoading] = useState(null);
  const [importFiles, setImportFiles] = useState({ hr: null, manager: null, employee: null });
  const [importLoadingRole, setImportLoadingRole] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userDetails, setUserDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const manageableRoles = user?.role === 'admin'
    ? ['employee', 'hr', 'manager']
    : user?.role === 'hr'
      ? ['employee', 'manager']
      : ['employee'];

  useEffect(() => {
    if (activeTab === 'employees') {
      fetchUsers();
    } else {
      fetchHistory();
    }
  }, [filter, activeTab]);

  useEffect(() => {
    setSelectedUserIds([]);
  }, [roleFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const status = filter === 'all' ? '' : filter;
      const response = await getAllUsers({ status, page: 1, limit: 100 });
      setUsers(response.data);
      setSelectedUserIds([]);
      setError(null);
    } catch (err) {
      setError('Failed to load employees');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await getActionHistory(100);
      setHistory(data);
      setError(null);
    } catch (err) {
      setError('Failed to load history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId, userName) => {
    try {
      setActionLoading(userId);
      await approveUser(userId);
      toast.success(`${userName} has been approved!`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to reject ${userName}?`)) {
      return;
    }
    
    try {
      setActionLoading(userId);
      await rejectUser(userId);
      toast.success(`${userName} has been rejected`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUndo = async (historyId, actionType, userName) => {
    try {
      setActionLoading(historyId);
      await undoAction(historyId);
      toast.success(`Undone ${actionType} for ${userName}`);
      fetchHistory();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to undo action');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (userId, userName, userEmail) => {
    const confirmed = window.confirm(
      `Delete ${userName} (${userEmail}) permanently? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setActionLoading(`delete-${userId}`);
      await deleteUser(userId);
      toast.success(`${userName} deleted successfully`);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenDetails = async (managedUser) => {
    try {
      setDetailsLoading(true);
      const response = await getUserById(managedUser.id);
      setUserDetails(response.data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load employee details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const visibleUsers = users.filter((managedUser) => manageableRoles.includes(managedUser.role) && (roleFilter === 'all' || managedUser.role === roleFilter));
  const allVisibleUsersSelected = visibleUsers.length > 0 && visibleUsers.every((user) => selectedUserIds.includes(user.id));

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((currentIds) => (
      currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId]
    ));
  };

  const toggleAllVisibleUsers = () => {
    if (allVisibleUsersSelected) {
      setSelectedUserIds((currentIds) => currentIds.filter((id) => !visibleUsers.some((user) => user.id === id)));
    } else {
      setSelectedUserIds((currentIds) => Array.from(new Set([
        ...currentIds,
        ...visibleUsers.map((user) => user.id)
      ])));
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUserIds.length === 0) return;

    const actionLabels = {
      approve: 'accept',
      reject: 'reject',
      delete: 'delete'
    };
    const actionLabel = actionLabels[action];
    const selectedUsers = visibleUsers.filter((user) => selectedUserIds.includes(user.id));
    const isDestructive = action === 'delete' || action === 'reject';
    const confirmation = isDestructive
      ? `Are you sure you want to ${actionLabel} ${selectedUsers.length} selected user${selectedUsers.length === 1 ? '' : 's'}${action === 'delete' ? ' permanently' : ''}?`
      : `Accept ${selectedUsers.length} selected user${selectedUsers.length === 1 ? '' : 's'}?`;

    if (!window.confirm(confirmation)) return;

    try {
      setActionLoading('bulk');
      const actionRequest = action === 'approve' ? approveUser : action === 'reject' ? rejectUser : deleteUser;
      const results = await Promise.allSettled(selectedUsers.map((user) => actionRequest(user.id)));
      const failedCount = results.filter((result) => result.status === 'rejected').length;
      const successCount = results.length - failedCount;

      if (failedCount > 0) {
        toast.error(`${successCount} completed, ${failedCount} failed`);
      } else {
        toast.success(`${successCount} user${successCount === 1 ? '' : 's'} ${action === 'approve' ? 'accepted' : `${action}d`} successfully`);
      }
      fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  const downloadTemplate = () => {
    const csv = [
      'name,email,role,department_name,department_code,designation,phone_number,employee_id,joining_date',
      'Jane Doe,jane.doe@company.com,hr,Engineering,ENG,Software Engineer,+919999999999,EMP10001,2026-03-17'
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'employee-import-template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportSubmit = async (role) => {
    const importFile = importFiles[role];
    if (!importFile) {
      toast.error(`Choose a ${role} import file first`);
      return;
    }

    try {
      setImportLoadingRole(role);
      const response = await importUsers(importFile, role);
      setImportResult(response.data);
      toast.success(`${role.toUpperCase()} import finished: ${response.data.createdCount} created, ${response.data.updatedCount} updated`);
      setImportFiles((current) => ({ ...current, [role]: null }));
      fetchUsers();
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        toast.error('Import is taking longer than expected. Please try with a smaller file or retry.');
      } else {
        toast.error(err.response?.data?.error || err.message || 'Failed to import employees');
      }
    } finally {
      setImportLoadingRole(null);
    }
  };

  const pendingCount = users.filter(u => u.status === 'pending').length;
  const approvedCount = users.filter(u => u.status === 'approved').length;
  const rejectedCount = users.filter(u => u.status === 'rejected').length;

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      active: 'bg-green-100 text-green-800',
      on_leave: 'bg-amber-100 text-amber-800',
      inactive: 'bg-slate-100 text-slate-700',
      resigned: 'bg-slate-100 text-slate-700',
      terminated: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800'
    };
    const labels = {
      pending: 'Pending',
      approved: 'Approved',
      active: 'Active',
      on_leave: 'On leave',
      inactive: 'Inactive',
      resigned: 'Resigned',
      terminated: 'Terminated',
      rejected: 'Rejected'
    };
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getActionBadge = (actionType) => {
    const styles = {
      approve: 'bg-green-100 text-green-800',
      reject: 'bg-red-100 text-red-800',
      undo_approve: 'bg-orange-100 text-orange-800',
      undo_reject: 'bg-blue-100 text-blue-800',
      leave_approved: 'bg-green-100 text-green-800',
      leave_rejected: 'bg-red-100 text-red-800',
      leave_cancelled: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      approve: 'Approved',
      reject: 'Rejected',
      undo_approve: 'Undo Approve',
      undo_reject: 'Undo Reject',
      leave_approved: 'Leave Approved',
      leave_rejected: 'Leave Rejected',
      leave_cancelled: 'Leave Cancelled'
    };
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[actionType] || 'bg-gray-100 text-gray-800'}`}>
        {labels[actionType] || actionType}
      </span>
    );
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={activeTab === 'employees' ? fetchUsers : fetchHistory} />;

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-900 p-6 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">People administration</p>
        <h1 className="mt-2 text-3xl font-bold">Employee Management</h1>
        <p className="mt-2 text-sm text-slate-300">Review, manage, and securely inspect workforce records.</p>
      </div>

      {/* Main Tabs */}
      <div className="mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'employees'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Employees
            </span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Action History
            </span>
          </button>
        </div>
      </div>

      {activeTab === 'employees' ? (
        <>
          {/* Role Filter Tabs */}
          <div className="mb-4 flex gap-2">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                roleFilter === 'all' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Manageable Roles
            </button>
            <button
              onClick={() => setRoleFilter('employee')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                roleFilter === 'employee' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Employees
            </button>
            {manageableRoles.includes('hr') && (
              <button
                onClick={() => setRoleFilter('hr')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  roleFilter === 'hr' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                HR
              </button>
            )}
            {manageableRoles.includes('manager') && (
              <button
                onClick={() => setRoleFilter('manager')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  roleFilter === 'manager' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Managers
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6 mb-6 border border-gray-100">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Import Users by Role</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Import HR, managers, and employees separately. The selected import type determines the user role.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Required columns: email, department_name or department_code. Optional: name, designation, phone_number, employee_id, joining_date, password.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplate}
                className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                Download Template
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {[
                { role: 'hr', label: 'HR Users', buttonClass: 'bg-blue-600 hover:bg-blue-700' },
                { role: 'manager', label: 'Managers', buttonClass: 'bg-indigo-600 hover:bg-indigo-700' },
                { role: 'employee', label: 'Employees', buttonClass: 'bg-emerald-600 hover:bg-emerald-700' }
              ].filter(({ role }) => manageableRoles.includes(role)).map(({ role, label, buttonClass }) => (
                <div key={role} className="rounded-lg border border-gray-200 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(event) => setImportFiles((current) => ({ ...current, [role]: event.target.files?.[0] || null }))}
                    className="mt-3 block w-full text-sm text-gray-600 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {importFiles[role] && <p className="mt-2 truncate text-xs text-gray-500">{importFiles[role].name}</p>}
                  <button
                    type="button"
                    onClick={() => handleImportSubmit(role)}
                    disabled={importLoadingRole !== null}
                    className={`mt-3 w-full px-4 py-2 text-sm text-white rounded-lg disabled:opacity-60 transition-colors ${buttonClass}`}
                  >
                    {importLoadingRole === role ? `Importing ${label}...` : `Import ${label}`}
                  </button>
                </div>
              ))}
            </div>

            {importResult && (
              <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-gray-500">Rows Processed</p>
                    <p className="text-xl font-semibold text-gray-900">{importResult.totalRows}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-gray-500">Created</p>
                    <p className="text-xl font-semibold text-green-600">{importResult.createdCount}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-gray-500">Updated</p>
                    <p className="text-xl font-semibold text-blue-600">{importResult.updatedCount}</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <p className="text-gray-500">Skipped</p>
                    <p className="text-xl font-semibold text-amber-600">{importResult.skippedCount}</p>
                  </div>
                </div>

                {importResult.created?.some((item) => item.temporaryPassword) && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-900">Temporary Passwords</h3>
                    <div className="mt-2 space-y-2">
                      {importResult.created
                        .filter((item) => item.temporaryPassword)
                        .slice(0, 10)
                        .map((item) => (
                          <div key={`${item.row}-${item.email}`} className="text-sm text-gray-700 bg-white border border-gray-100 rounded-lg px-3 py-2">
                            <span className="font-medium">{item.email}</span> - {item.temporaryPassword}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {importResult.skipped?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-900">Skipped Rows</h3>
                    <div className="mt-2 space-y-2">
                      {importResult.skipped.slice(0, 10).map((item) => (
                        <div key={`${item.row}-${item.email || item.reason}`} className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          Row {item.row}{item.email ? ` (${item.email})` : ''}: {item.reason}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-full">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-semibold">{users.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-full">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="text-2xl font-semibold text-yellow-600">{pendingCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-full">
                  <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-semibold text-green-600">{approvedCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center">
                <div className="p-3 bg-red-100 rounded-full">
                  <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm text-gray-500">Rejected</p>
                  <p className="text-2xl font-semibold text-red-600">{rejectedCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="border-b border-gray-200">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    filter === 'all'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    filter === 'pending'
                      ? 'border-yellow-500 text-yellow-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  onClick={() => setFilter('approved')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    filter === 'approved'
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Approved ({approvedCount})
                </button>
                <button
                  onClick={() => setFilter('rejected')}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    filter === 'rejected'
                      ? 'border-red-500 text-red-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Rejected ({rejectedCount})
                </button>
              </nav>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow mb-4 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-sm text-gray-600">
              {selectedUserIds.length > 0 ? `${selectedUserIds.length} selected` : 'Select users to apply a bulk action'}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleBulkAction('approve')}
                disabled={selectedUserIds.length === 0 || actionLoading === 'bulk'}
                className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Accept Selected
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('reject')}
                disabled={selectedUserIds.length === 0 || actionLoading === 'bulk'}
                className="px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reject Selected
              </button>
              <button
                type="button"
                onClick={() => handleBulkAction('delete')}
                disabled={selectedUserIds.length === 0 || actionLoading === 'bulk'}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Delete Selected
              </button>
            </div>
          </div>

          {/* Employees Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {visibleUsers.length > 0 ? (
              <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        aria-label="Select all visible employees"
                        checked={allVisibleUsersSelected}
                        onChange={toggleAllVisibleUsers}
                        disabled={actionLoading === 'bulk'}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leave Balance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered On
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {visibleUsers.map((user) => (
                    <tr key={user.id} className={
                      user.status === 'pending' ? 'bg-yellow-50' : 
                      user.status === 'rejected' ? 'bg-red-50' : ''
                    }>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          aria-label={`Select ${user.name}`}
                          checked={selectedUserIds.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                          disabled={actionLoading === 'bulk'}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-600 font-medium">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <button type="button" onClick={() => handleOpenDetails(user)} className="text-left text-sm font-semibold text-slate-900 hover:text-cyan-700">
                              {user.name}
                            </button>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {user.role}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(user.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="font-medium text-gray-700">
                          {user.departments?.length
                            ? user.departments.map((department) => department.name || department.code).join(', ')
                            : user.department?.name || 'Unassigned'}
                        </div>
                        <div className="text-xs text-gray-400">{user.designation || 'No designation'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex gap-3">
                          <span>C: {user.leaveBalance?.casual || 0}</span>
                          <span>S: {user.leaveBalance?.sick || 0}</span>
                          <span>E: {user.leaveBalance?.earned || 0}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(user.createdAt), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        {user.status === 'pending' && (
                          <div className="flex justify-start gap-2">
                            <button
                              onClick={() => handleApprove(user.id, user.name)}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === user.id ? '...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleReject(user.id, user.name)}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name, user.email)}
                              disabled={actionLoading === `delete-${user.id}`}
                              className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === `delete-${user.id}` ? '...' : 'Delete'}
                            </button>
                          </div>
                        )}
                        {user.status === 'approved' && (
                          <div className="flex justify-start gap-2">
                            <button
                              onClick={() => {
                                setUserToEdit(user);
                                setEditModalOpen(true);
                              }}
                              className="px-3 py-1 text-blue-600 hover:text-blue-800 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleReject(user.id, user.name)}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 text-red-600 hover:text-red-800 transition-colors"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name, user.email)}
                              disabled={actionLoading === `delete-${user.id}`}
                              className="px-3 py-1 text-gray-700 hover:text-black transition-colors"
                            >
                              {actionLoading === `delete-${user.id}` ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        )}
                        {user.status === 'rejected' && (
                          <div className="flex justify-start gap-2">
                            <button
                              onClick={() => handleApprove(user.id, user.name)}
                              disabled={actionLoading === user.id}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                              Re-approve
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name, user.email)}
                              disabled={actionLoading === `delete-${user.id}`}
                              className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === `delete-${user.id}` ? '...' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No employees found.
              </div>
            )}
          </div>
        </>
      ) : (
        /* History Tab */
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Action History</h2>
            <p className="text-sm text-gray-500">Recent approval and rejection actions with undo capability</p>
          </div>
          
          {history.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {history.map((item) => (
                <div key={item._id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {item.targetUserName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.targetUserName}</span>
                        {getActionBadge(item.actionType)}
                        {item.isUndone && (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Undone</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {item.targetUserEmail} • by {item.performedByName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })} • {item.previousStatus} → {item.newStatus}
                      </p>
                    </div>
                  </div>
                  
                  {!item.isUndone && !item.actionType.startsWith('undo_') && (
                    <button
                      onClick={() => handleUndo(item._id, item.actionType, item.targetUserName)}
                      disabled={actionLoading === item._id}
                      className="px-3 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      {actionLoading === item._id ? 'Undoing...' : 'Undo'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No action history yet.
            </div>
          )}
        </div>
      )}

      {editModalOpen && userToEdit && (
        <EmployeeEditModal
          isOpen={editModalOpen}
          user={userToEdit}
          onClose={() => {
            setEditModalOpen(false);
            setUserToEdit(null);
          }}
          onSave={fetchUsers}
        />
      )}
      {detailsLoading && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/20">
          <div className="rounded-xl bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-xl">Loading employee details...</div>
        </div>
      )}
      <UserDetailsDrawer
        userDetails={userDetails}
        onClose={() => setUserDetails(null)}
        onEdit={(selectedUser) => {
          setUserToEdit(selectedUser);
          setEditModalOpen(true);
          setUserDetails(null);
        }}
      />
    </div>
  );
};

export default Employees;
