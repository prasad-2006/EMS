import React, { useEffect, useMemo, useState } from 'react';
import { getAllLeaves, updateLeaveStatus } from '../services/leaveService';
import LeaveFilters from '../components/Leave/LeaveFilters';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import toast from 'react-hot-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { eachDayOfInterval, format } from 'date-fns';

const ManageRequests = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    leaveType: '',
    fromDate: '',
    toDate: ''
  });
  const [selected, setSelected] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [activeEmployeeId, setActiveEmployeeId] = useState(null);

  useEffect(() => {
    fetchLeaves(filters, page);
  }, [filters, page]);

  const fetchLeaves = async (activeFilters = filters, activePage = page) => {
    try {
      setLoading(true);
      const response = await getAllLeaves({
        ...activeFilters,
        page: activePage,
        limit: 12
      });
      const rows = response.data || [];
      setLeaves(rows);
      setPagination(response.pagination);
      setSelected(new Set());
      const groupedRows = Object.values(rows.reduce((acc, leave) => {
        const key = leave?.userId?._id || leave?.userId || 'unknown';
        if (!acc[key]) {
          acc[key] = {
            key,
            user: leave.userId,
            requests: [],
            pendingCount: 0,
            approvedCount: 0,
            rejectedCount: 0,
            latestRequestAt: leave.createdAt
          };
        }
        acc[key].requests.push(leave);
        if (leave.status === 'pending') acc[key].pendingCount += 1;
        if (leave.status === 'approved') acc[key].approvedCount += 1;
        if (leave.status === 'rejected') acc[key].rejectedCount += 1;
        if (new Date(leave.createdAt) > new Date(acc[key].latestRequestAt)) {
          acc[key].latestRequestAt = leave.createdAt;
        }
        return acc;
      }, {}));

      groupedRows.sort((a, b) => new Date(b.latestRequestAt) - new Date(a.latestRequestAt));

      setActiveEmployeeId((prev) => {
        if (prev && groupedRows.some((row) => row.key === prev)) return prev;
        return groupedRows[0]?.key || null;
      });
      setError(null);
    } catch (err) {
      setError('Failed to load leave requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const toggleSelected = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const groupedEmployees = useMemo(() => {
    const grouped = Object.values(leaves.reduce((acc, leave) => {
      const key = leave?.userId?._id || leave?.userId || 'unknown';
      if (!acc[key]) {
        acc[key] = {
          key,
          user: leave.userId,
          requests: [],
          pendingCount: 0,
          approvedCount: 0,
          rejectedCount: 0,
          latestRequestAt: leave.createdAt,
          latestRequest: leave
        };
      }
      acc[key].requests.push(leave);
      if (leave.status === 'pending') acc[key].pendingCount += 1;
      if (leave.status === 'approved') acc[key].approvedCount += 1;
      if (leave.status === 'rejected') acc[key].rejectedCount += 1;
      if (new Date(leave.createdAt) > new Date(acc[key].latestRequestAt)) {
        acc[key].latestRequestAt = leave.createdAt;
        acc[key].latestRequest = leave;
      }
      return acc;
    }, {}));

    return grouped.sort((a, b) => new Date(b.latestRequestAt) - new Date(a.latestRequestAt));
  }, [leaves]);

  const toggleSelectAll = () => {
    if (selected.size === groupedEmployees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(groupedEmployees.map((employee) => employee.key)));
    }
  };

  const handleApprove = async (leaveId) => {
    try {
      const comment = window.prompt('Optional comment for approval:', '') || '';
      await updateLeaveStatus(leaveId, 'approved', comment);
      toast.success('Leave request approved');
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve request');
    }
  };

  const handleReject = async (leaveId) => {
    try {
      const comment = window.prompt('Reason for rejection:', '');
      if (!comment) {
        toast.error('Rejection reason is required');
        return;
      }
      await updateLeaveStatus(leaveId, 'rejected', comment);
      toast.success('Leave request rejected');
      fetchLeaves();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject request');
    }
  };

  const handleBulkApprove = async () => {
    if (selected.size === 0) {
      toast.error('Please select at least one request');
      return;
    }

    const confirmed = window.confirm(`Approve ${selected.size} request(s)? This action cannot be undone.`);
    if (!confirmed) return;

    const comment = window.prompt('Optional comment for bulk approval:', '') || '';

    setBulkProcessing(true);
    let succeeded = 0;
    let failed = 0;

    const requestIds = groupedEmployees
      .filter((employee) => selected.has(employee.key))
      .flatMap((employee) => employee.requests)
      .filter((leave) => leave.status === 'pending')
      .map((leave) => leave._id);

    for (const id of requestIds) {
      try {
        await updateLeaveStatus(id, 'approved', comment);
        succeeded++;
      } catch (error) {
        failed++;
        console.error(`Failed to approve ${id}:`, error);
      }
    }

    setBulkProcessing(false);
    toast.success(`${succeeded} request(s) approved${failed > 0 ? `, ${failed} failed` : ''}`);
    fetchLeaves();
  };

  const handleBulkReject = async () => {
    if (selected.size === 0) {
      toast.error('Please select at least one request');
      return;
    }

    const comment = window.prompt('Reason for bulk rejection:', '');
    if (!comment) {
      toast.error('Rejection reason is required');
      return;
    }

    const confirmed = window.confirm(`Reject ${selected.size} request(s)? This action cannot be undone.`);
    if (!confirmed) return;

    setBulkProcessing(true);
    let succeeded = 0;
    let failed = 0;

    const requestIds = groupedEmployees
      .filter((employee) => selected.has(employee.key))
      .flatMap((employee) => employee.requests)
      .filter((leave) => leave.status === 'pending')
      .map((leave) => leave._id);

    for (const id of requestIds) {
      try {
        await updateLeaveStatus(id, 'rejected', comment);
        succeeded++;
      } catch (error) {
        failed++;
        console.error(`Failed to reject ${id}:`, error);
      }
    }

    setBulkProcessing(false);
    toast.success(`${succeeded} request(s) rejected${failed > 0 ? `, ${failed} failed` : ''}`);
    fetchLeaves();
  };

  const pendingCount = leaves.filter(l => l.status === 'pending').length;
  const approvedCount = leaves.filter(l => l.status === 'approved').length;
  const rejectedCount = leaves.filter(l => l.status === 'rejected').length;

  const getLeaveDayBreakdown = (leave) => {
    if (!leave?.startDate || !leave?.endDate) return [];
    return eachDayOfInterval({
      start: new Date(leave.startDate),
      end: new Date(leave.endDate)
    });
  };

  const activeEmployee = useMemo(
    () => groupedEmployees.find((employee) => employee.key === activeEmployeeId) || null,
    [groupedEmployees, activeEmployeeId]
  );
  const activeEmployeeLatestRequest = activeEmployee?.latestRequest || null;
  const activeLeaveDays = activeEmployeeLatestRequest ? getLeaveDayBreakdown(activeEmployeeLatestRequest) : [];
  const visibleActiveDays = activeLeaveDays.slice(0, 12);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchLeaves} />;

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Manage Leave Requests</h1>
        <p className="text-gray-600 mt-2">
          Review and process employee leave requests
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pending Queue</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</p>
          <p className="text-xs text-gray-500">Needs action</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Approved In View</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{approvedCount}</p>
          <p className="text-xs text-gray-500">Current filter window</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Rejected In View</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{rejectedCount}</p>
          <p className="text-xs text-gray-500">Current filter window</p>
        </div>
      </div>

      <LeaveFilters onFilterChange={handleFilterChange} />

      {selected.size > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div>
            <p className="text-blue-900 font-semibold">{selected.size} request(s) selected</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
            >
              {bulkProcessing ? 'Processing...' : 'Bulk Approve'}
            </button>
            <button
              onClick={handleBulkReject}
              disabled={bulkProcessing}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
            >
              {bulkProcessing ? 'Processing...' : 'Bulk Reject'}
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={bulkProcessing}
              className="px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 disabled:opacity-50 text-sm font-medium"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {groupedEmployees.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-7 bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === leaves.length && leaves.length > 0}
                      onChange={toggleSelectAll}
                      className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Employee</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Requests</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Latest Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Pending</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase">Coverage</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase">Open</th>
                </tr>
              </thead>
              <tbody>
                {groupedEmployees.map((employee) => {
                  const isSelected = selected.has(employee.key);
                  const isActive = activeEmployeeId === employee.key;
                  const latestLeave = employee.latestRequest;
                  const latestTaskSummary = latestLeave?.taskConflictSummary || {};
                  const riskColors = {
                    safe: 'text-emerald-700',
                    risky: 'text-amber-700',
                    blocked: 'text-red-700',
                  };

                  return (
                    <tr
                      key={employee.key}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${
                        isActive ? 'bg-sky-50' : isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setActiveEmployeeId(employee.key)}
                    >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelected(employee.key);
                            }}
                            className="w-5 h-5 rounded border-gray-300 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{employee.user?.name || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{employee.user?.email}</p>
                            <p className="text-[11px] text-sky-700 mt-1">Click row to inspect in workspace</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          <p>{employee.requests.length} request(s)</p>
                          <p className="text-xs text-gray-500">Latest: {format(new Date(employee.latestRequestAt), 'MMM dd, yyyy')}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                            {latestLeave?.leaveType || '-'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded ${employee.pendingCount > 0 ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
                            {employee.pendingCount} pending
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {latestLeave?.coverageAssessment ? (
                            <div>
                              <p className={`text-xs font-semibold ${riskColors[latestLeave.coverageAssessment.riskLevel]}`}>
                                {latestLeave.coverageAssessment.riskLevel.toUpperCase()}
                              </p>
                              <p className="text-xs text-gray-500">{latestLeave.coverageAssessment.projectedCoveragePercentage}% coverage</p>
                              {(latestLeave?.requiresAdminTaskApproval || latestTaskSummary?.urgentCount > 0) && (
                                <p className="mt-1 inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                  Urgent task approval
                                </p>
                              )}
                              {(latestTaskSummary?.urgentCount || 0) > 0 && (
                                <p className="text-[11px] text-gray-600 mt-1">
                                  Urgent: {latestTaskSummary.urgentCount} | Deferred: {latestTaskSummary.nonUrgentCount || 0}
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">-</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/admin/requests/profile/${employee.key}`);
                            }}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                          >
                            Profile
                          </button>
                        </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <aside className="xl:col-span-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5 sticky top-6 space-y-4">
              {activeEmployee ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Selected Employee</p>
                      <h3 className="text-xl font-bold text-gray-900 mt-1">{activeEmployee?.user?.name || 'Unknown Employee'}</h3>
                      <p className="text-sm text-gray-600">{activeEmployee?.user?.email}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/requests/profile/${activeEmployee?.key}`)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                    >
                      Full Profile
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Department</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1">{activeEmployee?.user?.department?.name || 'Not assigned'}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Role</p>
                      <p className="text-sm font-semibold text-gray-900 mt-1 capitalize">{activeEmployee?.user?.role || 'employee'}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">Employee Request Summary</h4>
                    <p className="text-sm text-gray-700">Total requests in current view: {activeEmployee?.requests?.length || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Pending: {activeEmployee?.pendingCount || 0} | Approved: {activeEmployee?.approvedCount || 0} | Rejected: {activeEmployee?.rejectedCount || 0}</p>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-1">Latest Leave Window</h4>
                    <p className="text-sm text-gray-700">
                      {activeEmployeeLatestRequest ? `${format(new Date(activeEmployeeLatestRequest.startDate), 'EEE, MMM dd')} - ${format(new Date(activeEmployeeLatestRequest.endDate), 'EEE, MMM dd, yyyy')}` : '-'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{activeEmployeeLatestRequest?.totalDays || 0} day(s) requested</p>
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Latest Work Context</h4>
                    <p className="text-sm text-gray-700">
                      {activeEmployeeLatestRequest?.handoverTo?.description || activeEmployeeLatestRequest?.reason || 'No work context was provided with this request.'}
                    </p>
                    {(activeEmployeeLatestRequest?.taskConflictSummary?.urgentCount || 0) > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="inline-flex items-center rounded bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Urgent tasks require backup handover
                        </p>
                        <p className="text-xs text-gray-600">
                          Urgent tasks: {activeEmployeeLatestRequest.taskConflictSummary.urgentCount} | Non-urgent deferred: {activeEmployeeLatestRequest.taskConflictSummary.nonUrgentCount || 0}
                        </p>
                        <p className="text-xs text-gray-600">
                          Backup user: {activeEmployeeLatestRequest?.replacementUser?.name || activeEmployeeLatestRequest?.handoverTo?.userId?.name || 'Not selected'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Requested Day(s)</h4>
                    {visibleActiveDays.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {visibleActiveDays.map((day) => (
                          <span key={day.toISOString()} className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
                            {format(day, 'EEE dd MMM')}
                          </span>
                        ))}
                        {activeLeaveDays.length > visibleActiveDays.length && (
                          <span className="px-2 py-1 rounded bg-slate-200 text-slate-700 text-xs">
                            +{activeLeaveDays.length - visibleActiveDays.length} more day(s)
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No day timeline available.</p>
                    )}
                    {activeEmployeeLatestRequest?.dayCalculation && (
                      <p className="text-xs text-slate-500 mt-2">
                        Chargeable: {activeEmployeeLatestRequest.dayCalculation.chargeableDays} | Excluded weekends: {activeEmployeeLatestRequest.dayCalculation.weekendsExcluded} | Excluded holidays: {activeEmployeeLatestRequest.dayCalculation.holidaysExcluded}
                      </p>
                    )}
                  </div>

                  {activeEmployee?.pendingCount > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleBulkApprove}
                        className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
                      >
                        Approve Pending (Selected)
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkReject}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                      >
                        Reject Pending (Selected)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-10 text-gray-500">
                  Select a request from the table to open the detail workspace.
                </div>
              )}
            </div>
          </aside>

          {pagination && pagination.pages > 1 && (
            <div className="xl:col-span-12 mt-1 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Page {pagination.page} of {pagination.pages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(prev => Math.min(prev + 1, pagination.pages))}
                  disabled={pagination.page >= pagination.pages}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">No leave requests match your filters.</p>
        </div>
      )}
    </div>
  );
};

export default ManageRequests;
