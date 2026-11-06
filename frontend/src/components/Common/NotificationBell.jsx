import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notificationService';

const NotificationBell = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  const isAdminView = window.location.pathname.startsWith('/admin');
  const notificationCenterPath = isAdminView ? '/admin/notifications' : '/notifications';

  const loadNotifications = async () => {
    try {
      const response = await getMyNotifications({ page: 1, limit: 8 });
      setNotifications(response.data);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Failed to load notifications', error);
    }
  };

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    const onFocus = () => {
      loadNotifications();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    await loadNotifications();
  };

  const handleMarkRead = async (notificationId, isRead) => {
    if (isRead) return;
    await markNotificationRead(notificationId);
    await loadNotifications();
  };

  const handleOpenNotification = async (item) => {
    try {
      if (!item.isRead) {
        await markNotificationRead(item._id);
      }
      setIsOpen(false);
      navigate(`${notificationCenterPath}?notificationId=${encodeURIComponent(item._id)}`);
    } catch (error) {
      console.error('Failed to open notification', error);
      setIsOpen(false);
      navigate(notificationCenterPath);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          const next = !isOpen;
          setIsOpen(next);
          if (next) loadNotifications();
        }}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        title="Notifications"
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden">
          <div className="px-4 py-3 border-b bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              <p className="text-xs text-gray-500 mt-0.5">{unreadCount} unread</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate(notificationCenterPath);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Open Center
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">No notifications yet.</p>
            ) : (
              notifications.map((item) => (
                <button
                  key={item._id}
                  onClick={() => handleOpenNotification(item)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${item.isRead ? '' : 'bg-blue-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 line-clamp-1">{item.title}</p>
                    {!item.isRead && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">new</span>}
                  </div>
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.shortMessage || item.message}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                </button>
              ))
            )}
          </div>

          <div className="px-4 py-2 border-t bg-slate-50 flex justify-end">
            <button
              onClick={() => {
                setIsOpen(false);
                navigate(notificationCenterPath);
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              View detailed analytics
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;