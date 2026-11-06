import React, { useState, useEffect } from 'react';
import { getTeamAvailability, getDepartmentAvailability } from '../services/analyticsService';
import { getAvailableEmployees } from '../services/analyticsService';
import { getAllDepartments } from '../services/departmentService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import { format, addDays } from 'date-fns';

const TeamAvailability = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [availabilityData, setAvailabilityData] = useState(null);
  const [departmentData, setDepartmentData] = useState([]);
  const [availableEmployees, setAvailableEmployees] = useState([]);

  useEffect(() => {
    fetchDepartments();
    fetchDepartmentAvailability();
  }, []);

  const fetchDepartments = async () => {
    try {
      const response = await getAllDepartments();
      setDepartments(response.data || []);
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const fetchDepartmentAvailability = async () => {
    try {
      const response = await getDepartmentAvailability();
      setDepartmentData(response.data || []);
    } catch (err) {
      console.error('Failed to fetch department availability:', err);
    }
  };

  const fetchTeamAvailability = async () => {
    try {
      setLoading(true);
      const params = { startDate, endDate };
      if (selectedDepartment) {
        params.departmentId = selectedDepartment;
      }
      const [response, availableRes] = await Promise.all([
        getTeamAvailability(params),
        getAvailableEmployees({
          dateStart: startDate,
          dateEnd: endDate,
          department: selectedDepartment || undefined
        })
      ]);
      setAvailabilityData(response.data);
      setAvailableEmployees(availableRes.data || []);
      setError('');
    } catch (err) {
      setError(err.error || 'Failed to fetch team availability');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTeamAvailability();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Team Availability</h1>

      {/* Department Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {departmentData.map((dept) => (
          <div key={dept.department.id} className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-gray-800 mb-2">{dept.department.name}</h3>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{dept.availableEmployees}</p>
                <p className="text-xs text-gray-500">Available</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{dept.onLeave}</p>
                <p className="text-xs text-gray-500">On Leave</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600">{dept.totalEmployees}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-gray-700 mb-2 text-sm">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-2 text-sm">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-2 text-sm">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {error && <ErrorMessage message={error} />}

      {loading ? (
        <LoadingSpinner />
      ) : availabilityData ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded">
              <p className="text-3xl font-bold text-gray-800">{availabilityData.totalEmployees}</p>
              <p className="text-sm text-gray-600">Total Employees</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded">
              <p className="text-3xl font-bold text-green-600">{availabilityData.availableEmployees}</p>
              <p className="text-sm text-gray-600">Available</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded">
              <p className="text-3xl font-bold text-orange-600">{availabilityData.onLeaveCount}</p>
              <p className="text-sm text-gray-600">On Leave</p>
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-800 mb-4">Employees on Leave</h3>
          {availabilityData.leaves && availabilityData.leaves.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {availabilityData.leaves.map((leave) => (
                    <tr key={leave._id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {leave.userId?.name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                          {leave.leaveType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {format(new Date(leave.startDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {format(new Date(leave.endDate), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {leave.totalDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No employees on leave during this period</p>
          )}

          <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">Available Employees (Planning Pool)</h3>
          {availableEmployees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availableEmployees.slice(0, 12).map((emp) => (
                <div key={emp.userId || emp._id} className="border border-gray-100 rounded-lg p-3">
                  <p className="font-medium text-gray-900">{emp.name}</p>
                  <p className="text-xs text-gray-500">{emp.email}</p>
                  <p className="text-xs mt-1 text-emerald-700">{emp.daysAvailable || 0} day(s) available</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No availability pool found for selected filters.</p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default TeamAvailability;
