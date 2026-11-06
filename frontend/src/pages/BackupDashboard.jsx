import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getCoveringTasks, acceptTask, rejectTask } from '../services/handoverService';
import { getMyTasks } from '../services/handoverService';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const BackupDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [coveringTasks, setCoveringTasks] = useState([]);
  const [myTasks, setMyTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('covering');
  const [rejectModal, setRejectModal] = useState({ show: false, taskId: null, reason: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load tasks covering for colleagues
      const coveringResponse = await getCoveringTasks();
      if (coveringResponse.success) {
        setCoveringTasks(coveringResponse.data || []);
      }

      // Load my own tasks
      const myTasksResponse = await getMyTasks({ status: 'todo' });
      if (myTasksResponse.success) {
        setMyTasks(myTasksResponse.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (taskId) => {
    try {
      setSubmitting(true);
      const response = await acceptTask(taskId);
      if (response.success) {
        toast.success('Task accepted successfully');
        loadData();
      }
    } catch (error) {
      console.error('Error accepting task:', error);
      toast.error('Failed to accept task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.reason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    try {
      setSubmitting(true);
      const response = await rejectTask(rejectModal.taskId, rejectModal.reason);
      if (response.success) {
        toast.success('Task rejected');
        setRejectModal({ show: false, taskId: null, reason: '' });
        loadData();
      }
    } catch (error) {
      console.error('Error rejecting task:', error);
      toast.error('Failed to reject task');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'text-red-600';
      case 'high': return 'text-orange-600';
      case 'medium': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const pendingTasks = coveringTasks.filter(t => t.handoverStatus === 'pending');
  const acceptedTasks = coveringTasks.filter(t => t.handoverStatus === 'accepted');

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Backup Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage tasks you're covering for colleagues on leave
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Awaiting Response</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{pendingTasks.length}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Accepted Tasks</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{acceptedTasks.length}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">My Tasks</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{myTasks.length}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Coverage</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{coveringTasks.length}</dd>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('covering')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'covering'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Covering for Colleagues
              {pendingTasks.length > 0 && (
                <span className="ml-2 py-0.5 px-2 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                  {pendingTasks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('my-tasks')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'my-tasks'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              My Tasks
            </button>
          </nav>
        </div>

        {/* Covering for Colleagues Tab */}
        {activeTab === 'covering' && (
          <>
            {coveringTasks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks to cover</h3>
                <p className="mt-1 text-sm text-gray-500">You're not currently covering any tasks for colleagues.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pending Tasks Section */}
                {pendingTasks.length > 0 && (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                      Awaiting Your Response
                    </h2>
                    <div className="space-y-4">
                      {pendingTasks.map((task) => (
                        <div key={task._id} className="bg-white rounded-lg shadow border border-yellow-200 p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                                <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.handoverStatus)}`}>
                                  {task.handoverStatus}
                                </span>
                              </div>
                              
                              {task.description && (
                                <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                              )}

                              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-3">
                                {task.assignedTo && (
                                  <div className="flex items-center">
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    Original owner: {task.assignedTo.name}
                                  </div>
                                )}
                                {task.deadline && (
                                  <div className="flex items-center">
                                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Deadline: {new Date(task.deadline).toLocaleDateString()}
                                  </div>
                                )}
                              </div>

                              {task.leaveInfo && (
                                <div className="bg-blue-50 rounded-md p-3 text-sm text-blue-800">
                                  <strong>Leave Period:</strong> {new Date(task.leaveInfo.startDate).toLocaleDateString()} - {new Date(task.leaveInfo.endDate).toLocaleDateString()}
                                  {task.leaveInfo.employeeName && <span> (by {task.leaveInfo.employeeName})</span>}
                                </div>
                              )}

                              {task.handoverNote && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Handover Note:</span> {task.handoverNote}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2 ml-4">
                              <button
                                onClick={() => handleAccept(task._id)}
                                disabled={submitting}
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => setRejectModal({ show: true, taskId: task._id, reason: '' })}
                                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Accepted Tasks Section */}
                {acceptedTasks.length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                      Currently Covering
                    </h2>
                    <div className="space-y-4">
                      {acceptedTasks.map((task) => (
                        <div key={task._id} className="bg-white rounded-lg shadow border border-green-200 p-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                                <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                                  {task.priority}
                                </span>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(task.handoverStatus)}`}>
                                  {task.handoverStatus}
                                </span>
                              </div>
                              
                              {task.description && (
                                <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                              )}

                              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                {task.assignedTo && (
                                  <div>Original owner: {task.assignedTo.name}</div>
                                )}
                                {task.deadline && (
                                  <div>Deadline: {new Date(task.deadline).toLocaleDateString()}</div>
                                )}
                                <div className="capitalize">Status: {task.status}</div>
                              </div>

                              {task.handoverNote && (
                                <div className="mt-3 pt-3 border-t border-gray-100">
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Handover Note:</span> {task.handoverNote}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* My Tasks Tab */}
        {activeTab === 'my-tasks' && (
          <>
            {myTasks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No pending tasks</h3>
                <p className="mt-1 text-sm text-gray-500">You have no pending tasks at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myTasks.map((task) => (
                  <div key={task._id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                          <span className={`text-sm font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          {task.handedOverTo && task.handoverStatus !== 'none' && (
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              From: {task.assignedTo?.name}
                            </span>
                          )}
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          {task.deadline && (
                            <div>Deadline: {new Date(task.deadline).toLocaleDateString()}</div>
                          )}
                          <div className="capitalize">Status: {task.status}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Reject Modal */}
        {rejectModal.show && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setRejectModal({ show: false, taskId: null, reason: '' })} />
              
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      Decline Task
                    </h3>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason for declining
                      </label>
                      <textarea
                        value={rejectModal.reason}
                        onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                        rows={4}
                        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm"
                        placeholder="Please provide a reason..."
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={submitting || !rejectModal.reason.trim()}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                  >
                    {submitting ? 'Submitting...' : 'Decline Task'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectModal({ show: false, taskId: null, reason: '' })}
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

export default BackupDashboard;