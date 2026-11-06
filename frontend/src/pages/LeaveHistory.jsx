import React, { useState, useEffect } from 'react';
import { getMyLeaves, cancelLeaveRequest } from '../services/leaveService';
import LeaveCard from '../components/Leave/LeaveCard';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import toast from 'react-hot-toast';

const LeaveHistory = () => {
  const [leaves, setLeaves] = useState([]);
  const [filteredLeaves, setFilteredLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    fetchLeaves();
  }, [filter, page]);

  useEffect(() => {
    filterLeaves();
  }, [filter, leaves, typeFilter, searchText]);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await getMyLeaves({
        status: filter === 'all' ? '' : filter,
        page,
        limit: 12
      });
      setLeaves(response.data);
      setPagination(response.pagination);
      setError(null);
    } catch (err) {
      setError('Failed to load leave history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filterLeaves = () => {
    const query = searchText.trim().toLowerCase();
    const next = leaves.filter((leave) => {
      const matchesType = typeFilter === 'all' || leave.leaveType === typeFilter;
      const matchesSearch = !query ||
        leave.reason?.toLowerCase().includes(query) ||
        leave.leaveType?.toLowerCase().includes(query) ||
        leave.status?.toLowerCase().includes(query);
      return matchesType && matchesSearch;
    });
    setFilteredLeaves(next);
  };

  const avgApprovalTimeHours = (() => {
    const reviewed = leaves.filter((leave) => leave.reviewedAt && leave.createdAt);
    if (!reviewed.length) return 0;
    const totalHours = reviewed.reduce((sum, leave) => {
      const diffMs = new Date(leave.reviewedAt).getTime() - new Date(leave.createdAt).getTime();
      return sum + diffMs / (1000 * 60 * 60);
    }, 0);
    return Math.round(totalHours / reviewed.length);
  })();

  const approvedDaysTotal = leaves
    .filter((leave) => leave.status === 'approved')
    .reduce((sum, leave) => sum + (leave.dayCalculation?.chargeableDays ?? leave.totalDays ?? 0), 0);

  const pendingLongerThanThreeDays = leaves.filter((leave) => {
    if (leave.status !== 'pending' || !leave.createdAt) return false;
    const ageHours = (Date.now() - new Date(leave.createdAt).getTime()) / (1000 * 60 * 60);
    return ageHours >= 72;
  }).length;

  const exportFilteredAsCsv = () => {
    if (!filteredLeaves.length) {
      toast.error('No rows to export for current filters');
      return;
    }

    const rows = [
      ['Leave Type', 'Status', 'Start Date', 'End Date', 'Total Days', 'Chargeable Days', 'Reason', 'Created At'],
      ...filteredLeaves.map((leave) => [
        leave.leaveType || '-',
        leave.status || '-',
        leave.startDate ? new Date(leave.startDate).toLocaleDateString() : '-',
        leave.endDate ? new Date(leave.endDate).toLocaleDateString() : '-',
        String(leave.totalDays ?? '-'),
        String(leave.dayCalculation?.chargeableDays ?? leave.totalDays ?? '-'),
        (leave.reason || '').replace(/\n/g, ' ').replace(/,/g, ';'),
        leave.createdAt ? new Date(leave.createdAt).toLocaleString() : '-',
      ])
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.setAttribute('download', 'leave-history-export.csv');
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const getStatusCount = (status) => {
    if (status === 'all') return pagination?.total || leaves.length;
    return leaves.filter(l => l.status === status).length;
  };

  const handleCancel = async (leaveId) => {
    const reason = window.prompt('Optional cancellation reason:', '') || '';
    try {
      await cancelLeaveRequest(leaveId, reason);
      toast.success('Leave request cancelled');
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel leave request');
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchLeaves} />;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Leave History</h1>
        <p className="text-gray-600 mt-2">View all your past and current leave requests</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Approved Days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{approvedDaysTotal}</p>
          <p className="text-xs text-gray-500">Total chargeable approved days</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Avg Decision Time</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{avgApprovalTimeHours}h</p>
          <p className="text-xs text-gray-500">From request creation to review</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Stale Pending</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{pendingLongerThanThreeDays}</p>
          <p className="text-xs text-gray-500">Pending requests older than 72h</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {['all', 'pending', 'approved', 'rejected', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setFilter(status);
                setPage(1);
              }}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm capitalize
                ${filter === status
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {status} ({getStatusCount(status)})
            </button>
          ))}
        </nav>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Search</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Reason, status, leave type"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Leave Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Types</option>
            <option value="casual">Casual</option>
            <option value="sick">Sick</option>
            <option value="earned">Earned</option>
            <option value="wfh">WFH</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        <div className="md:col-span-2 flex gap-2 md:justify-end">
          <button
            type="button"
            onClick={exportFilteredAsCsv}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-900"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchText('');
              setTypeFilter('all');
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Leave Cards */}
      {filteredLeaves.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLeaves.map((leave) => (
            <LeaveCard key={leave._id} leave={leave} showCancel={true} onCancel={handleCancel} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No leave requests found.</p>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(prev => Math.max(prev - 1, 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(prev => Math.min(prev + 1, pagination.pages))}
              disabled={pagination.page >= pagination.pages}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveHistory;
