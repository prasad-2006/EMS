import React, { useEffect, useState } from 'react';
import { getAllLeaves } from '../services/leaveService';
import { getTeamWorkload } from '../services/handoverService';
import { getCoverageRisks, getAvailableEmployees } from '../services/analyticsService';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import { format, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

const ManagerDashboard = () => {
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workloadData, setWorkloadData] = useState([]);
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [coverageRisks, setCoverageRisks] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);

  useEffect(() => {
    fetchManagerRequests();
    fetchWorkload();
    fetchRiskSignals();
  }, []);

  const fetchRiskSignals = async () => {
    try {
      const [riskRes, availabilityRes] = await Promise.all([
        getCoverageRisks(30),
        getAvailableEmployees({
          dateStart: new Date().toISOString(),
          dateEnd: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString()
        })
      ]);
      setCoverageRisks(riskRes?.data || []);
      setAvailableEmployees(availabilityRes?.data || []);
    } catch (err) {
      console.error('Failed to load risk signals:', err);
    }
  };

  const fetchWorkload = async () => {
    try {
      setWorkloadLoading(true);
      const response = await getTeamWorkload();
      if (response.success) {
        setWorkloadData(response.data || []);
      }
    } catch (err) {
      console.error('Failed to load workload:', err);
    } finally {
      setWorkloadLoading(false);
    }
  };

  const fetchManagerRequests = async () => {
    try {
      setLoading(true);
      const response = await getAllLeaves({ limit: 500 });
      const allRequests = response.data || [];
      setLeaveRequests(allRequests);
      setError(null);
    } catch (err) {
      setError('Failed to load requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pendingRequests = leaveRequests.filter((r) => r.status === 'pending');
  const myTeamRequests = leaveRequests.filter((r) => 
    r.userId?._id && pendingRequests.some((p) => p._id === r._id)
  );

  const calculateSLAStatus = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const hoursPassed = (now - created) / (1000 * 60 * 60);

    if (hoursPassed > 48) return { level: 'breached', label: 'SLA Breached', hours: Math.floor(hoursPassed) };
    if (hoursPassed > 24) return { level: 'warning', label: 'SLA Warning', hours: Math.floor(hoursPassed) };
    return { level: 'ok', label: 'On Track', hours: Math.floor(hoursPassed) };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 border-amber-200';
      case 'approved': return 'bg-emerald-50 border-emerald-200';
      case 'rejected': return 'bg-red-50 border-red-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getSLAColor = (level) => {
    switch (level) {
      case 'breached': return 'text-red-800 bg-red-100';
      case 'warning': return 'text-amber-800 bg-amber-100';
      default: return 'text-emerald-800 bg-emerald-100';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-900 via-purple-900 to-pink-800 p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Manager Command Center</h1>
            <p className="text-indigo-100 mt-1 text-sm">Review team leave requests and coverage impact.</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-indigo-100">Team Lead</p>
            <p className="text-xl font-semibold">{user?.name}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm text-gray-500">Pending Approvals</p>
              <p className="text-3xl font-bold text-amber-600">{pendingRequests.length}</p>
            </div>
            <div className="p-3 bg-amber-100 rounded-lg">
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm text-gray-500">Team On Leave</p>
              <p className="text-3xl font-bold text-blue-600">
                {leaveRequests.filter((r) => r.status === 'approved' && new Date(r.startDate) <= new Date() && new Date(r.endDate) >= new Date()).length}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm text-gray-500">SLA Breached</p>
              <p className="text-3xl font-bold text-red-600">
                {pendingRequests.filter((r) => calculateSLAStatus(r.createdAt).level === 'breached').length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm text-gray-500">Avg Response</p>
              <p className="text-3xl font-bold text-emerald-600">
                {pendingRequests.length > 0 
                  ? Math.round(pendingRequests.reduce((sum, r) => sum + calculateSLAStatus(r.createdAt).hours, 0) / pendingRequests.length)
                  : 0}h
              </p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-lg">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Requests */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Approval Queue</h3>
        <div className="space-y-3">
          {pendingRequests.length > 0 ? (
            pendingRequests.slice(0, 10).map((leave) => {
              const slaStatus = calculateSLAStatus(leave.createdAt);
              
              return (
                <div
                  key={leave._id}
                  className={`p-4 border-l-4 ${getStatusColor(leave.status)} flex flex-col md:flex-row md:items-center md:justify-between gap-4`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <p className="font-semibold text-gray-900">{leave.userId?.name || 'Unknown'}</p>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                        {leave.leaveType}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getSLAColor(slaStatus.level)}`}>
                        {slaStatus.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')} • {leave.totalDays} days
                    </p>
                    {leave.coverageAssessment && (
                      <p className={`text-xs font-medium ${
                        leave.coverageAssessment.riskLevel === 'blocked'
                          ? 'text-red-700'
                          : leave.coverageAssessment.riskLevel === 'risky'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                      }`}>
                        Coverage: {leave.coverageAssessment.projectedCoveragePercentage}% | {leave.coverageAssessment.reason}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Reason: {leave.reason}</p>
                  </div>

                  <div className="flex flex-col gap-2 md:w-auto">
                    <button className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 font-medium transition-colors">
                      Approve
                    </button>
                    <button className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 font-medium transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-gray-500">
              <p>No pending requests at this moment.</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Team Leave</h3>
          <div className="space-y-3">
            {leaveRequests
              .filter((r) => r.status === 'approved' && new Date(r.startDate) > new Date())
              .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
              .slice(0, 5)
              .map((leave) => (
                <div key={leave._id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900">{leave.userId?.name}</p>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {leave.leaveType}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd')} ({leave.totalDays}d)
                  </p>
                </div>
              ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Response Performance</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Approved (24h)</span>
              <span className="font-semibold text-emerald-700">
                {leaveRequests.filter((r) => r.status === 'approved' && calculateSLAStatus(r.createdAt).hours <= 24).length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-emerald-600 h-2 rounded-full"
                style={{
                  width: `${leaveRequests.length > 0 ? (leaveRequests.filter((r) => r.status === 'approved' && calculateSLAStatus(r.createdAt).hours <= 24).length / leaveRequests.length) * 100 : 0}%`,
                }}
              ></div>
            </div>

            {/* Team Workload Section */}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Team Workload
              </h4>
              {workloadLoading ? (
                <div className="text-sm text-gray-500">Loading workload data...</div>
              ) : workloadData.length > 0 ? (
                <div className="space-y-2">
                  {workloadData.slice(0, 5).map((member) => (
                    <div key={member.user?._id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{member.user?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{member.totalTasks} tasks</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-semibold ${
                          member.availabilityScore > 70 ? 'text-green-600' :
                          member.availabilityScore > 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {member.availabilityScore}% available
                        </div>
                        <div className="text-xs text-gray-500">
                          {member.criticalTasks > 0 && <span className="text-red-500">{member.criticalTasks} critical</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No workload data available</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Coverage Risk Signals (30 Days)</h3>
          {coverageRisks.length === 0 ? (
            <p className="text-sm text-gray-500">No elevated department coverage risks detected.</p>
          ) : (
            <div className="space-y-3">
              {coverageRisks.slice(0, 6).map((risk, idx) => (
                <div key={idx} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-900">{risk.name}</p>
                    <p className="text-xs text-gray-500">On leave: {risk.onLeave}/{risk.totalEmployees}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${risk.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' : risk.riskLevel === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {risk.coveragePercentage}% ({risk.riskLevel})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Available Backup Capacity (Next 7 Days)</h3>
          {availableEmployees.length === 0 ? (
            <p className="text-sm text-gray-500">No availability data currently returned.</p>
          ) : (
            <div className="space-y-3">
              {availableEmployees.slice(0, 6).map((emp) => (
                <div key={emp.userId || emp._id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                  <div>
                    <p className="font-medium text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.email}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                    {emp.daysAvailable || 0}d available
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboard;
