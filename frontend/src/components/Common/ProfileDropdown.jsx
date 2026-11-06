import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfileDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const roleLabel = {
    admin: 'Administrator',
    hr: 'Human Resources',
    manager: 'Manager',
    employee: 'Employee'
  }[user?.role] || 'Account';

  const initials = user?.name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800 ring-1 ring-teal-200 transition hover:bg-teal-200 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
      >
        {initials}
      </button>
      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name || 'User'}</p>
            <p className="truncate text-xs text-slate-500">{user?.email || 'No email available'}</p>
            <p className="mt-1 text-xs font-medium capitalize text-teal-700">{roleLabel}</p>
          </div>
          <button
            onClick={() => {
              const settingsPath = user?.role === 'admin'
                ? '/admin/settings'
                : user?.role === 'hr'
                  ? '/hr/settings'
                  : '/settings';
              navigate(settingsPath);
              setIsOpen(false);
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Account settings
          </button>
          <button
            onClick={() => {
              logout();
              navigate('/login');
              setIsOpen(false);
            }}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDropdown;