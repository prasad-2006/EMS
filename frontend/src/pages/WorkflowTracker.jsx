import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { getAllLeaves } from '../services/leaveService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import { buildWorkflowTimeline } from '../utils/workflow';

const WorkflowTracker = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await getAllLeaves({ page: 1, limit: 100 });
        setLeaves(response.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load workflow tracker');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const activeLeaves = useMemo(() => [...leaves].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [leaves]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-800 text-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-indigo-100/80">Workflow Status Engine</p>
        <h1 className="text-3xl font-bold mt-1">Leave Lifecycle Tracker</h1>
        <p className="text-indigo-100/80 mt-2">Visual stage progression for each leave request, from submission to closure.</p>
      </div>

      <div className="space-y-4">
        {activeLeaves.map((leave) => {
          const timeline = buildWorkflowTimeline(leave);
          return (
            <div key={leave._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{leave.userId?.name || 'Unknown employee'}</h2>
                  <p className="text-sm text-slate-500 capitalize">{leave.leaveType} leave • {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}</p>
                </div>
                <div className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-700">Current stage: {leave.workflowStage || 'manager_review'}</div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {timeline.map((stage) => (
                  <div key={stage.key} className={`rounded-lg border p-3 ${stage.state === 'complete' ? 'border-emerald-200 bg-emerald-50' : stage.state === 'current' ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className="text-sm font-semibold text-slate-900">{stage.label}</p>
                    <p className="text-xs text-slate-500 mt-1 capitalize">{stage.state}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {activeLeaves.length === 0 && <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">No leave workflows found.</div>}
      </div>
    </div>
  );
};

export default WorkflowTracker;
