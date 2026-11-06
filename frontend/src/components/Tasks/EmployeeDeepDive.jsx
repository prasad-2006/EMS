import React, { useEffect, useState } from 'react';
import { FiX, FiCalendar } from 'react-icons/fi';
import taskService from '../../services/taskService';
import LoadingSpinner from '../Common/LoadingSpinner';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusDot = {
  todo: 'bg-slate-300',
  'in-progress': 'bg-blue-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  cancelled: 'bg-red-400'
};

const priorityColor = {
  critical: 'text-rose-700',
  high: 'text-orange-700',
  medium: 'text-yellow-700',
  low: 'text-green-700'
};

const buildMonthCells = (year, month) => {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = first.getDay();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

const toDayKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Employee Deep-Dive — split-screen drill-down.
 * Left pane: the employee's assigned tasks.
 * Right pane: their parallel leave calendar for the current month with any
 * overlapping leave dates highlighted.
 */
const EmployeeDeepDive = ({ userId, userName = 'Employee', onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await taskService.getEmployeeDeepDive(userId);
        if (mounted) {
          setData(response?.data || null);
          setError('');
        }
      } catch (err) {
        if (mounted) setError(err.response?.data?.error || 'Failed to load employee deep-dive');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const now = new Date();
  const year = data?.month ? Number(data.month.split('-')[0]) : now.getFullYear();
  const month = data?.month ? Number(data.month.split('-')[1]) - 1 : now.getMonth();

  const cells = buildMonthCells(year, month);

  const leaveByDay = new Map();
  (data?.leaves || []).forEach((leave) => {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      leaveByDay.set(toDayKey(d), leave);
    }
  });

  const taskDeadlinesByDay = new Map();
  (data?.tasks || []).forEach((task) => {
    if (!task.deadline) return;
    const key = toDayKey(task.deadline);
    if (!taskDeadlinesByDay.has(key)) taskDeadlinesByDay.set(key, []);
    taskDeadlinesByDay.get(key).push(task);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              {(userName || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Employee Deep-Dive</p>
              <h3 className="text-lg font-semibold text-slate-900">{userName}</h3>
              {data?.user?.employeeId && <p className="text-xs text-slate-400">{data.user.employeeId}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <FiX size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex-1"><LoadingSpinner label="Loading deep-dive..." /></div>
        ) : error ? (
          <div className="p-12 flex-1 text-center">
            <p className="text-red-600">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden">
            {/* LEFT PANE — assigned tasks */}
            <div className="p-6 overflow-y-auto border-r border-slate-100 min-h-[300px]">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Assigned Tasks ({data?.tasks?.length || 0})
              </h4>
              {data?.tasks?.length === 0 ? (
                <p className="text-sm text-slate-400">No tasks assigned.</p>
              ) : (
                <div className="space-y-2">
                  {(data?.tasks || []).map((task) => {
                    const overdue = task.deadline && ['todo', 'in-progress', 'review'].includes(task.status) && new Date(task.deadline) < new Date();
                    return (
                      <div key={task._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-slate-800 text-sm">{task.title}</p>
                          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${statusDot[task.status] || 'bg-slate-300'}`} title={task.status} />
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs">
                          <span className={`font-semibold capitalize ${priorityColor[task.priority] || 'text-slate-500'}`}>{task.priority}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-500 capitalize">{task.status}</span>
                          {overdue && <span className="text-red-600 font-semibold">OVERDUE</span>}
                        </div>
                        {task.deadline && (
                          <p className="text-[11px] text-slate-400 mt-1">
                            Due: {new Date(task.deadline).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* RIGHT PANE — parallel leave calendar */}
            <div className="p-6 overflow-y-auto">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <FiCalendar className="text-emerald-600" size={15} />
                Leave Calendar — {new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h4>

              <div className="grid grid-cols-7 gap-1">
                {DAY_NAMES.map((name) => (
                  <div key={name} className="text-center text-[10px] font-semibold text-slate-400 uppercase py-1">
                    {name}
                  </div>
                ))}
                {cells.map((day, index) => {
                  if (day === null) return <div key={`empty-${index}`} />;
                  const date = new Date(year, month, day);
                  const key = toDayKey(date);
                  const leave = leaveByDay.get(key);
                  const taskDeadlines = taskDeadlinesByDay.get(key) || [];
                  const isToday = toDayKey(new Date()) === key;
                  const isOverlap = leave && taskDeadlines.length > 0;

                  return (
                    <div
                      key={key}
                      title={
                        leave
                          ? `${leave.leaveType} leave (${new Date(leave.startDate).toLocaleDateString()} - ${new Date(leave.endDate).toLocaleDateString()})`
                          : taskDeadlines.length > 0
                            ? `${taskDeadlines.length} task deadline(s)`
                            : ''
                      }
                      className={`aspect-square rounded-lg border flex flex-col items-center justify-center text-xs relative ${
                        isOverlap
                          ? 'bg-purple-200 border-purple-300 text-purple-900'
                          : leave
                            ? 'bg-rose-100 border-rose-200 text-rose-800'
                            : taskDeadlines.length > 0
                              ? 'bg-blue-50 border-blue-200 text-blue-800'
                              : 'bg-white border-slate-100 text-slate-500'
                      } ${isToday ? 'ring-2 ring-emerald-400' : ''}`}
                    >
                      <span className="font-semibold">{day}</span>
                      {taskDeadlines.length > 0 && (
                        <span className={`text-[9px] leading-none mt-0.5 ${isOverlap ? 'text-purple-800' : 'text-blue-600'}`}>
                          {taskDeadlines.length} task{taskDeadlines.length > 1 ? 's' : ''}
                        </span>
                      )}
                      {leave && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-100 border border-rose-200" /> Approved leave
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-50 border border-blue-200" /> Task deadline
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-purple-200 border border-purple-300" /> Overlap (leave ∩ deadline)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded border-2 border-emerald-400" /> Today
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeDeepDive;
