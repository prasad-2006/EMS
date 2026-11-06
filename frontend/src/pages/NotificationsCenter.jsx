import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import toast from 'react-hot-toast';

const TYPE_COLORS = {
  account: 'bg-blue-100 text-blue-800',
  leave: 'bg-cyan-100 text-cyan-800',
  system: 'bg-slate-100 text-slate-800',
  policy: 'bg-indigo-100 text-indigo-800',
  holiday: 'bg-purple-100 text-purple-800',
  alert: 'bg-red-100 text-red-800',
  reminder: 'bg-amber-100 text-amber-800',
  approval: 'bg-emerald-100 text-emerald-800',
  announcement: 'bg-fuchsia-100 text-fuchsia-800',
};

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-700',
  normal: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const NotificationsCenter = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedNotificationId = searchParams.get('notificationId');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [filters, setFilters] = useState({
    unreadOnly: false,
    type: 'all',
    priority: 'all',
    query: '',
  });

  const getErrorMessage = (err, fallback) => {
    return err?.response?.data?.error || err?.response?.data?.message || err?.message || fallback;
  };

  const resolveActionUrl = (actionUrl) => {
    if (!actionUrl) return null;

    const raw = String(actionUrl).trim();
    if (!raw) return null;

    if (/^https?:\/\//i.test(raw)) {
      return { type: 'external', value: raw };
    }

    const path = raw.startsWith('/') ? raw : `/${raw}`;

    // Backward-compatible normalization for legacy task routes.
    if (path === '/employee/tasks' || path.startsWith('/employee/tasks/')) {
      return { type: 'internal', value: '/tasks' };
    }

    return { type: 'internal', value: path };
  };

  const openNotificationAction = (actionUrl) => {
    const target = resolveActionUrl(actionUrl);
    if (!target) return false;

    if (target.type === 'external') {
      window.location.assign(target.value);
      return true;
    }

    navigate(target.value);
    return true;
  };

  const fetchNotifications = async (withLoader = true) => {
    try {
      if (withLoader) setLoading(true);
      else setRefreshing(true);

      // Fetch a larger window for richer analytics and filtering on client side.
      const response = await getMyNotifications({ page: 1, limit: 200 });
      const rows = response?.data || [];
      setNotifications(rows);
      if (requestedNotificationId && rows.some((item) => item._id === requestedNotificationId)) {
        setSelectedId(requestedNotificationId);
      } else if (!selectedId && rows.length > 0) {
        setSelectedId(rows[0]._id);
      }
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load notifications'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [requestedNotificationId]);

  useEffect(() => {
    if (!requestedNotificationId || notifications.length === 0) return;
    const exists = notifications.some((item) => item._id === requestedNotificationId);
    if (exists) {
      setSelectedId(requestedNotificationId);
    }
  }, [requestedNotificationId, notifications]);

  const filteredNotifications = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return notifications.filter((item) => {
      const matchesUnread = !filters.unreadOnly || !item.isRead;
      const matchesType = filters.type === 'all' || item.type === filters.type;
      const matchesPriority = filters.priority === 'all' || item.priority === filters.priority;
      const matchesQuery =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.message?.toLowerCase().includes(query) ||
        item.type?.toLowerCase().includes(query);

      return matchesUnread && matchesType && matchesPriority && matchesQuery;
    });
  }, [notifications, filters]);

  const stats = useMemo(() => {
    const total = notifications.length;
    const unread = notifications.filter((n) => !n.isRead).length;
    const actionRequired = notifications.filter((n) => n.actionRequired && !n.actionCompleted).length;
    const urgentOrHigh = notifications.filter((n) => n.priority === 'urgent' || n.priority === 'high').length;
    const readRate = total > 0 ? Math.round(((total - unread) / total) * 100) : 0;

    const typeCounter = notifications.reduce((acc, item) => {
      const key = item.type || 'system';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return { total, unread, actionRequired, urgentOrHigh, readRate, typeCounter };
  }, [notifications]);

  const selectedNotification = filteredNotifications.find((item) => item._id === selectedId) || filteredNotifications[0] || null;

  useEffect(() => {
    if (selectedNotification && selectedNotification._id !== selectedId) {
      setSelectedId(selectedNotification._id);
    }
  }, [selectedNotification, selectedId]);

  const markOneAsRead = async (notification) => {
    if (!notification || notification.isRead) return;

    try {
      await markNotificationRead(notification._id);
      setNotifications((prev) =>
        prev.map((item) =>
          item._id === notification._id
            ? { ...item, isRead: true, readAt: new Date().toISOString() }
            : item
        )
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to mark notification as read'));
    }
  };

  const handleOpenNotification = async (notification) => {
    await markOneAsRead(notification);

    if (openNotificationAction(notification.actionUrl)) {
      return;
    }

    setSelectedId(notification._id);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true, readAt: item.readAt || new Date().toISOString() })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to mark all notifications as read'));
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchNotifications} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-900 to-blue-800 p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Notification Center</h1>
            <p className="text-indigo-100 mt-1">Track updates, actions, and decisions with detailed insights.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchNotifications(false)}
              className="px-4 py-2 bg-white/10 border border-white/30 text-white rounded-lg hover:bg-white/20"
              disabled={refreshing}
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 bg-white text-slate-900 rounded-lg font-semibold hover:bg-slate-100"
            >
              Mark All Read
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Unread</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{stats.unread}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Read Rate</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.readRate}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Action Required</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{stats.actionRequired}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">High/Urgent</p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{stats.urgentOrHigh}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            value={filters.query}
            onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
            placeholder="Search title, message, type"
            className="input-field md:col-span-2"
          />
          <select
            value={filters.type}
            onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
            className="input-field"
          >
            <option value="all">All Types</option>
            {[...new Set(notifications.map((n) => n.type).filter(Boolean))].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
            className="input-field"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700 px-2">
            <input
              type="checkbox"
              checked={filters.unreadOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, unreadOnly: e.target.checked }))}
            />
            Unread only
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(stats.typeCounter).map(([type, count]) => (
            <span key={type} className={`px-2 py-1 rounded-full text-xs font-semibold ${TYPE_COLORS[type] || 'bg-slate-100 text-slate-700'}`}>
              {type}: {count}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          </div>

          <div className="max-h-[620px] overflow-y-auto divide-y divide-gray-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No notifications match the selected filters.</div>
            ) : (
              filteredNotifications.map((item) => (
                <button
                  key={item._id}
                  onClick={() => handleOpenNotification(item)}
                  className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors ${
                    selectedNotification?._id === item._id ? 'bg-sky-50' : ''
                  } ${item.isRead ? '' : 'border-l-4 border-l-sky-500'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{item.title}</p>
                        {!item.isRead && <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700">new</span>}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${TYPE_COLORS[item.type] || 'bg-slate-100 text-slate-700'}`}>
                          {item.type || 'system'}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${PRIORITY_COLORS[item.priority] || 'bg-slate-100 text-slate-700'}`}>
                          {item.priority || 'normal'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.shortMessage || item.message}</p>
                      <p className="text-xs text-gray-400 mt-2">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    {item.actionRequired && !item.actionCompleted && (
                      <span className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-700 whitespace-nowrap">Action required</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Notification Detail</h3>
          {selectedNotification ? (
            <div className="space-y-4">
              <div>
                <p className="text-xl font-bold text-gray-900">{selectedNotification.title}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${TYPE_COLORS[selectedNotification.type] || 'bg-slate-100 text-slate-700'}`}>
                  {selectedNotification.type || 'system'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${PRIORITY_COLORS[selectedNotification.priority] || 'bg-slate-100 text-slate-700'}`}>
                  {selectedNotification.priority || 'normal'}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full ${selectedNotification.isRead ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selectedNotification.isRead ? 'Read' : 'Unread'}
                </span>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedNotification.message}</p>
              </div>

              {selectedNotification.actionRequired && !selectedNotification.actionCompleted && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                  This notification expects an action.
                </div>
              )}

              <div className="flex gap-2">
                {!selectedNotification.isRead && (
                  <button
                    onClick={() => markOneAsRead(selectedNotification)}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    Mark as read
                  </button>
                )}

                {selectedNotification.actionUrl && (
                  <button
                    onClick={() => openNotificationAction(selectedNotification.actionUrl)}
                    className="px-3 py-2 text-sm rounded-lg bg-sky-700 text-white hover:bg-sky-800"
                  >
                    {selectedNotification.actionLabel || 'Open related page'}
                  </button>
                )}
              </div>

              {selectedNotification.metadata && Object.keys(selectedNotification.metadata).length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Metadata</p>
                  <div className="space-y-1 text-xs text-gray-600">
                    {Object.entries(selectedNotification.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-start justify-between gap-2">
                        <span className="font-medium text-gray-500">{key}</span>
                        <span className="text-right break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Select a notification to view details.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationsCenter;
