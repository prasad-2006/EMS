import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getFlaggedTasks, assignTask, deferTask, getMyTasks } from '../services/handoverService';
import { getAllUsers } from '../services/userService';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const EmployeeHandover = () => {
  const { leaveId } = useParams();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (leaveId) {
      loadFlaggedTasks();
    } else {
      loadMyTasks();
    }
    loadUsers();
  }, [leaveId]);

  const loadFlaggedTasks = async () => {
    try {
      setLoading(true);
      const response = await getFlaggedTasks(leaveId);
      if (response.success) {
        setTasks(response.data.tasks || []);
      }
    } catch (error) {
      console.error('Error loading flagged tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadMyTasks = async () => {
    try {
      setLoading(true);
      const response = await getMyTasks({ status: 'todo' });
      if (response.success) {
        setTasks(response.data || []);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await getAllUsers();
      if (response.success) {
        setUsers(response.data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleAssign = async () => {
    if (!selectedTask || !selectedUser) {
      toast.error('Please select a task and assignee');
      return;
    }

    try {
      setSubmitting(true);
      const response = await assignTask(selectedTask._id, selectedUser, handoverNote);
      if (response.success) {
        toast.success('Task assigned successfully');
        setShowAssignModal(false);
        setSelectedTask(null);
        setSelectedUser('');
        setHandoverNote('');
        loadFlaggedTasks();
      }
    } catch (error) {
      console.error('Error assigning task:', error);
      toast.error(error.response?.data?.error || 'Failed to assign task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDefer = async (taskId) => {
    try {
      setSubmitting(true);
      const response = await deferTask(taskId);
      if (response.success) {
        toast.success('Task deferred successfully');
        loadFlaggedTasks();
      }
    } catch (error) {
      console.error('Error deferring task:', error);
      toast.error('Failed to defer task');
    } finally {
      setSubmitting(false);
    }
  };

  const openAssignModal = (task) => {
    setSelectedTask(task);
    setShowAssignModal(true);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (task) => {
    if (task.handoverStatus === 'pending') {
      return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Awaiting Acceptance</span>;
    }
    if (task.handoverStatus === 'accepted') {
      return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">Accepted</span>;
    }
    if (task.handoverStatus === 'deferred') {
      return <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">Deferred</span>;
    }
    if (task.handoverStatus === 'completed') {
      return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">Completed</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">Pending Action</span>;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {leaveId ? 'Task Handover' : 'My Tasks'}
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                {leaveId 
                  ? 'Review and handover tasks that need attention during your leave'
                  : 'Manage your pending tasks and handovers'
                }
              </p>
            </div>
            {leaveId && (
              <Link 
                to="/employee/leave-history" 
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                ← Back to Leave History
              </Link>
            )}
          </div>
        </div>

        {/* Info Banner */}
        {leaveId && tasks.length > 0 && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Handover Required</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>You have {tasks.length} task(s) that need attention before your leave. Please assign them to a colleague or defer them.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Task List */}
        {tasks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks requiring handover</h3>
            <p className="mt-1 text-sm text-gray-500">You're all set for your leave!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task._id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded border ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {getStatusBadge(task)}
                    </div>
                    
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                      {task.deadline && (
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Deadline: {new Date(task.deadline).toLocaleDateString()}
                        </div>
                      )}
                      {task.isRecurring && (
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Recurring: {task.recurringFrequency}
                        </div>
                      )}
                      {task.status && (
                        <div className="flex items-center">
                          <span className="capitalize">Status: {task.status}</span>
                        </div>
                      )}
                    </div>

                    {/* Handover Info */}
                    {task.handedOverTo && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Assigned to:</span> {task.handedOverTo.name}
                        </p>
                        {task.handoverNote && (
                          <p className="text-sm text-gray-500 mt-1">
                            <span className="font-medium">Note:</span> {task.handoverNote}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!task.handedOverTo && task.handoverStatus === 'none' && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => openAssignModal(task)}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Assign to Colleague
                      </button>
                      <button
                        onClick={() => handleDefer(task._id)}
                        disabled={submitting}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        Defer to After Return
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowAssignModal(false)} />
              
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Assign Task: {selectedTask?.title}
                    </h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Colleague
                      </label>
                      <select
                        value={selectedUser}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      >
                        <option value="">Select a colleague...</option>
                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.name} ({user.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Handover Notes (Optional)
                      </label>
                      <textarea
                        value={handoverNote}
                        onChange={(e) => setHandoverNote(e.target.value)}
                        rows={4}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Provide context, status, and instructions for the task..."
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleAssign}
                    disabled={submitting || !selectedUser}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {submitting ? 'Assigning...' : 'Assign Task'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedTask(null);
                      setSelectedUser('');
                      setHandoverNote('');
                    }}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeHandover;