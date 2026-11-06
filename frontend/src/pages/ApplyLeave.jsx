import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createLeaveRequest, precheckLeaveRequest } from '../services/leaveService';
import taskService from '../services/taskService';
import { differenceInDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import { FiCalendar, FiFileText } from 'react-icons/fi';

const ApplyLeave = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [formData, setFormData] = useState({
    leaveType: 'casual',
    startDate: '',
    endDate: '',
    reason: '',
    replacementUser: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [calculatedDays, setCalculatedDays] = useState(0);
  const [precheck, setPrecheck] = useState(null);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [assignmentUsers, setAssignmentUsers] = useState([]);

  useEffect(() => {
    const prefillType = searchParams.get('leaveType');
    const prefillStartDate = searchParams.get('startDate');
    const prefillEndDate = searchParams.get('endDate');
    const prefillReason = searchParams.get('reason');

    if (!prefillType && !prefillStartDate && !prefillEndDate && !prefillReason) return;

    setFormData((prev) => ({
      ...prev,
      leaveType: prefillType || prev.leaveType,
      startDate: prefillStartDate || prev.startDate,
      endDate: prefillEndDate || prev.endDate,
      reason: prefillReason || prev.reason,
    }));

    if (prefillStartDate && prefillEndDate) {
      const days = calculateDays(prefillStartDate, prefillEndDate);
      setCalculatedDays(days);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await taskService.getUsersForAssignment();
        setAssignmentUsers(Array.isArray(response?.data) ? response.data : []);
      } catch (error) {
        setAssignmentUsers([]);
      }
    };

    loadUsers();
  }, []);

  const leaveTypes = [
    { value: 'casual', label: 'Casual Leave', balance: user?.leaveBalance?.casual || 0 },
    { value: 'sick', label: 'Sick Leave', balance: user?.leaveBalance?.sick || 0 },
    { value: 'earned', label: 'Earned Leave', balance: user?.leaveBalance?.earned || 0 },
    { value: 'wfh', label: 'Work From Home', balance: user?.leaveBalance?.wfh || 0 },
    { value: 'emergency', label: 'Emergency Leave', balance: user?.leaveBalance?.emergency || 0 }
  ];

  const calculateDays = (start, end) => {
    if (start && end) {
      const days = differenceInDays(new Date(end), new Date(start)) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  };

  const chargeableDays = useMemo(() => {
    if (precheck?.dayCalculation?.chargeableDays >= 0) {
      return precheck.dayCalculation.chargeableDays;
    }
    return calculatedDays;
  }, [precheck, calculatedDays]);

  useEffect(() => {
    let ignore = false;

    const runPrecheck = async () => {
      if (!formData.startDate || !formData.endDate || new Date(formData.endDate) < new Date(formData.startDate)) {
        setPrecheck(null);
        return;
      }

      setPrecheckLoading(true);
      try {
        const response = await precheckLeaveRequest({
          leaveType: formData.leaveType,
          startDate: formData.startDate,
          endDate: formData.endDate,
          reason: formData.reason || 'pending validation'
        });

        if (!ignore) {
          setPrecheck(response.data);
          setCalculatedDays(response.data?.dayCalculation?.calendarDays ?? calculateDays(formData.startDate, formData.endDate));
        }
      } catch (error) {
        if (!ignore) {
          setPrecheck(null);
          if (error.response?.data?.error) {
            setErrors((prev) => ({ ...prev, precheck: error.response.data.error }));
          }
        }
      } finally {
        if (!ignore) {
          setPrecheckLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(runPrecheck, 300);

    return () => {
      ignore = true;
      clearTimeout(timeoutId);
    };
  }, [formData.leaveType, formData.startDate, formData.endDate, formData.reason]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      
      // Recalculate days when dates change
      if (name === 'startDate' || name === 'endDate') {
        const days = calculateDays(newData.startDate, newData.endDate);
        setCalculatedDays(days);
      }
      
      return newData;
    });

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.leaveType) {
      newErrors.leaveType = 'Please select leave type';
    }
    
    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }
    
    if (!formData.endDate) {
      newErrors.endDate = 'End date is required';
    } else if (formData.startDate && new Date(formData.endDate) < new Date(formData.startDate)) {
      newErrors.endDate = 'End date must be after start date';
    }
    
    if (calculatedDays <= 0) {
      newErrors.dates = 'Please select valid dates';
    }

    if (precheck?.riskLevel === 'blocked') {
      newErrors.coverage = precheck.reason || 'Selected dates are blocked due to team coverage risk';
    }

    if ((precheck?.taskConflicts?.urgentCount || 0) > 0 && !formData.replacementUser) {
      newErrors.replacementUser = 'Urgent tasks overlap this leave. Please select a backup user.';
    }
    
    // Check leave balance
    const selectedLeaveType = leaveTypes.find(t => t.value === formData.leaveType);
    if (selectedLeaveType && chargeableDays > selectedLeaveType.balance) {
      newErrors.balance = `Insufficient ${formData.leaveType} leave balance. Available: ${selectedLeaveType.balance} days`;
    }
    
    if (!formData.reason.trim()) {
      newErrors.reason = 'Reason is required';
    } else if (formData.reason.length < 10) {
      newErrors.reason = 'Please provide a more detailed reason (min 10 characters)';
    } else if (formData.reason.length > 500) {
      newErrors.reason = 'Reason cannot exceed 500 characters';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const leaveData = {
        ...formData
      };
      
      await createLeaveRequest(leaveData);
      toast.success('Leave request submitted successfully!');
      navigate('/leave-history');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit leave request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Apply for Leave</h1>
        <p className="text-gray-600 mt-2">Submit a new leave request for approval</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Leave Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Leave Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {leaveTypes.map((type) => (
                <label
                  key={type.value}
                  className={`relative flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${
                    formData.leaveType === type.value
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="leaveType"
                    value={type.value}
                    checked={formData.leaveType === type.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium text-gray-900 capitalize">
                    {type.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Balance: {type.balance} days
                  </span>
                </label>
              ))}
            </div>
            {errors.leaveType && (
              <p className="mt-1 text-sm text-red-600">{errors.leaveType}</p>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiCalendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleChange}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className={`input-field pl-10 ${errors.startDate ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiCalendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={formData.startDate || format(new Date(), 'yyyy-MM-dd')}
                  className={`input-field pl-10 ${errors.endDate ? 'border-red-500' : ''}`}
                />
              </div>
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>
              )}
            </div>
          </div>

          {/* Days Display */}
          {calculatedDays > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="space-y-1 text-sm text-blue-900">
                <p>
                  <span className="font-medium">Calendar days:</span> {calculatedDays}
                </p>
                <p>
                  <span className="font-medium">Chargeable leave days:</span> {chargeableDays}
                </p>
                {precheck?.dayCalculation && (
                  <p className="text-xs text-blue-700">
                    Excluded weekends: {precheck.dayCalculation.weekendsExcluded} | Excluded holidays: {precheck.dayCalculation.holidaysExcluded}
                  </p>
                )}
              </div>
            </div>
          )}

          {precheckLoading && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
              Checking team coverage and policy rules...
            </div>
          )}

          {precheck && !precheckLoading && (
            <div className={`border rounded-lg p-4 ${
              precheck.riskLevel === 'blocked'
                ? 'bg-red-50 border-red-200'
                : precheck.riskLevel === 'risky'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-emerald-50 border-emerald-200'
            }`}>
              <p className={`text-sm font-medium ${
                precheck.riskLevel === 'blocked'
                  ? 'text-red-800'
                  : precheck.riskLevel === 'risky'
                    ? 'text-yellow-800'
                    : 'text-emerald-800'
              }`}>
                Coverage Status: {precheck.riskLevel === 'safe' ? 'Safe' : precheck.riskLevel === 'risky' ? 'Risky' : 'Blocked'}
              </p>
              <p className="text-xs mt-1 text-gray-700">{precheck.reason}</p>
              {precheck.coverage && (
                <p className="text-xs mt-1 text-gray-600">
                  Projected coverage usage: {precheck.coverage.projectedCoveragePercentage}%
                  {' '}| Warning at {precheck.coverage.warningThreshold}%
                  {' '}| Block at {precheck.coverage.blockThreshold}%
                </p>
              )}
              {precheck.taskConflicts && (
                <p className="text-xs mt-1 text-gray-700">
                  Task conflicts: {precheck.taskConflicts.total} total,
                  {' '}urgent {precheck.taskConflicts.urgentCount},
                  {' '}non-urgent {precheck.taskConflicts.nonUrgentCount}
                </p>
              )}
              {precheck.guidance && (
                <p className="text-xs mt-1 text-gray-700">{precheck.guidance}</p>
              )}
            </div>
          )}

          {(precheck?.taskConflicts?.urgentCount || 0) > 0 && (
            <div>
              <label htmlFor="replacementUser" className="block text-sm font-medium text-gray-700 mb-1">
                Backup Assignee For Urgent Tasks
              </label>
              <select
                id="replacementUser"
                name="replacementUser"
                value={formData.replacementUser}
                onChange={handleChange}
                className={`input-field ${errors.replacementUser ? 'border-red-500' : ''}`}
              >
                <option value="">Select backup user</option>
                {assignmentUsers
                  .filter((assignmentUser) => assignmentUser?._id && assignmentUser._id !== user?._id)
                  .map((assignmentUser) => (
                    <option key={assignmentUser._id} value={assignmentUser._id}>
                      {assignmentUser.name || `${assignmentUser.firstName || ''} ${assignmentUser.lastName || ''}`.trim() || assignmentUser.email}
                      {assignmentUser.department?.name ? ` - ${assignmentUser.department.name}` : ''}
                    </option>
                  ))}
              </select>
              {errors.replacementUser && (
                <p className="mt-1 text-sm text-red-600">{errors.replacementUser}</p>
              )}
            </div>
          )}

          {errors.precheck && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              {errors.precheck}
            </div>
          )}

          {/* Balance Error */}
          {errors.balance && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{errors.balance}</p>
            </div>
          )}

          {/* Reason */}
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Leave
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3">
                <FiFileText className="h-5 w-5 text-gray-400" />
              </div>
              <textarea
                id="reason"
                name="reason"
                rows="4"
                value={formData.reason}
                onChange={handleChange}
                placeholder="Please provide a detailed reason for your leave request..."
                className={`input-field pl-10 ${errors.reason ? 'border-red-500' : ''}`}
              ></textarea>
            </div>
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {formData.reason.length}/500 characters
            </p>
          </div>

          {/* Dates Error */}
          {errors.dates && (
            <p className="text-sm text-red-600">{errors.dates}</p>
          )}

          {errors.coverage && (
            <p className="text-sm text-red-600">{errors.coverage}</p>
          )}

          {/* Submit Button */}
          <div className="flex space-x-4">
            <button
              type="submit"
              disabled={loading || precheckLoading || precheck?.riskLevel === 'blocked'}
              className="flex-1 btn-primary"
            >
              {loading ? 'Submitting...' : 'Submit Leave Request'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyLeave;
