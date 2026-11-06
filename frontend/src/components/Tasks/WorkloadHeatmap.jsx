import React, { useEffect, useState } from 'react';
import { FiX } from 'react-icons/fi';
import taskService from '../../services/taskService';
import LoadingSpinner from '../Common/LoadingSpinner';

const maxCount = (days) => Math.max(1, ...(days || []).map((d) => d.count));

const colorFor = (count, max) => {
  if (count === 0) return 'bg-slate-100 text-slate-400';
  const ratio = count / max;
  if (ratio < 0.34) return 'bg-emerald-200 text-emerald-900';
  if (ratio < 0.67) return 'bg-yellow-200 text-yellow-900';
  if (ratio < 0.9) return 'bg-orange-200 text-orange-900';
  return 'bg-rose-300 text-rose-900';
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Drill-down Weekly Workload Heatmap (Mon-Sun) — renders the pending task
 * distribution for one employee for the current week. Triggered from the
 * "Overloaded" warning badge in Task Redistribution.
 */
const WorkloadHeatmap = ({ userId, userName = 'Employee', onClose }) => {
  const [heatmap, setHeatmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await taskService.getWorkloadHeatmap(userId);
        if (mounted) {
          setHeatmap(response?.data || null);
          setError('');
        }
      } catch (err) {
        if (mounted) setError(err.response?.data?.error || 'Failed to load workload heatmap');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const days = heatmap?.days || [];
  const max = maxCount(days);
  const total = days.reduce((acc, day) => acc + day.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Weekly Workload Heatmap</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
              {userName} — {total} pending task(s) this week
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <FiX size={20} />
          </button>
        </div>

        {loading ? (
          <LoadingSpinner label="Loading heatmap..." />
        ) : error ? (
          <p className="text-red-600 text-center py-8">{error}</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => (
                <div key={day.date} className="text-center">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">{DAY_LABELS[index]}</p>
                  <div
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center border border-slate-100 ${colorFor(day.count, max)}`}
                    title={`${DAY_LABELS[index]} ${day.date}: ${day.count} pending task(s)`}
                  >
                    <span className="text-lg font-bold">{day.count}</span>
                  </div>
                  <p className="text-[9px] text-slate-400 mt-1">
                    {new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between text-[11px] text-slate-500">
              <span>Mon–Sun distribution of active (Todo / In Progress / Review) tasks by deadline.</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-emerald-200 inline-block" />
                <span>Low</span>
                <span className="w-3 h-3 rounded bg-yellow-200 inline-block ml-2" />
                <span>Med</span>
                <span className="w-3 h-3 rounded bg-orange-200 inline-block ml-2" />
                <span>High</span>
                <span className="w-3 h-3 rounded bg-rose-300 inline-block ml-2" />
                <span>Overloaded</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default WorkloadHeatmap;
