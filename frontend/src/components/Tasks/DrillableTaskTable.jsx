import React from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useNavigation } from '../../hooks/useNavigation';
import LoadingSpinner from '../Common/LoadingSpinner';

const priorityStyles = {
  critical: 'bg-rose-100 text-rose-800 border-rose-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200'
};

const statusStyles = {
  todo: 'bg-slate-100 text-slate-700 border-slate-200',
  'in-progress': 'bg-blue-100 text-blue-800 border-blue-200',
  review: 'bg-purple-100 text-purple-800 border-purple-200',
  done: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200'
};

const titleCase = (value = '') =>
  String(value).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit'
  });
};

/**
 * Drillable Task Table — the "Click-to-Drill" surface.
 * Assigned To / Priority / Status / Category cells are interactive: clicking
 * them appends the criterion to the URL filter stack. Clicking an employee's
 * email triggers the split-screen Employee Deep-Dive.
 */
const DrillableTaskTable = ({ tasks, loading, onTaskClick, onEmployeeDive, onDelete, selectedTaskIds = [], onSelectionChange }) => {
  const { drillDown, drillUp, isActive } = useNavigation();

  const handleSelectAll = (e) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange(tasks.map((t) => t._id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (taskId, checked) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedTaskIds, taskId]);
    } else {
      onSelectionChange(selectedTaskIds.filter((id) => id !== taskId));
    }
  };

  const toggleFilter = (key, value) => {
    if (isActive(key, value)) {
      drillUp(key);
    } else {
      drillDown(key, value);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10">
        <LoadingSpinner label="Loading tasks..." />
      </div>
    );
  }

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500 text-lg">No tasks match the current drill-down filters</p>
        <p className="text-slate-400 mt-1 text-sm">Click a breadcrumb segment or "Clear all" to drill back up.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {onSelectionChange && (
                <th className="px-5 py-3 text-left font-medium text-slate-500 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    checked={tasks.length > 0 && selectedTaskIds.length === tasks.length}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              <th className="px-5 py-3 text-left font-medium text-slate-500">Title</th>
              <th className="px-5 py-3 text-left font-medium text-slate-500">Assigned To</th>
              <th className="px-5 py-3 text-left font-medium text-slate-500">Priority</th>
              <th className="px-5 py-3 text-left font-medium text-slate-500">Status</th>
              <th className="px-5 py-3 text-left font-medium text-slate-500">Category</th>
              <th className="px-5 py-3 text-left font-medium text-slate-500">Deadline</th>
              <th className="px-5 py-3 text-left font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const assignee = task.assignedTo;
              const assigneeId = assignee?._id || task.assignedTo || null;
              const assigneeName = assignee?.name || assignee?.email || 'Unknown';
              const overdue = task.deadline && ['todo', 'in-progress', 'review'].includes(task.status) && new Date(task.deadline) < new Date();

              return (
                <tr key={task._id} className={`hover:bg-slate-50/70 transition-colors ${selectedTaskIds.includes(task._id) ? 'bg-blue-50/50' : ''}`}>
                  {/* Selection Checkbox */}
                  {onSelectionChange && (
                    <td className="px-5 py-3.5">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        checked={selectedTaskIds.includes(task._id)}
                        onChange={(e) => handleSelectOne(task._id, e.target.checked)}
                      />
                    </td>
                  )}

                  {/* Title */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => onTaskClick?.(task)}
                      className="text-left font-medium text-slate-800 hover:text-blue-700 hover:underline transition-colors line-clamp-2"
                      title="Open task details"
                    >
                      {task.title}
                    </button>
                    {task.projectId?.name && (
                      <p className="text-[11px] text-indigo-600 mt-0.5">{task.projectId.name}</p>
                    )}
                  </td>

                  {/* Assigned To (click to drill assignee; email click = deep dive) */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => assigneeId && toggleFilter('assignee', assigneeId)}
                      className={`font-medium transition-colors ${
                        isActive('assignee', assigneeId)
                          ? 'text-blue-700 underline decoration-2'
                          : 'text-slate-800 hover:text-blue-700 hover:underline'
                      }`}
                      title="Drill into this employee's tasks"
                    >
                      {assigneeName}
                    </button>
                    <button
                      type="button"
                      onClick={() => assigneeId && onEmployeeDive?.(assigneeId, assigneeName)}
                      className="block text-xs text-slate-400 hover:text-emerald-700 hover:underline transition-colors mt-0.5"
                      title="Open split-screen: tasks + parallel leave calendar"
                    >
                      {assignee?.email || 'view profile'}
                    </button>
                  </td>

                  {/* Priority */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleFilter('priority', task.priority)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        priorityStyles[task.priority] || 'bg-slate-100 text-slate-700 border-slate-200'
                      } ${isActive('priority', task.priority) ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-slate-300'}`}
                      title="Drill by priority"
                    >
                      {titleCase(task.priority)}
                    </button>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleFilter('status', task.status)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                        statusStyles[task.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                      } ${isActive('status', task.status) ? 'ring-2 ring-blue-400' : 'hover:ring-1 hover:ring-slate-300'}`}
                      title="Drill by status"
                    >
                      {titleCase(task.status)}
                    </button>
                  </td>

                  {/* Category */}
                  <td className="px-5 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleFilter('category', task.category)}
                      className={`font-medium transition-colors ${
                        isActive('category', task.category)
                          ? 'text-blue-700 underline decoration-2'
                          : 'text-slate-700 hover:text-blue-700 hover:underline'
                      }`}
                      title="Drill by category"
                    >
                      {titleCase(task.category)}
                    </button>
                  </td>

                  {/* Deadline */}
                  <td className="px-5 py-3.5">
                    <span className={overdue ? 'text-red-600 font-semibold' : 'text-slate-600'}>
                      {formatDate(task.deadline)}
                    </span>
                    {overdue && (
                      <p className="text-[10px] text-red-500 font-medium mt-0.5 uppercase tracking-wide">Overdue</p>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onTaskClick?.(task)}
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                        title="Edit task"
                      >
                        <FiEdit2 size={16} />
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete?.(task)}
                          className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete task"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DrillableTaskTable;
