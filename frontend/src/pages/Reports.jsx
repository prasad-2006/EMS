import React, { useState, useEffect, useMemo } from 'react';
import { getLeaveAnalytics, getLeaveTrends, getLeaveConflicts } from '../services/analyticsService';
import { getExecutiveSummary, getLeavePatternPredictions } from '../services/analyticsService';
import { getAllDepartments } from '../services/departmentService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import { format, startOfYear, endOfYear } from 'date-fns';
import { LEAVE_TYPE_LABELS } from '../utils/constants';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

const LEAVE_TYPE_COLORS = {
  casual: { main: '#6366f1', light: '#a5b4fc', gradient: ['#6366f1', '#818cf8'] },
  sick: { main: '#f43f5e', light: '#fda4af', gradient: ['#f43f5e', '#fb7185'] },
  earned: { main: '#10b981', light: '#6ee7b7', gradient: ['#10b981', '#34d399'] },
  wfh: { main: '#f59e0b', light: '#fcd34d', gradient: ['#f59e0b', '#fbbf24'] },
  emergency: { main: '#8b5cf6', light: '#c4b5fd', gradient: ['#8b5cf6', '#a78bfa'] },
};

const STATUS_CONFIG = {
  approved: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-800', icon: 'M5 13l4 4L19 7' },
  rejected: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800', icon: 'M6 18L18 6M6 6l12 12' },
  pending: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  cancelled: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', badge: 'bg-gray-100 text-gray-800', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636' },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((sum, p) => sum + (p.value || 0), 0);
  return (
    <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-xl p-4 min-w-[180px]">
      <p className="font-semibold text-gray-800 text-sm mb-2 border-b pb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-xs text-gray-600">{entry.name}</span>
          </div>
          <span className="text-xs font-bold text-gray-800 ml-4">{entry.value}</span>
        </div>
      ))}
      <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
        <span className="text-xs font-semibold text-gray-700">Total</span>
        <span className="text-sm font-bold text-gray-900">{total}</span>
      </div>
    </div>
  );
};

const StatCard = ({ value, label, color, icon }) => (
  <div className={`relative overflow-hidden bg-white rounded-2xl shadow-sm border border-gray-100 p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
    <div className={`absolute top-0 right-0 w-20 h-20 -mr-4 -mt-4 rounded-full opacity-10 ${color}`} />
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${color} bg-opacity-10 flex items-center justify-center`}>
        <svg className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  </div>
);

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [trends, setTrends] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [chartView, setChartView] = useState('area');
  const [executiveSummary, setExecutiveSummary] = useState(null);
  const [predictions, setPredictions] = useState([]);

  const [filters, setFilters] = useState({
    startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfYear(new Date()), 'yyyy-MM-dd'),
    departmentId: '',
    leaveType: ''
  });

  useEffect(() => {
    fetchDepartments();
    fetchData();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await getAllDepartments();
      setDepartments(response.data || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, trendsRes, conflictsRes] = await Promise.all([
        getLeaveAnalytics(filters),
        getLeaveTrends(new Date().getFullYear()),
        getLeaveConflicts(filters.departmentId ? { departmentId: filters.departmentId } : {})
      ]);
      const [summaryRes, predictionsRes] = await Promise.all([
        getExecutiveSummary(),
        getLeavePatternPredictions()
      ]);
      setAnalytics(analyticsRes.data);
      setTrends(trendsRes.data || []);
      setConflicts(conflictsRes.data || []);
      setExecutiveSummary(summaryRes.data || null);
      setPredictions(predictionsRes.data || []);
      setError('');
    } catch (err) {
      setError(err.error || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleApplyFilters = () => {
    fetchData();
  };

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Transform trends data into chart-ready format
  const chartData = useMemo(() => {
    const leaveTypes = [...new Set(trends.map(t => t._id.leaveType))];
    return monthNames.map((month, idx) => {
      const monthData = trends.filter(t => t._id.month === idx + 1);
      const row = { month };
      leaveTypes.forEach(type => {
        const found = monthData.find(t => t._id.leaveType === type);
        row[type] = found ? found.count : 0;
      });
      row.total = monthData.reduce((sum, t) => sum + t.count, 0);
      return row;
    });
  }, [trends]);

  const activeLeaveTypes = useMemo(() => {
    return [...new Set(trends.map(t => t._id.leaveType))];
  }, [trends]);

  // Pie chart data for leave type distribution
  const pieData = useMemo(() => {
    const typeMap = {};
    trends.forEach(t => {
      typeMap[t._id.leaveType] = (typeMap[t._id.leaveType] || 0) + t.count;
    });
    return Object.entries(typeMap).map(([type, count]) => ({
      name: LEAVE_TYPE_LABELS[type] || type,
      value: count,
      color: LEAVE_TYPE_COLORS[type]?.main || '#94a3b8',
    }));
  }, [trends]);

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Leave Reports & Analytics</h1>
        <p className="text-gray-500 mt-1">Comprehensive insights into leave patterns and trends</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-gray-600 mb-1.5 text-xs font-semibold uppercase tracking-wide">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1.5 text-xs font-semibold uppercase tracking-wide">End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            />
          </div>
          <div>
            <label className="block text-gray-600 mb-1.5 text-xs font-semibold uppercase tracking-wide">Department</label>
            <select
              name="departmentId"
              value={filters.departmentId}
              onChange={handleFilterChange}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept._id} value={dept._id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleApplyFilters}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all text-sm font-semibold shadow-sm"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {error && <ErrorMessage message={error} />}

      {analytics && (
        <>
          {executiveSummary && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500">YTD Approved Leaves</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{executiveSummary.yearToDateMetrics?.totalLeavesApproved || 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500">Pending Approvals</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{executiveSummary.yearToDateMetrics?.pendingApprovals || 0}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                <p className="text-xs uppercase tracking-wide text-gray-500">System Risk Level</p>
                <p className={`text-2xl font-bold mt-1 ${executiveSummary.systemHealth?.overallRiskLevel === 'ELEVATED' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {executiveSummary.systemHealth?.overallRiskLevel || 'NORMAL'}
                </p>
              </div>
            </div>
          )}
          {/* Overall Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <StatCard value={analytics.overall.totalRequests} label="Total Requests" color="bg-indigo-500" icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            <StatCard value={analytics.overall.approvedRequests} label="Approved" color="bg-emerald-500" icon="M5 13l4 4L19 7" />
            <StatCard value={analytics.overall.rejectedRequests} label="Rejected" color="bg-red-500" icon="M6 18L18 6M6 6l12 12" />
            <StatCard value={analytics.overall.pendingRequests} label="Pending" color="bg-amber-500" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            <StatCard value={analytics.overall.totalDays} label="Total Days" color="bg-blue-500" icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </div>

          {/* Monthly Trends + Pie Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-8">
                  <h2 className="text-lg font-bold text-gray-900 mb-4">Frequent Leave Pattern Predictions</h2>
                  {predictions.length === 0 ? (
                    <p className="text-sm text-gray-500">No pattern data available yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Employee</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Frequency</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Avg Duration</th>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Likely Next Month</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {predictions.slice(0, 8).map((item) => (
                            <tr key={item.employeeId}>
                              <td className="px-4 py-2 text-sm text-gray-900">{item.name}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{item.leaveFrequency}</td>
                              <td className="px-4 py-2 text-sm text-gray-700">{item.avgDuration}</td>
                              <td className="px-4 py-2 text-sm text-indigo-700 font-medium">{item.predictedNextLeaveMonth}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                  <h2 className="text-lg font-bold text-gray-900">Monthly Leave Trends</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{new Date().getFullYear()} - Approved leaves by type</p>
                </div>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setChartView('area')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      chartView === 'area' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Area
                  </button>
                  <button
                    onClick={() => setChartView('bar')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      chartView === 'bar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Bar
                  </button>
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  {chartView === 'area' ? (
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        {activeLeaveTypes.map(type => (
                          <linearGradient key={type} id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={LEAVE_TYPE_COLORS[type]?.main || '#94a3b8'} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={LEAVE_TYPE_COLORS[type]?.main || '#94a3b8'} stopOpacity={0.02} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 500 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                        formatter={(value) => <span className="text-gray-600 text-xs ml-1">{LEAVE_TYPE_LABELS[value] || value}</span>}
                      />
                      {activeLeaveTypes.map(type => (
                        <Area
                          key={type}
                          type="monotone"
                          dataKey={type}
                          name={type}
                          stroke={LEAVE_TYPE_COLORS[type]?.main || '#94a3b8'}
                          strokeWidth={2.5}
                          fill={`url(#gradient-${type})`}
                          dot={{ r: 3, fill: LEAVE_TYPE_COLORS[type]?.main || '#94a3b8', strokeWidth: 0 }}
                          activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }}
                        />
                      ))}
                    </AreaChart>
                  ) : (
                    <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }} barCategoryGap="20%">
                      <defs>
                        {activeLeaveTypes.map(type => (
                          <linearGradient key={type} id={`bar-gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={LEAVE_TYPE_COLORS[type]?.gradient?.[0] || '#94a3b8'} />
                            <stop offset="100%" stopColor={LEAVE_TYPE_COLORS[type]?.gradient?.[1] || '#94a3b8'} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 500 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#94a3b8' }}
                        allowDecimals={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }}
                        formatter={(value) => <span className="text-gray-600 text-xs ml-1">{LEAVE_TYPE_LABELS[value] || value}</span>}
                      />
                      {activeLeaveTypes.map(type => (
                        <Bar
                          key={type}
                          dataKey={type}
                          name={type}
                          fill={`url(#bar-gradient-${type})`}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={32}
                        />
                      ))}
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart - Leave Type Distribution */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Leave Distribution</h2>
              <p className="text-xs text-gray-500 mb-4">By leave type</p>

              {pieData.length > 0 ? (
                <>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const d = payload[0].payload;
                            return (
                              <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-3">
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                                  <span className="text-xs font-semibold text-gray-800">{d.name}</span>
                                </div>
                                <p className="text-lg font-bold text-gray-900 mt-1">{d.value} <span className="text-xs font-normal text-gray-500">requests</span></p>
                              </div>
                            );
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2.5 mt-2">
                    {pieData.map((entry, i) => {
                      const total = pieData.reduce((sum, e) => sum + e.value, 0);
                      const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                            <span className="text-xs text-gray-600 truncate">{entry.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800">{entry.value}</span>
                            <span className="text-[10px] text-gray-400 w-8 text-right">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="h-52 flex items-center justify-center text-sm text-gray-400">No data available</div>
              )}
            </div>
          </div>

          {/* Leave Breakdown by Status & Type */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Leave Breakdown by Status & Type</h2>
            <p className="text-xs text-gray-500 mb-5">Request counts and days grouped by approval status</p>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {analytics.byStatusAndType.map((item) => {
                const config = STATUS_CONFIG[item._id] || STATUS_CONFIG.cancelled;
                return (
                  <div key={item._id} className={`rounded-xl border ${config.border} ${config.bg} p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <svg className={`w-4 h-4 ${config.text}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
                      </svg>
                      <span className={`text-xs font-bold uppercase tracking-wide ${config.text}`}>{item._id}</span>
                    </div>
                    <div className="flex gap-4 mb-3">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{item.totalRequests}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Requests</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{item.totalDays}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Days</p>
                      </div>
                    </div>
                    <div className="space-y-1.5 pt-3 border-t border-gray-200/50">
                      {item.leaveTypes.map((lt, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: LEAVE_TYPE_COLORS[lt.type]?.main || '#94a3b8' }} />
                            <span className="text-xs text-gray-600">{LEAVE_TYPE_LABELS[lt.type] || lt.type}</span>
                          </div>
                          <span className="text-xs text-gray-800 font-medium">{lt.count} ({lt.totalDays}d)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Conflicts */}
          {conflicts.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-lg font-bold text-gray-900">Leave Conflicts</h2>
              </div>
              <p className="text-xs text-gray-500 mb-5">Days with 3 or more employees on leave simultaneously</p>
              <div className="space-y-3">
                {conflicts.map((conflict, idx) => (
                  <div key={idx} className="flex items-start gap-4 border border-orange-200 bg-orange-50 rounded-xl p-4 hover:bg-orange-100/50 transition-colors">
                    <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-orange-700 leading-none">{format(new Date(conflict.date), 'dd')}</span>
                      <span className="text-[10px] text-orange-600 uppercase">{format(new Date(conflict.date), 'MMM')}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900">{format(new Date(conflict.date), 'EEEE, MMM dd, yyyy')}</span>
                        <span className="bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-full">{conflict.employeeCount} people</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1.5 truncate">
                        {conflict.employees.map(e => e.employee).join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Reports;
