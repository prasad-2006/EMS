import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getReturnSummary, returnToWork, getMyTasks } from '../services/handoverService';
import { getMyLeaves } from '../services/leaveService';
import LoadingSpinner from '../components/Common/LoadingSpinner';

const ReturnToWork = () => {
  const { leaveId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [myTasks, setMyTasks] = useState([]);
  const [activeLeaves, setActiveLeaves] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [leaveId]);

  const loadData = async () => {
    try {
      setLoading(true);

      if (leaveId) {
        // Load specific return summary
        const summaryResponse = await getReturnSummary(leaveId);
        if (summaryResponse.success) {
          setSummary(summaryResponse.data);
        }
      } else {
        // Check if there's an active leave that ended today or earlier
        const leaveResponse = await getMyLeaves();
        if (leaveResponse.success) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          const activeLeaves = (leaveResponse.data || []).filter(leave => {
            const endDate = new Date(leave.endDate);
            endDate.setHours(0, 0, 0, 0);
            return leave.status === 'approved' && endDate <= today;
          });
          
          setActiveLeaves(activeLeaves);

          if (activeLeaves.length > 0) {
            // Get summary for the most recent one
            const summaryResponse = await getReturnSummary(activeLeaves[0]._id);
            if (summaryResponse.success) {
              setSummary(summaryResponse.data);
            }
          }
        }

        // Also load my tasks
        const tasksResponse = await getMyTasks({ status: 'todo' });
        if (tasksResponse.success) {
          setMyTasks(tasksResponse.data || []);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load return summary');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!leaveId && activeLeaves.length === 0) {
      toast.error('No leave found to return from');
      return;
    }

    const targetLeaveId = leaveId || (activeLeaves.length > 0 ? activeLeaves[0]._id : null);
    if (!targetLeaveId) {
      toast.error('No leave found to return from');
      return;
    }

    try {
      setSubmitting(true);
      const response = await returnToWork(targetLeaveId);
      if (response.success) {
        toast.success(response.message || 'Welcome back! Tasks have been transferred back to you.');
        // Navigate to employee dashboard
        setTimeout(() => navigate('/employee/dashboard'), 1500);
      }
    } catch (error) {
      console.error('Error returning to work:', error);
      toast.error(error.response?.data?.error || 'Failed to process return to work');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // No active leave found
  if (!summary && activeLeaves.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">You're all caught up!</h3>
            <p className="mt-2 text-sm text-gray-500">No leave returns scheduled at this time.</p>
            <div className="mt-6">
              <Link
                to="/employee/dashboard"
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { summary: summaryData, completedTasks, inProgressTasks } = summary || {};

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-green-500 to-teal-600 rounded-lg shadow-lg p-8 mb-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back! 🎉</h1>
            <p className="text-green-100">
              {summary?.leavePeriod 
                ? `You were on leave from ${new Date(summary.leavePeriod.startDate).toLocaleDateString()} to ${new Date(summary.leavePeriod.endDate).toLocaleDateString()}`
                : 'Great to have you back!'
              }
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {summaryData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Tasks Handled</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">{summaryData.totalTasks || 0}</dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Completed</dt>
                <dd className="mt-1 text-3xl font-semibold text-green-600">{summaryData.completed || 0}</dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">In Progress</dt>
                <dd className="mt-1 text-3xl font-semibold text-yellow-600">{summaryData.inProgress || 0}</dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Your Tasks</dt>
                <dd className="mt-1 text-3xl font-semibold text-indigo-600">{myTasks.length}</dd>
              </div>
            </div>
          </div>
        )}

        {/* Return Action */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Return to Work</h2>
              <p className="text-sm text-gray-500">
                Pull back all tasks from your backup and resume work
              </p>
            </div>
            <button
              onClick={handleReturn}
              disabled={submitting}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Complete Return'}
            </button>
          </div>
        </div>

        {/* Completed Tasks */}
        {completedTasks && completedTasks.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Tasks Completed by Backup
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {completedTasks.map((task) => (
                <div key={task._id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                      )}
                    </div>
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      Completed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* In Progress Tasks */}
        {inProgressTasks && inProgressTasks.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg className="h-5 w-5 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Tasks In Progress (Waiting for You)
              </h3>
            </div>
            <div className="divide-y divide-gray-200">
              {inProgressTasks.map((task) => (
                <div key={task._id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                      )}
                      {task.handedOverTo && (
                        <p className="text-xs text-gray-400 mt-1">
                          Being handled by: {task.handedOverTo.name}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      task.status === 'in-progress' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Pending Tasks */}
        {myTasks.length > 0 && (
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Your Pending Tasks</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {myTasks.slice(0, 5).map((task) => (
                <div key={task._id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-medium text-gray-900">{task.title}</h4>
                      {task.deadline && (
                        <p className="text-xs text-gray-500 mt-1">
                          Deadline: {new Date(task.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      task.priority === 'critical' ? 'bg-red-100 text-red-800' :
                      task.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              ))}
              {myTasks.length > 5 && (
                <div className="px-6 py-3 bg-gray-50">
                  <Link to="/employee/tasks" className="text-sm text-indigo-600 hover:text-indigo-500">
                    View all {myTasks.length} tasks →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-center">
          <Link
            to="/employee/dashboard"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ReturnToWork;