import React, { useEffect, useState } from 'react';
import { FiDollarSign, FiTrendingDown, FiTrendingUp, FiCalendar } from 'react-icons/fi';
import salaryService from '../../services/salaryService';
import LoadingSpinner from '../Common/LoadingSpinner';

/**
 * Salary component for employees — shows the monthly base salary (assigned by
 * admin), deductions based on the number of leave days taken in the month,
 * extra pay earned by covering tasks for colleagues on leave, and the net pay.
 */
const SalaryCard = ({ compact = false }) => {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSalary = async () => {
    try {
      setLoading(true);
      const response = await salaryService.getMySalary();
      setReport(response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load salary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalary();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center justify-center">
        <LoadingSpinner label="Loading salary..." />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 text-center text-slate-500">
        <p>{error || 'Salary information unavailable.'}</p>
        <button onClick={fetchSalary} className="mt-2 text-sm text-sky-700 hover:text-sky-800 font-semibold">
          Retry
        </button>
      </div>
    );
  }

  const formatMoney = (value) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: report.currency || 'INR', maximumFractionDigits: 0 }).format(value || 0);

  const monthLabel = report.month
    ? new Date(`${report.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : 'This month';

  if (compact) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FiDollarSign className="text-emerald-600" />
            My Salary
          </h2>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <FiCalendar size={12} /> {monthLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Base / Month</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{formatMoney(report.monthlyBase)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-500 flex items-center gap-1">
              <FiTrendingDown size={11} /> Leave Deduction
            </p>
            <p className="text-lg font-bold text-rose-700 mt-1">-{formatMoney(report.leaveDeduction)}</p>
            <p className="text-[10px] text-rose-400">{report.leaveDays} leave day(s)</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-600 flex items-center gap-1">
              <FiTrendingUp size={11} /> Extra Pay
            </p>
            <p className="text-lg font-bold text-emerald-700 mt-1">+{formatMoney(report.extraPay)}</p>
            <p className="text-[10px] text-emerald-500">{report.coverageTaskCount} covered task(s)</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-600 text-white p-3">
            <p className="text-xs text-emerald-100">Net Pay</p>
            <p className="text-lg font-bold mt-1">{formatMoney(report.netPay)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <FiDollarSign className="text-emerald-600" />
          Salary & Earnings
        </h2>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <FiCalendar size={12} /> {monthLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-600">Monthly Base Salary</span>
            <span className="text-lg font-bold text-slate-900">{formatMoney(report.monthlyBase)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-sm text-slate-600">Per Day Rate</span>
            <span className="font-semibold text-slate-800">{formatMoney(report.perDayRate)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
            <span className="text-sm text-rose-600 flex items-center gap-1.5">
              <FiTrendingDown size={14} />
              Leave Days ({report.leaveDays})
            </span>
            <span className="text-lg font-bold text-rose-700">-{formatMoney(report.leaveDeduction)}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="text-sm text-emerald-600 flex items-center gap-1.5">
              <FiTrendingUp size={14} />
              Extra Pay ({report.coverageTaskCount} covered task(s))
            </span>
            <span className="text-lg font-bold text-emerald-700">+{formatMoney(report.extraPay)}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-100">Net Pay for {monthLabel}</p>
          <p className="text-2xl font-extrabold mt-1">{formatMoney(report.netPay)}</p>
        </div>
        <button
          onClick={fetchSalary}
          className="text-xs font-semibold bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg transition-colors"
        >
          Refresh
        </button>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Deductions are based on approved leave days ({report.leaveDays} day(s) this month). Extra pay is earned per
        task accepted for coverage while a colleague is on leave.
      </p>
    </div>
  );
};

export default SalaryCard;