import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import taskService from '../services/taskService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import CascadingAssign from '../components/Tasks/CascadingAssign';

// Icons
const TaskIcon = () => (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00-.293.707l-2.829 2.829a1 1 0 101.415 1.415L9 11.414V6z" clipRule="evenodd" />
  </svg>
);

const EmployeeAssignedTasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('deadline');
  const [selectedParentTask, setSelectedParentTask] = useState(null);
  const [submissionTask, setSubmissionTask] = useState(null);
  const [submissionForm, setSubmissionForm] = useState({ repositoryUrl: '', pullRequestUrl: '', documentationLinks: '', completionNotes: '' });
  const [documentationFiles, setDocumentationFiles] = useState([]);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await taskService.getAllTasks({ 
        page: 1, 
        limit: 100,
        assignedTo: user?._id 
      });
      setTasks(Array.isArray(response?.data) ? response.data : []);
      setError(null);
    } catch (err) {
      setError('Failed to load assigned tasks');
      console.error('Task fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await taskService.updateTask(taskId, { status: newStatus });
      toast.success('Task status updated');
      fetchTasks();
    } catch (err) {
      toast.error('Failed to update task status');
      console.error(err);
    }
  };

  const openSubmission = (task) => {
    setSubmissionTask(task);
    setSubmissionForm({
      repositoryUrl: task.submission?.repositoryUrl || '',
      pullRequestUrl: task.submission?.pullRequestUrl || '',
      documentationLinks: task.submission?.documentationLinks?.join('\n') || '',
      completionNotes: task.submission?.completionNotes || ''
    });
    setDocumentationFiles([]);
  };

  const submitTaskForReview = async () => {
    try {
      const hasSubmissionEvidence = submissionForm.documentationLinks.trim() || submissionForm.completionNotes.trim() || documentationFiles.length > 0;
      if (!hasSubmissionEvidence) {
        toast.error('Add a document, documentation link, or completion note before submitting');
        return;
      }
      if (documentationFiles.length > 0) {
        await taskService.uploadAttachments(submissionTask._id, documentationFiles);
      }
      await taskService.submitForReview(submissionTask._id, {
        repositoryUrl: submissionForm.repositoryUrl,
        pullRequestUrl: submissionForm.pullRequestUrl,
        documentationLinks: submissionForm.documentationLinks.split('\n').map((link) => link.trim()).filter(Boolean),
        completionNotes: submissionForm.completionNotes
      });
      toast.success('Work submitted to your manager for review');
      setSubmissionTask(null);
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit work for review');
    }
  };

  const getFilteredAndSortedTasks = () => {
    let filtered = tasks;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    filtered.sort((a, b) => {
      if (sortBy === 'deadline') {
        const dateA = a.deadline ? new Date(a.deadline) : new Date('2099-01-01');
        const dateB = b.deadline ? new Date(b.deadline) : new Date('2099-01-01');
        return dateA - dateB;
      } else if (sortBy === 'priority') {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return 0;
    });

    return filtered;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'done': return 'bg-green-50 border-l-4 border-green-500';
      case 'in-progress': return 'bg-blue-50 border-l-4 border-blue-500';
      case 'review': return 'bg-purple-50 border-l-4 border-purple-500';
      case 'rejected': return 'bg-red-50 border-l-4 border-red-500';
      default: return 'bg-white border-l-4 border-gray-300';
    }
  };

  const isOverdue = (deadline, status) => {
    if (status === 'done' || !deadline) return false;
    return new Date(deadline) < new Date();
  };

  const filteredTasks = getFilteredAndSortedTasks();
  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length,
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchTasks} />;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <TaskIcon />
            My Assigned Tasks
          </h1>
          <p className="text-gray-600 mt-2">Manage tasks assigned to you by your manager</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">Total Tasks</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">To Do</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.todo}</p>
          </div>
          <div className="bg-purple-50 rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">{stats.inProgress}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg shadow p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600">In Review</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.review}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.done}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="all">All Status</option>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="deadline">Deadline (Soon First)</option>
                <option value="priority">Priority (High First)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <TaskIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No tasks found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTasks.map((task) => (
              <div
                key={task._id}
                className={`rounded-lg shadow p-6 ${getStatusColor(task.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Title and Priority */}
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      {isOverdue(task.deadline, task.status) && (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                          Overdue
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {task.description && (
                      <p className="text-gray-700 text-sm mb-3">{task.description}</p>
                    )}

                    {/* Meta Info */}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {task.deadline && (
                        <div className="flex items-center gap-1">
                          <ClockIcon />
                          <span>Due: {format(new Date(task.deadline), 'MMM dd, yyyy')}</span>
                        </div>
                      )}
                      {task.category && (
                        <div className="px-2 py-1 bg-gray-100 rounded text-xs">
                          {task.category}
                        </div>
                      )}
                      {task.estimatedHours && (
                        <div className="text-xs">⏱️ {task.estimatedHours} hours</div>
                      )}
                    </div>

                    {/* Tags */}
                    {task.tags && task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {task.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Rejection Feedback */}
                    {task.reviewStatus === 'changes_requested' && task.rejectionFeedback && task.rejectionFeedback.length > 0 && (
                      <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-red-900 mb-2">Changes requested by your manager</h4>
                        <div className="space-y-3">
                          {task.rejectionFeedback.map((feedback, idx) => (
                            <div key={idx} className="text-sm">
                              <p className="text-red-800"><span className="font-medium">Reason:</span> {feedback.reason}</p>
                              <p className="text-red-800"><span className="font-medium">Corrections Required:</span> {feedback.correctionsRequired}</p>
                              <p className="text-xs text-red-500 mt-1">Rejected on {format(new Date(feedback.rejectedAt), 'MMM dd, yyyy HH:mm')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Status Control */}
                  <div className="flex flex-col gap-2 items-end">
                    <select
                      value={task.status}
                      onChange={(e) => handleStatusChange(task._id, e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium w-full"
                    >
                      <option value="todo">To Do</option>
                      <option value="in-progress">In Progress</option>
                      <option value="review">In Review</option>
                      {task.reviewStatus === 'approved' && <option value="done">Completed</option>}
                      <option value="cancelled">Cancelled</option>
                      {task.status === 'rejected' && <option value="rejected">Rejected</option>}
                    </select>

                    {['hr', 'manager'].includes(user?.role) && (
                      <>
                        <button
                          onClick={() => setSelectedParentTask(task)}
                          className="w-full px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                        >
                          Delegate Task
                        </button>
                        {task.status !== 'review' && task.status !== 'done' && (
                          <button
                            onClick={() => handleStatusChange(task._id, 'review')}
                            className="w-full px-3 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-semibold hover:bg-purple-100 transition-colors"
                          >
                            Ready for CEO Review
                          </button>
                        )}
                      </>
                    )}
                    {user?.role === 'employee' && task.reviewStatus !== 'approved' && (
                      <button
                        onClick={() => openSubmission(task)}
                        className="w-full px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
                      >
                        Submit Work
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedParentTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl relative">
            <button
              onClick={() => setSelectedParentTask(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-200"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <CascadingAssign 
              parentTaskId={selectedParentTask._id} 
              defaultProjectId={selectedParentTask.projectId?._id || selectedParentTask.projectId}
              defaultDeptId={user?.department?._id || user?.department}
              onAssigned={() => {
                toast.success('Sub-task delegated successfully');
                setSelectedParentTask(null);
              }} 
            />
          </div>
        </div>
      )}

      {submissionTask && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-xl bg-white shadow-xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Submit completed work</h2>
                <p className="text-sm text-slate-500 mt-1">{submissionTask.title}</p>
              </div>
              <button type="button" onClick={() => setSubmissionTask(null)} className="text-slate-400 hover:text-slate-700" aria-label="Close submission form">✕</button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Repository URL (optional)
                <input value={submissionForm.repositoryUrl} onChange={(event) => setSubmissionForm({ ...submissionForm, repositoryUrl: event.target.value })} placeholder="https://github.com/company/project" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Pull request URL (optional)
                <input value={submissionForm.pullRequestUrl} onChange={(event) => setSubmissionForm({ ...submissionForm, pullRequestUrl: event.target.value })} placeholder="https://github.com/company/project/pull/42" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Documentation links (one per line)
                <textarea value={submissionForm.documentationLinks} onChange={(event) => setSubmissionForm({ ...submissionForm, documentationLinks: event.target.value })} rows={3} placeholder="https://..." className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Completion notes
                <textarea value={submissionForm.completionNotes} onChange={(event) => setSubmissionForm({ ...submissionForm, completionNotes: event.target.value })} rows={4} placeholder="Summarize the implementation and testing completed." className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 font-normal" />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Documentation files (optional)
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" onChange={(event) => setDocumentationFiles(Array.from(event.target.files || []))} className="mt-1 block w-full text-sm font-normal text-slate-600" />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setSubmissionTask(null)} className="px-4 py-2 text-sm text-slate-700 bg-slate-100 rounded-lg">Cancel</button>
                <button type="button" disabled={!submissionForm.documentationLinks.trim() && !submissionForm.completionNotes.trim() && documentationFiles.length === 0} onClick={submitTaskForReview} className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg disabled:opacity-50">Send to Manager</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAssignedTasks;
