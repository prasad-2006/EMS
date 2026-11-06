import React, { useState } from 'react';
import { FiX, FiSave, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import taskService from '../../services/taskService';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';

const labelClass = 'block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1';

/**
 * Task Edit Modal — the detailed drill target for the Gantt chart bars and
 * table rows. Reassignments are leave-aware (enforceLeaveConstraint).
 */
const TaskEditModal = ({ task, users = [], onClose, onSaved, onDeleted }) => {
  const [form, setForm] = useState({
    title: task.title || '',
    description: task.description || '',
    assignedTo: task.assignedTo?._id || task.assignedTo || '',
    status: task.status || 'todo',
    priority: task.priority || 'medium',
    category: task.category || 'other',
    deadline: task.deadline ? String(task.deadline).slice(0, 10) : '',
    estimatedHours: task.estimatedHours ?? '',
    tags: Array.isArray(task.tags) ? task.tags.join(', ') : ''
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectCorrections, setRejectCorrections] = useState('');

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        title: form.title,
        description: form.description,
        assignedTo: form.assignedTo || undefined,
        status: form.status,
        priority: form.priority,
        category: form.category,
        deadline: form.deadline || undefined,
        estimatedHours: form.estimatedHours ? Number(form.estimatedHours) : undefined,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        enforceLeaveConstraint: true
      };
      await taskService.updateTask(task._id, payload);
      toast.success('Task updated');
      onSaved?.(task._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update task');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      setDeleting(true);
      await taskService.deleteTask(task._id);
      toast.success('Task deleted');
      onDeleted?.(task._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete task');
    } finally {
      setDeleting(false);
    }
  };

  const handleEvaluate = async (status) => {
    if (status === 'rejected' && (!rejectReason.trim() || !rejectCorrections.trim())) {
      return toast.error('Reason and corrections are required for rejection.');
    }
    try {
      setEvaluating(true);
      const payload = {
        status,
        reason: rejectReason,
        correctionsRequired: rejectCorrections
      };
      // Make sure the evaluateTask function exists in taskService
      await taskService.evaluateTask(task._id, payload);
      toast.success(`Task ${status === 'done' ? 'Approved' : 'Rejected'}`);
      onSaved?.(task._id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to evaluate task');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-400">Task Editor</p>
            <h3 className="text-lg font-semibold text-slate-900">Edit Task</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {task.status === 'review' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Task Evaluation Pending</h4>
              <p className="text-xs text-blue-800 mb-3">This task has been submitted for review. Please evaluate the work.</p>
              
              {!showRejectForm ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEvaluate('done')}
                    disabled={evaluating}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                  >
                    Approve Task
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="px-4 py-2 bg-rose-100 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-200"
                  >
                    Reject Task
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mt-3 border-t border-blue-200 pt-3">
                  <div>
                    <label className={labelClass}>Reason for Rejection *</label>
                    <input 
                      className={inputClass} 
                      value={rejectReason} 
                      onChange={(e) => setRejectReason(e.target.value)} 
                      placeholder="e.g., Code fails linting..."
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Corrections Required *</label>
                    <textarea 
                      className={`${inputClass} min-h-[60px]`} 
                      value={rejectCorrections} 
                      onChange={(e) => setRejectCorrections(e.target.value)} 
                      placeholder="e.g., Fix the indentation on line 42 and add unit tests."
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleEvaluate('rejected')}
                      disabled={evaluating}
                      className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50"
                    >
                      {evaluating ? 'Rejecting...' : 'Confirm Rejection'}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className={labelClass}>Title *</label>
            <input className={inputClass} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Assigned To</label>
              <select className={inputClass} value={form.assignedTo} onChange={(e) => set('assignedTo', e.target.value)}>
                <option value="">Unassigned</option>
                {users.map((user) => {
                  const conflicts = user.leaveConflicts || [];
                  const disabled = user.assignmentEligible === false;
                  return (
                    <option key={user._id} value={user._id} disabled={disabled}>
                      {user.name} ({user.employeeId || user.email})
                      {disabled ? ' — ON LEAVE' : ''}
                    </option>
                  );
                })}
              </select>
              {userMap.get(form.assignedTo)?.leaveConflicts?.length > 0 && (
                <p className="text-[11px] text-red-600 mt-1">
                  On approved leave: {userMap.get(form.assignedTo).leaveConflicts.map((l) => `${new Date(l.startDate).toLocaleDateString()} - ${new Date(l.endDate).toLocaleDateString()}`).join(', ')}
                </p>
              )}
            </div>

            <div>
              <label className={labelClass}>Deadline</label>
              <input type="date" className={inputClass} value={form.deadline} onChange={(e) => set('deadline', e.target.value)} />
            </div>

            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} value={form.priority} onChange={(e) => set('priority', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>Category</label>
              <select className={inputClass} value={form.category} onChange={(e) => set('category', e.target.value)}>
                {['development', 'design', 'testing', 'documentation', 'meeting', 'admin', 'other'].map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Estimated Hours</label>
              <input
                type="number"
                min="0"
                className={inputClass}
                value={form.estimatedHours}
                onChange={(e) => set('estimatedHours', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Tags (comma separated)</label>
            <input className={inputClass} value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="urgent, client-facing" />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            <FiTrash2 size={15} />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              <FiSave size={15} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskEditModal;
