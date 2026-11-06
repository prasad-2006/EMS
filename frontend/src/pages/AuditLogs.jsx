import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { getActionHistory } from '../services/userService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadLogs = async () => {
      try {
        setLoading(true);
        const response = await getActionHistory(100);
        setLogs(response.data || []);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-slate-900 text-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Audit Trail</p>
        <h1 className="text-3xl font-bold mt-1">Action History & Compliance Events</h1>
        <p className="text-slate-300 mt-2">Visible history of user administration, approvals, and undo operations.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Events</h2>
          <span className="text-sm text-slate-500">{logs.length} records</span>
        </div>
        <div className="divide-y divide-slate-200">
          {logs.map((log) => (
            <div key={log._id} className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-medium text-slate-900 capitalize">{log.actionType?.replace(/_/g, ' ') || 'action'}</p>
                <p className="text-sm text-slate-600">{log.targetUserName || log.targetUserEmail || 'Unknown target'}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Performed by {log.performedByName || 'System'} on {format(new Date(log.createdAt), 'MMM dd, yyyy hh:mm a')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700">{log.previousStatus || 'n/a'} → {log.newStatus || 'n/a'}</span>
                {log.leaveRequestId && <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">Leave linked</span>}
                {log.complianceDetails?.requiresAudit && <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">Audit required</span>}
              </div>
            </div>
          ))}
          {logs.length === 0 && <div className="p-8 text-center text-slate-500">No audit events recorded yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;
