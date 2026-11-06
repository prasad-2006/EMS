import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import LoadingSpinner from '../Common/LoadingSpinner';

const TaskBulkEditModal = ({ isOpen, onClose, onSave, users, selectedCount, loading }) => {
  const [updates, setUpdates] = useState({
    status: '',
    priority: '',
    assignedTo: ''
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUpdates(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Only submit fields that have a value
    const payload = {};
    if (updates.status) payload.status = updates.status;
    if (updates.priority) payload.priority = updates.priority;
    if (updates.assignedTo) payload.assignedTo = updates.assignedTo;
    onSave(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Bulk Edit Tasks</h2>
            <p className="text-sm text-slate-500 mt-1">Editing {selectedCount} task(s)</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="py-8">
              <LoadingSpinner label="Applying updates..." />
            </div>
          ) : (
            <form id="bulkEditForm" onSubmit={handleSubmit} className="space-y-4">
              
              <div className="bg-blue-50 text-blue-800 text-sm p-3 rounded-lg border border-blue-100 mb-4">
                Leave a field blank if you do not want to change it for the selected tasks.
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  name="status"
                  value={updates.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">-- No Change --</option>
                  <option value="todo">To Do</option>
                  <option value="in-progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  name="priority"
                  value={updates.priority}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">-- No Change --</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assignee</label>
                <select
                  name="assignedTo"
                  value={updates.assignedTo}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="">-- No Change --</option>
                  {users?.map(user => (
                    <option key={user._id} value={user._id} disabled={!user.assignmentEligible}>
                      {user.name} {user.assignmentEligible ? '' : '(On Leave)'}
                    </option>
                  ))}
                </select>
              </div>

            </form>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="bulkEditForm"
              disabled={!updates.status && !updates.priority && !updates.assignedTo}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
            >
              Update Tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskBulkEditModal;
