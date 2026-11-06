import React, { useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import NotificationBell from '../Common/NotificationBell';
import ProfileDropdown from '../Common/ProfileDropdown';

// Inline SVG Icons
const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const GridCalendarIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M4 11h16M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm3-7h3v3H8v-3zm5 0h3v3h-3v-3z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const TaskIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>
);

const TeamIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const BackupIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const ReturnIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const EmployeeLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', icon: HomeIcon, label: 'Dashboard' },
    { path: '/apply-leave', icon: CalendarIcon, label: 'Apply Leave' },
    { path: '/leave-history', icon: ClockIcon, label: 'Leave History' },
    { path: '/leave-calendar', icon: GridCalendarIcon, label: 'Leave Calendar' },
    { path: '/tasks', icon: TaskIcon, label: 'My Tasks' },
    ...(user?.role === 'manager' ? [{ path: '/manager/employees', icon: TeamIcon, label: 'My Employees' }] : []),
    { path: '/projects', icon: TaskIcon, label: 'Projects' },
    ...(user?.role === 'manager' ? [{ path: '/manager/projects', icon: TaskIcon, label: 'Project Workflow' }] : []),
    { path: '/employee/backup', icon: BackupIcon, label: 'Backup Dashboard' },
    { path: '/employee/return', icon: ReturnIcon, label: 'Return to Work' },
  ];

  const activeLabel = useMemo(() => {
    const activeItem = navItems.find((item) => location.pathname === item.path);
    return activeItem?.label || 'Workspace';
  }, [location.pathname]);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen app-shell-bg">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 nav-rail text-slate-700 transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
          <h1 className="text-xl font-bold tracking-tight text-teal-700">VacationTrack</h1>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-md text-slate-500 hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="mt-6">
          <div className="px-4 space-y-1.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`group flex items-center px-4 py-3 rounded-xl border transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-teal-50 text-teal-800 font-semibold border-teal-200 shadow-sm'
                    : 'text-slate-600 border-transparent hover:bg-white/70 hover:text-slate-900'
                }`}
              >
                <span
                  className={`mr-3 transition-colors ${
                    isActive(item.path) ? 'text-teal-700' : 'text-slate-400 group-hover:text-slate-600'
                  }`}
                >
                  <item.icon />
                </span>
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Leave Balance Card */}
        <div className="mx-4 mt-8 p-4 rounded-xl bg-white border border-slate-200 shadow-sm animate-float">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Leave Balance</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Casual</span>
              <span className="font-semibold text-teal-700">{user?.leaveBalance?.casual || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sick</span>
              <span className="font-semibold text-teal-700">{user?.leaveBalance?.sick || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Earned</span>
              <span className="font-semibold text-teal-700">{user?.leaveBalance?.earned || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">WFH</span>
              <span className="font-semibold text-teal-700">{user?.leaveBalance?.wfh || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Emergency</span>
              <span className="font-semibold text-teal-700">{user?.leaveBalance?.emergency || 0}</span>
            </div>
          </div>
        </div>

      </aside>

      {/* Main content */}
      <div className="lg:ml-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
          <div className="px-4 sm:px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-700 bg-white border border-slate-200"
              >
                <MenuIcon />
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{activeLabel}</p>
                <h2 className="text-lg font-semibold text-slate-900">Welcome back, {user?.name}!</h2>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <NotificationBell />
              <ProfileDropdown />
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6">
          <div className="animate-fade-in-up">
          <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeLayout;
