import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getMyLeaves } from '../services/leaveService';
import { getMyNotifications } from '../services/notificationService';
import { getUpcomingHolidays } from '../services/holidayService';
import { getDefaultPolicy } from '../services/policyService';
import { Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiCheckCircle, FiXCircle, FiBell, FiFileText, FiAlertTriangle, FiZap } from 'react-icons/fi';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import SalaryCard from '../components/Salary/SalaryCard';
import CoverageRequests from '../components/Leave/CoverageRequests';

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [companyUpdates, setCompanyUpdates] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [defaultPolicy, setDefaultPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLeaves();
    fetchCompanyFeed();
  }, []);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await getMyLeaves({ page: 1, limit: 50 });
      setLeaves(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load leave requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyFeed = async () => {
    try {
      const [notificationsResponse, holidaysResponse] = await Promise.all([
        getMyNotifications({ page: 1, limit: 8 }),
        getUpcomingHolidays(5)
      ]);

      const updates = (notificationsResponse.data || []).filter(
        (item) => item.type === 'system' || item.type === 'account'
      );

      setCompanyUpdates(updates.slice(0, 5));
      setUpcomingHolidays(holidaysResponse.data || []);
    } catch (err) {
      // Keep dashboard usable even if company feed fails.
      console.error('Failed to load company feed', err);
    }
  };

  const fetchDefaultPolicy = async () => {
    try {
      const policyResponse = await getDefaultPolicy();
      setDefaultPolicy(policyResponse.data || null);
    } catch (err) {
      console.error('Failed to load default policy', err);
    }
  };

  useEffect(() => {
    fetchDefaultPolicy();
  }, []);

  const getLeaveStats = () => {
    const total = leaves.length;
    const pending = leaves.filter(l => l.status === 'pending').length;
    const approved = leaves.filter(l => l.status === 'approved').length;
    const rejected = leaves.filter(l => l.status === 'rejected').length;
    const cancelled = leaves.filter(l => l.status === 'cancelled').length;
    return { total, pending, approved, rejected, cancelled };
  };

  const stats = getLeaveStats();
  const recentLeaves = leaves.slice(0, 5);

  const getDepartmentName = () => {
    const department = user?.department;
    if (!department) return null;
    return typeof department === 'object' ? (department.name || department.code || 'Department') : department;
  };

  const getDepartmentCode = () => {
    const department = user?.department;
    if (!department || typeof department !== 'object') return null;
    return department.code || null;
  };

  const balanceRows = [
    { key: 'casual', label: 'Casual', color: 'from-sky-500 to-cyan-500' },
    { key: 'sick', label: 'Sick', color: 'from-emerald-500 to-green-500' },
    { key: 'earned', label: 'Earned', color: 'from-amber-500 to-orange-500' },
    { key: 'wfh', label: 'WFH', color: 'from-fuchsia-500 to-pink-500' },
    { key: 'emergency', label: 'Emergency', color: 'from-rose-500 to-red-500' },
  ];

  const totalBalance = balanceRows.reduce((sum, row) => sum + (user?.leaveBalance?.[row.key] || 0), 0);
  const decidedCount = stats.approved + stats.rejected;
  const approvalRate = decidedCount > 0 ? Math.round((stats.approved / decidedCount) * 100) : 0;
  const pendingLeadTimeLabel = stats.pending > 0 ? `${stats.pending} pending decision` : 'No pending decisions';

  const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  };

  const getStatusBadge = (status) => {
    if (status === 'approved') return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    if (status === 'rejected') return 'bg-rose-100 text-rose-800 border border-rose-200';
    if (status === 'cancelled') return 'bg-slate-100 text-slate-700 border border-slate-200';
    return 'bg-amber-100 text-amber-800 border border-amber-200';
  };

  const toIsoDate = (value) => {
    const date = new Date(value);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const addDays = (dateValue, days) => {
    const date = new Date(dateValue);
    date.setDate(date.getDate() + days);
    return date;
  };

  const buildPlannerSuggestions = () => {
    const now = new Date();
    const suggestions = [];

    upcomingHolidays.slice(0, 5).forEach((holiday) => {
      const holidayDate = new Date(holiday.date);
      const weekday = holidayDate.getDay();

      // 1-day bridge around weekends for practical planning.
      if (weekday === 2) {
        const startDate = addDays(holidayDate, -1);
        suggestions.push({
          title: `Extend around ${holiday.name}`,
          leaveType: 'casual',
          startDate,
          endDate: startDate,
          leaveDays: 1,
          expectedBreak: 4,
          note: 'Take Monday off to create a 4-day break.'
        });
      } else if (weekday === 4) {
        const startDate = addDays(holidayDate, 1);
        suggestions.push({
          title: `Extend around ${holiday.name}`,
          leaveType: 'casual',
          startDate,
          endDate: startDate,
          leaveDays: 1,
          expectedBreak: 4,
          note: 'Take Friday off to create a 4-day break.'
        });
      } else if (weekday === 1) {
        const startDate = addDays(holidayDate, -3);
        suggestions.push({
          title: `Long weekend near ${holiday.name}`,
          leaveType: 'casual',
          startDate,
          endDate: startDate,
          leaveDays: 1,
          expectedBreak: 4,
          note: 'Take previous Friday off for an extended break.'
        });
      } else if (weekday === 5) {
        const startDate = addDays(holidayDate, 3);
        suggestions.push({
          title: `Long weekend near ${holiday.name}`,
          leaveType: 'casual',
          startDate,
          endDate: startDate,
          leaveDays: 1,
          expectedBreak: 4,
          note: 'Take next Monday off for an extended break.'
        });
      }
    });

    return suggestions
      .filter((item) => item.startDate >= now)
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, 3);
  };

  const smartSuggestions = buildPlannerSuggestions();

  const stalePendingRequests = leaves.filter((leave) => {
    if (leave.status !== 'pending') return false;
    if (!leave.createdAt) return false;
    const ageHours = (Date.now() - new Date(leave.createdAt).getTime()) / (1000 * 60 * 60);
    return ageHours >= 72;
  });

  const riskyPendingRequests = leaves.filter((leave) =>
    leave.status === 'pending' &&
    (leave.coverageAssessment?.riskLevel === 'risky' || leave.coverageAssessment?.riskLevel === 'blocked')
  );

  const getSuggestionLink = (suggestion) => {
    const reason = `Planned leave around holiday: ${suggestion.title}`;
    return `/apply-leave?leaveType=${encodeURIComponent(suggestion.leaveType)}&startDate=${encodeURIComponent(toIsoDate(suggestion.startDate))}&endDate=${encodeURIComponent(toIsoDate(suggestion.endDate))}&reason=${encodeURIComponent(reason)}`;
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchLeaves} />;

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-teal-900 to-cyan-800 text-white shadow-xl">
        <div className="absolute -top-10 -right-10 h-44 w-44 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-amber-300/20 blur-2xl" />
        <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-6 p-6 lg:p-8">
          <div className="lg:col-span-2">
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Employee Command Center</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-extrabold">Welcome, {user?.name}!</h1>
            <p className="mt-2 text-cyan-50/90 max-w-2xl">
              Keep your leave plan healthy, track approvals, and stay ahead of company events from one place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/apply-leave"
                className="inline-flex items-center rounded-lg bg-white text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-cyan-50 transition-colors"
              >
                Apply Leave
              </Link>
              <Link
                to="/leave-history"
                className="inline-flex items-center rounded-lg border border-white/40 px-4 py-2 text-sm font-semibold hover:bg-white/10 transition-colors"
              >
                Review History
              </Link>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-xl p-4 border border-white/20">
            <p className="text-xs uppercase tracking-wide text-cyan-100">Your Snapshot</p>
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs text-cyan-100/80">Department</p>
                <p className="text-lg font-semibold">{getDepartmentName() || 'Unassigned'}</p>
                {getDepartmentCode() && <p className="text-xs text-cyan-100/70">{getDepartmentCode()}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs text-cyan-100/80">Total Balance</p>
                  <p className="text-2xl font-bold">{totalBalance}</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3">
                  <p className="text-xs text-cyan-100/80">Approval Rate</p>
                  <p className="text-2xl font-bold">{approvalRate}%</p>
                </div>
              </div>
              <p className="text-xs text-cyan-100/80">{pendingLeadTimeLabel}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Leave Bank</h2>
          <p className="text-xs uppercase tracking-wide text-slate-500">Current available days</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {balanceRows.map((row) => {
            const available = user?.leaveBalance?.[row.key] || 0;
            const annual = defaultPolicy?.leaveTypes?.[row.key]?.annual;
            const utilization = annual ? Math.max(0, Math.min(100, Math.round((available / annual) * 100))) : null;

            return (
              <div key={row.key} className="rounded-xl border border-slate-200 p-4 bg-slate-50/60">
                <div className={`h-1.5 rounded-full bg-gradient-to-r ${row.color} mb-3`} />
                <p className="text-xs uppercase tracking-wide text-slate-500">{row.label}</p>
                <p className="text-3xl font-extrabold text-slate-900 mt-1">{available}</p>
                <p className="text-xs text-slate-500">days available</p>
                {annual ? (
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                      <span>Annual {annual}</span>
                      <span>{utilization}% remaining</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${row.color}`} style={{ width: `${utilization}%` }} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] text-slate-400">Policy baseline unavailable</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Salary component — base salary with leave deductions and extra pay */}
      <SalaryCard compact />

      {/* Leave coverage requests — same skill & same task peers */}
      <CoverageRequests />

      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center">
            <div className="p-3 bg-sky-100 rounded-full">
              <FiCalendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-slate-500">Total Requests</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center">
            <div className="p-3 bg-amber-100 rounded-full">
              <FiClock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.pending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-full">
              <FiCheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-slate-500">Approved</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.approved}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center">
            <div className="p-3 bg-rose-100 rounded-full">
              <FiXCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-slate-500">Rejected</p>
              <p className="text-2xl font-semibold text-slate-900">{stats.rejected}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FiZap className="text-amber-600" />
              Smart Leave Planner
            </h2>
            <span className="text-xs text-slate-500">Holiday-aware suggestions</span>
          </div>
          {smartSuggestions.length > 0 ? (
            <div className="p-6 space-y-4">
              {smartSuggestions.map((item, index) => (
                <div key={`${item.title}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <p className="text-sm text-slate-600 mt-1">{item.note}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Leave {item.leaveDays} day ({formatDate(item.startDate)}) for ~{item.expectedBreak}-day break
                  </p>
                  <Link
                    to={getSuggestionLink(item)}
                    className="inline-flex mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg bg-sky-700 text-white hover:bg-sky-800"
                  >
                    Use This Plan
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-slate-500">
              <p>No bridge-leave suggestions for upcoming holidays yet.</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FiAlertTriangle className="text-rose-600" />
              Action Alerts
            </h2>
          </div>
          <div className="p-6 space-y-3 text-sm">
            <div className={`rounded-lg p-3 ${stalePendingRequests.length > 0 ? 'bg-rose-50 border border-rose-200 text-rose-900' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'}`}>
              {stalePendingRequests.length > 0
                ? `${stalePendingRequests.length} request(s) pending for 72+ hours.`
                : 'No stale pending approvals.'}
            </div>
            <div className={`rounded-lg p-3 ${riskyPendingRequests.length > 0 ? 'bg-amber-50 border border-amber-200 text-amber-900' : 'bg-emerald-50 border border-emerald-200 text-emerald-900'}`}>
              {riskyPendingRequests.length > 0
                ? `${riskyPendingRequests.length} pending request(s) marked risky by coverage rules.`
                : 'No risky pending requests right now.'}
            </div>
            <Link to="/leave-history" className="inline-flex text-sky-700 hover:text-sky-800 font-semibold">
              Open Leave History
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Recent Leave Radar</h2>
            <Link to="/leave-history" className="text-sm text-sky-700 hover:text-sky-800 font-semibold">View all</Link>
          </div>

          {recentLeaves.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentLeaves.map((leave) => (
                <div key={leave._id} className="px-6 py-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 capitalize">{leave.leaveType} Leave</p>
                    <p className="text-sm text-slate-500 mt-1">{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</p>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{leave.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusBadge(leave.status)}`}>
                      {leave.status}
                    </span>
                    <p className="text-xs text-slate-500 mt-2">{leave.totalDays || 0} day(s)</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-slate-500">
              <p>No leave requests found yet.</p>
              <Link to="/apply-leave" className="inline-block mt-2 text-sky-700 hover:text-sky-800 font-semibold">Apply your first leave</Link>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Upcoming Holiday</h2>
            </div>
            {upcomingHolidays.length > 0 ? (
              <div className="p-6 space-y-4">
                {upcomingHolidays.slice(0, 3).map((holiday) => (
                  <div key={holiday._id} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-base font-semibold text-slate-900">{holiday.name}</p>
                    <p className="text-sm text-slate-500 mt-1">{formatDate(holiday.date)} • {holiday.type}</p>
                    {holiday.description && <p className="text-sm text-slate-600 mt-2">{holiday.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-slate-500">
                <p>No upcoming holidays announced.</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FiFileText className="text-sky-700" />
                Policy Highlights
              </h2>
              <button onClick={fetchDefaultPolicy} className="text-sm text-sky-700 hover:text-sky-800 font-semibold">Refresh</button>
            </div>

            {defaultPolicy?.leaveTypes ? (
              <div className="p-6 space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Casual / year</span><span className="font-semibold text-slate-900">{defaultPolicy.leaveTypes.casual?.annual ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Sick / year</span><span className="font-semibold text-slate-900">{defaultPolicy.leaveTypes.sick?.annual ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Earned / year</span><span className="font-semibold text-slate-900">{defaultPolicy.leaveTypes.earned?.annual ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">WFH / year</span><span className="font-semibold text-slate-900">{defaultPolicy.leaveTypes.wfh?.annual ?? '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Emergency / year</span><span className="font-semibold text-slate-900">{defaultPolicy.leaveTypes.emergency?.annual ?? '-'}</span></div>
                <div className="pt-3 border-t border-slate-100 text-xs text-slate-500">Policy: {defaultPolicy.name}</div>
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-slate-500"><p>No active default policy found.</p></div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <FiBell className="text-blue-600" />
              Company Updates
            </h2>
            <button
              onClick={fetchCompanyFeed}
              className="text-sm text-sky-700 hover:text-sky-800 font-semibold"
            >
              Refresh
            </button>
          </div>

          {companyUpdates.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {companyUpdates.map((item) => (
                <div key={item._id} className="px-6 py-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
                  <div>
                    <p className="font-semibold text-slate-900">{item.title}</p>
                    <p className="text-sm text-slate-600 mt-1">{item.message}</p>
                  </div>
                  <p className="text-xs text-slate-400">
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-slate-500">
              <p>No company updates yet.</p>
            </div>
          )}
      </section>
    </div>
  );
};

export default EmployeeDashboard;
