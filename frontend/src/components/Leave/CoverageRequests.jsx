import React, { useEffect, useState } from 'react';
import { FiCheckCircle, FiXCircle, FiZap, FiClock } from 'react-icons/fi';
import { getMyNotifications } from '../../services/notificationService';
import { respondToCoverage } from '../../services/leaveService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../Common/LoadingSpinner';

/**
 * Coverage Requests — shows leave-coverage notifications where a colleague on
 * leave needs help completing their tasks (same skill / same task). Accepting
 * moves the tasks into the employee's task list and grants extra pay.
 */
const CoverageRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respondingId, setRespondingId] = useState(null);

  const isCoverageNotification = (item) =>
    item.actionRequired &&
    !item.actionCompleted &&
    item.type === 'leave' &&
    item.metadata?.customData?.coverage === true;

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await getMyNotifications({ page: 1, limit: 100 });
      const rows = (response?.data || []).filter(isCoverageNotification);
      setRequests(rows);
    } catch (err) {
      console.error('Failed to load coverage requests', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRespond = async (notification, accept) => {
    setRespondingId(notification._id);
    try {
      await respondToCoverage(notification._id, accept);
      toast.success(
        accept
          ? 'Tasks accepted — added to your task list with extra pay credit.'
          : 'Coverage request declined.'
      );
      await fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to respond to coverage request');
      await fetchRequests();
    } finally {
      setRespondingId(null);
    }
  };

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '-');

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center justify-center">
        <LoadingSpinner label="Loading coverage requests..." />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center text-slate-500">
        <FiZap className="mx-auto text-amber-500 text-2xl mb-2" />
        <p>No coverage requests right now.</p>
        <p className="text-xs text-slate-400 mt-1">
          When a colleague with the same skill & task takes leave and needs coverage, you will see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FiZap className="text-amber-600" />
          Task Coverage Requests
        </h2>
        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
          {requests.length} pending
        </span>
      </div>

      <div className="divide-y divide-slate-100">
        {requests.map((item) => {
          const custom = item.metadata?.customData || {};
          const totalTasks = Array.isArray(custom.taskIds) ? custom.taskIds.length : 0;
          return (
            <div key={item._id} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600 mt-1">{item.message}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                      <FiClock size={11} />
                      {formatDate(custom.startDate)} - {formatDate(custom.endDate)}
                    </span>
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 font-semibold">
                      {totalTasks} task(s) • extra pay
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 capitalize">{custom.leaveType} leave</span>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRespond(item, true)}
                    disabled={respondingId === item._id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                  >
                    <FiCheckCircle size={14} />
                    {respondingId === item._id ? 'Accepting...' : 'Yes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespond(item, false)}
                    disabled={respondingId === item._id}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 transition-colors"
                  >
                    <FiXCircle size={14} />
                    No
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CoverageRequests;