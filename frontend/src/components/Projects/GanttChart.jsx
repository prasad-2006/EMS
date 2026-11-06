import React, { useMemo } from 'react';
import { FiX } from 'react-icons/fi';

const DAY_MS = 24 * 60 * 60 * 1000;

const STATUS_COLORS = {
  todo: '#94a3b8',
  'in-progress': '#3b82f6',
  review: '#8b5cf6',
  done: '#10b981',
  cancelled: '#ef4444'
};

const titleCase = (value = '') =>
  String(value).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Gantt Chart Deep Drill — full-view timeline of every task under a project
 * node. Each task bar is clickable and triggers the secondary drill: the
 * Task Edit Modal.
 */
const GanttChart = ({ tasks, title, onClose, onTaskClick }) => {
  const timeline = useMemo(() => {
    if (!Array.isArray(tasks) || tasks.length === 0) return null;

    let min = Infinity;
    let max = -Infinity;
    tasks.forEach((task) => {
      const start = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
      const end = task.deadline ? new Date(task.deadline).getTime() : start + 7 * DAY_MS;
      min = Math.min(min, start);
      max = Math.max(max, end);
    });

    // Padding: 1 day left, 3 days right so bars never clip.
    min = new Date(min - DAY_MS).getTime();
    max = new Date(max + 3 * DAY_MS).getTime();

    const rangeDays = Math.ceil((max - min) / DAY_MS);
    const bucketDays = rangeDays > 60 ? 7 : 1; // daily columns, weekly for long spans
    const totalUnits = Math.max(1, Math.ceil(rangeDays / bucketDays));

    const unitIndex = (dateValue) => {
      const clamped = Math.min(Math.max(dateValue, min), max);
      return Math.floor((clamped - min) / (DAY_MS * bucketDays));
    };

    const rows = tasks.map((task) => {
      const start = task.createdAt ? new Date(task.createdAt).getTime() : Date.now();
      const end = task.deadline ? new Date(task.deadline).getTime() : start + 7 * DAY_MS;
      const leftUnit = unitIndex(start);
      const rightUnit = unitIndex(end);
      return {
        task,
        leftPct: (leftUnit / totalUnits) * 100,
        widthPct: Math.max(((rightUnit - leftUnit + 1) / totalUnits) * 100, 1.6)
      };
    });

    // Unit labels.
    const labels = [];
    for (let i = 0; i < totalUnits; i++) {
      const date = new Date(min + i * bucketDays * DAY_MS);
      labels.push({
        label: bucketDays === 1 ? date.getDate() : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        title: date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
      });
    }

    return { rows, labels, totalUnits, bucketDays, min, max };
  }, [tasks]);

  if (!timeline) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400">Gantt Deep Drill</p>
              <h3 className="text-lg font-semibold text-slate-900 mt-0.5">{title}</h3>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <FiX size={20} />
            </button>
          </div>
          <p className="text-slate-400 text-center py-8">
            No tasks under this project node yet. Assign tasks to populate the timeline.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Gantt Deep Drill</p>
            <h3 className="text-lg font-semibold text-slate-900 mt-0.5">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {tasks.length} task(s) — click a bar to open the Task Editor
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <FiX size={20} />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-auto p-6">
          <div className="min-w-[720px]">
            {/* Header row: unit labels */}
            <div className="flex">
              <div className="w-60 shrink-0 pr-4" />
              <div className="flex-1 relative h-8 border-b border-slate-200">
                <div className="absolute inset-0 flex">
                  {timeline.labels.map((unit, index) => (
                    <div
                      key={index}
                      className="flex-1 border-l border-slate-100 text-[10px] text-slate-400 px-1 pt-1 overflow-hidden"
                      style={{ minWidth: timeline.bucketDays > 1 ? 34 : 18 }}
                      title={unit.title}
                    >
                      {timeline.labels.length <= 62 ? unit.label : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Task rows */}
            {timeline.rows.map(({ task, leftPct, widthPct }) => {
              const start = task.createdAt ? new Date(task.createdAt) : new Date();
              const end = task.deadline ? new Date(task.deadline) : new Date(start.getTime() + 7 * DAY_MS);
              const color = STATUS_COLORS[task.status] || '#94a3b8';

              return (
                <div key={task._id} className="flex items-center border-b border-slate-50 group">
                  <div className="w-60 shrink-0 pr-4 py-2">
                    <p className="text-sm font-medium text-slate-800 truncate" title={task.title}>
                      {task.title}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
                      {titleCase(task.status)} • {titleCase(task.priority)}
                      {task.assignedTo?.name ? ` • ${task.assignedTo.name}` : ''}
                    </p>
                  </div>
                  <div className="flex-1 relative h-12">
                    {/* Grid lines */}
                    <div className="absolute inset-0 flex">
                      {timeline.labels.map((_, index) => (
                        <div key={index} className="flex-1 border-l border-slate-100" style={{ minWidth: timeline.bucketDays > 1 ? 34 : 18 }} />
                      ))}
                    </div>
                    {/* Task bar */}
                    <button
                      type="button"
                      onClick={() => onTaskClick?.(task)}
                      className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md shadow-sm hover:shadow-md hover:brightness-110 transition-all cursor-pointer overflow-hidden text-left"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%`, background: color }}
                      title={`${task.title}\n${start.toLocaleDateString()} → ${end.toLocaleDateString()}\nClick to edit`}
                    >
                      <span className="px-2 text-[11px] font-semibold text-white leading-7 block truncate">
                        {widthPct > 7 ? task.title : ''}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer legend */}
        <div className="px-6 py-3 border-t border-slate-100 flex items-center gap-4 text-[11px] text-slate-500 shrink-0">
          <span>Today: <span className="font-semibold">{new Date().toLocaleDateString()}</span></span>
          <span className="text-slate-300">|</span>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: color }} />
              {titleCase(status)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
