import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { getAllLeaves } from '../services/leaveService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';

const HandoverVerification = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await getAllLeaves({ page: 1, limit: 200 });
        setLeaves(response.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load handover queue');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const queue = useMemo(() => leaves.filter((leave) => (
    leave.status === 'approved' || leave.status === 'pending'
  ) && (
    leave.taskConflictSummary?.requiresReplacement || leave.handoverTo?.userId || leave.replacementUser
  )), [leaves]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-blue-900 text-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-blue-100/80">Handover Verification</p>
        <h1 className="text-3xl font-bold mt-1">Review Employee Handover Readiness</h1>
        <p className="text-blue-100/80 mt-2">Conflicts, backup assignment, notes, and cover readiness in one queue.</p>
      </div>

      <div className="space-y-4">
        {queue.map((leave) => (
          <div key={leave._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{leave.userId?.name || 'Unknown employee'}</h2>
                <p className="text-sm text-slate-500 capitalize">{leave.leaveType} leave • {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}</p>
                <p className="text-sm text-slate-700 mt-3 whitespace-pre-wrap">{leave.handoverTo?.description || leave.reason}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">Status: {leave.status}</span>
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">Urgent conflicts: {leave.taskConflictSummary?.urgentCount || 0}</span>
                <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700">Workflow: {leave.workflowStage || 'manager_review'}</span>
                {leave.replacementUser && <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Backup assigned</span>}
              </div>
            </div>
          </div>
        ))}
        {queue.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">No handover verification items are waiting.</div>}
      </div>
    </div>
  );
};

export default HandoverVerification;
