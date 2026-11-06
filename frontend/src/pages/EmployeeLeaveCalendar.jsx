import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { getMyLeaves } from '../services/leaveService';
import { getAllHolidays, getUpcomingHolidays } from '../services/holidayService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';

const EmployeeLeaveCalendar = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [leaves, setLeaves] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [holidayLoading, setHolidayLoading] = useState(false);
  const [error, setError] = useState('');
  const [holidayError, setHolidayError] = useState('');

  useEffect(() => {
    fetchLeaveData();
  }, []);

  useEffect(() => {
    fetchHolidayData(currentMonth.getFullYear());
  }, [currentMonth]);

  const getErrorMessage = (err, fallback) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    );
  };

  const normalizeHolidayList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const fetchLeaveData = async () => {
    try {
      setLoading(true);
      const leaveRes = await getMyLeaves({ page: 1, limit: 300 });
      setLeaves(leaveRes.data || []);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load leave calendar'));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHolidayData = async (year) => {
    try {
      setHolidayLoading(true);
      const holidayRes = await getAllHolidays({ limit: 200, isActive: true, year });
      setHolidays(normalizeHolidayList(holidayRes));
      setHolidayError('');
    } catch (err) {
      try {
        // Fallback so calendar stays useful even if full holiday query fails.
        const fallbackRes = await getUpcomingHolidays(100);
        setHolidays(normalizeHolidayList(fallbackRes));
        setHolidayError('Holiday list partially loaded (upcoming only).');
      } catch (fallbackErr) {
        setHolidays([]);
        setHolidayError(getErrorMessage(fallbackErr, 'Failed to load holidays for calendar.'));
      }
    } finally {
      setHolidayLoading(false);
    }
  };

  const fetchCalendarData = async () => {
    await Promise.all([fetchLeaveData(), fetchHolidayData(currentMonth.getFullYear())]);
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  const toDateKey = (value) => format(value, 'yyyy-MM-dd');

  const leaveByDate = useMemo(() => {
    const map = new Map();

    leaves.forEach((leave) => {
      if (!leave.startDate || !leave.endDate) return;
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      for (let day = start; day <= end; day = addDays(day, 1)) {
        const key = toDateKey(day);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(leave);
      }
    });

    return map;
  }, [leaves]);

  const holidayByDate = useMemo(() => {
    const map = new Map();
    const year = currentMonth.getFullYear();

    holidays.forEach((holiday) => {
      if (holiday.isActive === false || !holiday.date) return;
      const rawDate = new Date(holiday.date);
      const dateForCalendar = holiday.isRecurring
        ? new Date(year, rawDate.getMonth(), rawDate.getDate())
        : rawDate;
      const key = toDateKey(dateForCalendar);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...holiday, calendarDate: dateForCalendar });
    });

    return map;
  }, [holidays, currentMonth]);

  const selectedKey = toDateKey(selectedDate);
  const selectedLeaves = leaveByDate.get(selectedKey) || [];
  const selectedHolidays = holidayByDate.get(selectedKey) || [];

  const getLeaveStatusCount = (dayLeaves, status) => dayLeaves.filter((leave) => leave.status === status).length;

  const dayMeta = (day) => {
    const key = toDateKey(day);
    const dayLeaves = leaveByDate.get(key) || [];
    const dayHolidays = holidayByDate.get(key) || [];

    return {
      leaves: dayLeaves,
      holidays: dayHolidays,
      pending: getLeaveStatusCount(dayLeaves, 'pending'),
      approved: getLeaveStatusCount(dayLeaves, 'approved'),
      rejected: getLeaveStatusCount(dayLeaves, 'rejected'),
      cancelled: getLeaveStatusCount(dayLeaves, 'cancelled')
    };
  };

  const monthlySummary = useMemo(() => {
    const monthLeaveDays = new Set();
    const monthPending = [];

    leaves.forEach((leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);

      for (let day = start; day <= end; day = addDays(day, 1)) {
        if (isSameMonth(day, currentMonth) && leave.status === 'approved') {
          monthLeaveDays.add(toDateKey(day));
        }
      }

      if (
        leave.status === 'pending' &&
        (isSameMonth(start, currentMonth) || isSameMonth(end, currentMonth))
      ) {
        monthPending.push(leave);
      }
    });

    const monthHolidayCount = Array.from(holidayByDate.keys()).filter((key) => {
      const date = new Date(key);
      return isSameMonth(date, currentMonth);
    }).length;

    return {
      approvedLeaveDays: monthLeaveDays.size,
      pendingRequests: monthPending.length,
      holidayDays: monthHolidayCount
    };
  }, [leaves, currentMonth, holidayByDate]);

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchCalendarData} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {holidayError && (
        <ErrorMessage message={holidayError} onRetry={() => fetchHolidayData(currentMonth.getFullYear())} />
      )}

      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-sky-900 to-cyan-800 text-white p-6 shadow-lg">
        <h1 className="text-3xl font-bold">Personal Leave Calendar</h1>
        <p className="text-sky-100 mt-1">Plan smarter with your leave timeline, holiday overlap, and request statuses.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Approved Leave Days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{monthlySummary.approvedLeaveDays}</p>
          <p className="text-xs text-gray-500">In {format(currentMonth, 'MMMM yyyy')}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pending Requests</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{monthlySummary.pendingRequests}</p>
          <p className="text-xs text-gray-500">Decision expected from managers</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Holiday Days</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{monthlySummary.holidayDays}</p>
          <p className="text-xs text-gray-500">Official holidays in this month</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Previous
            </button>
            <h2 className="text-lg font-bold text-gray-900">{format(currentMonth, 'MMMM yyyy')}</h2>
            <button
              type="button"
              onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
            >
              Next
            </button>
          </div>

          {holidayLoading && (
            <p className="text-xs text-gray-500 mb-2">Refreshing holidays for this month...</p>
          )}

          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
              <div key={dayName} className="text-xs font-semibold text-gray-500 text-center py-1">
                {dayName}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day) => {
              const meta = dayMeta(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = isSameDay(day, selectedDate);

              return (
                <button
                  key={toDateKey(day)}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={`min-h-[108px] rounded-lg border p-2 text-left transition-colors ${
                    isSelected
                      ? 'border-sky-500 bg-sky-50'
                      : isCurrentMonth
                        ? 'border-gray-200 bg-white hover:bg-gray-50'
                        : 'border-gray-100 bg-gray-50 text-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-semibold ${isToday(day) ? 'text-sky-700' : 'text-gray-800'}`}>
                      {format(day, 'd')}
                    </span>
                    {isToday(day) && <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">Today</span>}
                  </div>

                  <div className="space-y-1">
                    {meta.holidays.length > 0 && (
                      <div className="text-[11px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 truncate">
                        Holiday
                      </div>
                    )}
                    {meta.approved > 0 && (
                      <div className="text-[11px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        Approved {meta.approved}
                      </div>
                    )}
                    {meta.pending > 0 && (
                      <div className="text-[11px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Pending {meta.pending}
                      </div>
                    )}
                    {meta.rejected > 0 && (
                      <div className="text-[11px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                        Rejected {meta.rejected}
                      </div>
                    )}
                    {meta.cancelled > 0 && (
                      <div className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                        Cancelled {meta.cancelled}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h3 className="text-lg font-bold text-gray-900">{format(selectedDate, 'EEE, MMM dd, yyyy')}</h3>
          <p className="text-xs text-gray-500 mt-1">Day details and quick actions</p>

          <div className="mt-4 space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Holiday</h4>
              {selectedHolidays.length > 0 ? (
                <div className="space-y-2">
                  {selectedHolidays.map((holiday) => (
                    <div key={holiday._id} className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                      <p className="text-sm font-semibold text-purple-900">{holiday.name}</p>
                      <p className="text-xs text-purple-700 mt-1">{holiday.type}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No holiday on this date.</p>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Your Leave Requests</h4>
              {selectedLeaves.length > 0 ? (
                <div className="space-y-2">
                  {selectedLeaves.map((leave) => (
                    <div key={`${leave._id}-${toDateKey(selectedDate)}`} className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-semibold text-gray-900 capitalize">{leave.leaveType} Leave</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd')}
                      </p>
                      <span className={`inline-block mt-2 text-[11px] px-2 py-0.5 rounded-full ${
                        leave.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : leave.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : leave.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-700'
                              : 'bg-amber-100 text-amber-800'
                      }`}>
                        {leave.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No leave entries on this date.</p>
              )}
            </div>

            <div className="pt-2 border-t border-gray-100">
              <Link
                to={`/apply-leave?startDate=${toDateKey(selectedDate)}&endDate=${toDateKey(selectedDate)}&leaveType=casual&reason=${encodeURIComponent('Planned leave from calendar')}`}
                className="inline-flex w-full justify-center px-4 py-2 bg-sky-700 text-white rounded-lg text-sm font-semibold hover:bg-sky-800"
              >
                Apply Leave For This Date
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-purple-100 text-purple-800">Holiday</span>
          <span className="px-2 py-1 rounded bg-emerald-100 text-emerald-800">Approved</span>
          <span className="px-2 py-1 rounded bg-amber-100 text-amber-800">Pending</span>
          <span className="px-2 py-1 rounded bg-rose-100 text-rose-800">Rejected</span>
          <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">Cancelled</span>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLeaveCalendar;
