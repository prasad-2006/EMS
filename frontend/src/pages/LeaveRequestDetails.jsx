import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { eachDayOfInterval, format } from 'date-fns';
import { getAllLeaves } from '../services/leaveService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';

const LeaveRequestDetails = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const response = await getAllLeaves({ userId, page: 1, limit: 200 });
        const rows = response.data || [];
        setRequests(rows);
        setEmployee(rows[0]?.userId || null);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load employee leave profile');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [userId]);

  const latestRequest = useMemo(() => {
    if (!requests.length) return null;
    return [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }, [requests]);

  const leaveDays = useMemo(() => {
    if (!latestRequest?.startDate || !latestRequest?.endDate) return [];
    return eachDayOfInterval({
      start: new Date(latestRequest.startDate),
      end: new Date(latestRequest.endDate)
    });
  }, [latestRequest]);

  const summary = useMemo(() => {
    const pending = requests.filter((request) => request.status === 'pending').length;
    const approved = requests.filter((request) => request.status === 'approved').length;
    const rejected = requests.filter((request) => request.status === 'rejected').length;
    const cancelled = requests.filter((request) => request.status === 'cancelled').length;
    return {
      total: requests.length,
      pending,
      approved,
      rejected,
      cancelled
    };
  }, [requests]);

  const statusStyles = {
    pending: 'bg-amber-50 text-amber-800 border-amber-200',
    approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-50 text-red-800 border-red-200',
    cancelled: 'bg-slate-50 text-slate-700 border-slate-200'
  };

  const riskStyles = {
    safe: 'text-emerald-700',
    risky: 'text-amber-700',
    blocked: 'text-red-700'
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={() => navigate('/admin/requests')} />;
  if (!employee) return <ErrorMessage message="Employee profile not found" onRetry={() => navigate('/admin/requests')} />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-800 text-white p-6 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-100">Employee Leave Profile</p>
            <h1 className="text-3xl font-bold mt-1">{employee?.name || 'Unknown Employee'}</h1>
            <p className="text-indigo-100 mt-1">{employee?.email}</p>
          </div>
          <Link
            to="/admin/requests"
            className="inline-flex w-fit px-4 py-2 rounded-lg bg-white text-slate-900 font-semibold hover:bg-indigo-50"
          >
            Back to Requests
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Department</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">{employee?.department?.name || 'Not assigned'}</p>
          <p className="text-xs text-gray-500">{employee?.department?.code || '-'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Role</p>
          <p className="text-lg font-semibold text-gray-900 mt-1 capitalize">{employee?.role || 'employee'}</p>
          <p className="text-xs text-gray-500 capitalize">{employee?.designation || 'No designation'}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Requests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.total}</p>
          <p className="text-xs text-gray-500 mt-1">All requests by this employee</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pending Requests</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{summary.pending}</p>
          <p className="text-xs text-gray-500 mt-1">Awaiting manager/admin decision</p>
        </div>
      </div>

      {latestRequest && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900">Latest Leave Window</h2>
            <p className="text-sm text-gray-600 mt-1">
              {format(new Date(latestRequest.startDate), 'EEE, MMM dd, yyyy')} - {format(new Date(latestRequest.endDate), 'EEE, MMM dd, yyyy')}
            </p>
            <p className="text-sm text-gray-500 mt-1">Total requested: {latestRequest.totalDays} day(s)</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {leaveDays.map((day) => (
                <span key={day.toISOString()} className="px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs">
                  {format(day, 'EEE dd MMM')}
                </span>
              ))}
            </div>

            {latestRequest.dayCalculation && (
              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="text-sm text-slate-700">Chargeable days: <span className="font-semibold">{latestRequest.dayCalculation.chargeableDays}</span></p>
                <p className="text-xs text-slate-500 mt-1">Excluded weekends: {latestRequest.dayCalculation.weekendsExcluded} | Excluded holidays: {latestRequest.dayCalculation.holidaysExcluded}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900">Latest Work Context</h2>
            <p className="text-sm text-gray-700 mt-3 whitespace-pre-wrap">{latestRequest.handoverTo?.description || latestRequest.reason || 'No work context shared by employee.'}</p>

            {latestRequest.emergencyContactDuringLeave?.name && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs uppercase tracking-wide text-amber-700">Emergency Contact</p>
                <p className="text-sm text-amber-900 font-semibold mt-1">{latestRequest.emergencyContactDuringLeave.name}</p>
                <p className="text-xs text-amber-800">{latestRequest.emergencyContactDuringLeave.phoneNumber || '-'}</p>
              </div>
            )}

            {latestRequest.coverageAssessment?.reason && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs uppercase tracking-wide text-blue-700">Coverage Assessment</p>
                <p className="text-sm text-blue-900 mt-1">{latestRequest.coverageAssessment.reason}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">All Requests By Employee</h2>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">Approved: {summary.approved}</span>
            <span className="px-2 py-1 rounded bg-red-50 text-red-700">Rejected: {summary.rejected}</span>
            <span className="px-2 py-1 rounded bg-slate-50 text-slate-700">Cancelled: {summary.cancelled}</span>
          </div>
        </div>

        <div className="space-y-3">
          {requests
            .slice()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((request) => (
              <div key={request._id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 capitalize">{request.leaveType} leave</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(request.startDate), 'MMM dd, yyyy')} - {format(new Date(request.endDate), 'MMM dd, yyyy')} ({request.totalDays} days)
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Submitted {format(new Date(request.createdAt), 'MMM dd, yyyy hh:mm a')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-semibold ${statusStyles[request.status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                      {request.status}
                    </span>
                    {request.coverageAssessment && (
                      <span className={`text-xs font-semibold uppercase ${riskStyles[request.coverageAssessment.riskLevel] || 'text-gray-700'}`}>
                        {request.coverageAssessment.riskLevel}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-700 mt-3">{request.reason}</p>

                {request.coverageAssessment?.projectedCoveragePercentage !== undefined && (
                  <p className="text-xs text-gray-500 mt-2">
                    Coverage projected: {request.coverageAssessment.projectedCoveragePercentage}%
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestDetails;
