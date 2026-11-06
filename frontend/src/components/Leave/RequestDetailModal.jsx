import React from 'react';
import { format, differenceInCalendarDays } from 'date-fns';

const RequestDetailModal = ({ leave, isOpen, onClose }) => {
  if (!isOpen || !leave) return null;

  const statusColors = {
    pending: 'bg-amber-50 border-amber-200 text-amber-900',
    approved: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    rejected: 'bg-red-50 border-red-200 text-red-900',
  };

  const riskColors = {
    safe: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    risky: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    blocked: 'bg-red-50 border-red-200 text-red-900',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-purple-900 text-white p-6 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-bold">{leave.userId?.name}</h2>
            <p className="text-indigo-100 text-sm">{leave.leaveType.toUpperCase()} Leave Request</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-indigo-200 text-3xl w-10 h-10 flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status & Risk Assessment */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg border-2 ${statusColors[leave.status]}`}>
              <p className="text-xs font-semibold uppercase text-gray-600 mb-1">Current Status</p>
              <p className="text-2xl font-bold">{leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}</p>
              {leave.reviewedAt && (
                <p className="text-xs text-gray-600 mt-2">Reviewed: {format(new Date(leave.reviewedAt), 'MMM dd, yyyy hh:mm a')}</p>
              )}
            </div>

            {leave.coverageAssessment && (
              <div className={`p-4 rounded-lg border-2 ${riskColors[leave.coverageAssessment.riskLevel]}`}>
                <p className="text-xs font-semibold uppercase text-gray-600 mb-1">Coverage Risk</p>
                <p className="text-2xl font-bold">{leave.coverageAssessment.riskLevel.toUpperCase()}</p>
                <p className="text-sm mt-2">{leave.coverageAssessment.projectedCoveragePercentage}% coverage projected</p>
              </div>
            )}
          </div>

          {/* Timeline Information */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Leave Duration</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Start Date</span>
                <span className="font-semibold">{format(new Date(leave.startDate), 'eee, MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">End Date</span>
                <span className="font-semibold">{format(new Date(leave.endDate), 'eee, MMM dd, yyyy')}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-blue-300">
                <span className="text-gray-600 font-medium">Total Days</span>
                <span className="font-bold text-lg text-blue-700">{leave.totalDays} days</span>
              </div>
            </div>
          </div>

          {/* Day Calculation Breakdown */}
          {leave.dayCalculation && (
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Day Calculation</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Calendar Days</span>
                  <span className="font-semibold">{leave.dayCalculation.calendarDays}</span>
                </div>
                {leave.dayCalculation.weekendsExcluded > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 ml-4">- Weekends</span>
                    <span className="font-semibold">-{leave.dayCalculation.weekendsExcluded}</span>
                  </div>
                )}
                {leave.dayCalculation.holidaysExcluded > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 ml-4">- Holidays</span>
                    <span className="font-semibold">-{leave.dayCalculation.holidaysExcluded}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-purple-300">
                  <span className="text-gray-700 font-medium">Chargeable Days</span>
                  <span className="font-bold text-purple-700">{leave.dayCalculation.chargeableDays}</span>
                </div>
              </div>
            </div>
          )}

          {/* Coverage Assessment Details */}
          {leave.coverageAssessment && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Coverage Assessment</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Projected Coverage</span>
                  <span className="font-semibold">{leave.coverageAssessment.projectedCoveragePercentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Warning Threshold</span>
                  <span className="font-semibold">{leave.coverageAssessment.warningThreshold}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Block Threshold</span>
                  <span className="font-semibold">{leave.coverageAssessment.blockThreshold}%</span>
                </div>
                <div className="mt-3 pt-3 border-t border-red-200">
                  <p className="text-gray-700">
                    <strong>Assessment:</strong> {leave.coverageAssessment.reason}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Employee Information */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Employee Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Email</p>
                <p className="font-medium">{leave.userId?.email}</p>
              </div>
              <div>
                <p className="text-gray-600">Department</p>
                <p className="font-medium">{leave.userId?.department?.name || leave.userId?.department || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600">Manager</p>
                <p className="font-medium">{leave.userId?.manager?.name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-600">Leave Balance</p>
                <p className="font-medium">{leave.userId?.leaveBalance?.casual || 0} days remaining</p>
              </div>
            </div>
          </div>

          {/* Reason & Notes */}
          <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Reason</h3>
            <p className="text-gray-700">{leave.reason || 'No reason provided'}</p>
            {leave.notes && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Notes</h4>
                <p className="text-gray-700 text-sm">{leave.notes}</p>
              </div>
            )}
          </div>

          {/* Approval Workflow */}
          {leave.approvalWorkflow && leave.approvalWorkflow.length > 0 && (
            <div className="bg-green-50 rounded-lg border border-green-200 p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Approval Workflow</h3>
              <div className="space-y-3">
                {leave.approvalWorkflow.map((stage, idx) => (
                  <div key={idx} className="flex gap-3">
                    <div className="flex-shrink-0">
                      {stage.status === 'approved' ? (
                        <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
                          ✓
                        </div>
                      ) : stage.status === 'rejected' ? (
                        <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center">
                          ✕
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          ⏳
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{stage.approverRole}</p>
                      <p className="text-xs text-gray-600">
                        {stage.status === 'pending'
                          ? 'Pending approval'
                          : `${stage.status === 'approved' ? 'Approved' : 'Rejected'} by ${stage.approver?.name || 'Unknown'}`}
                      </p>
                      {stage.approvalDate && (
                        <p className="text-xs text-gray-500">
                          {format(new Date(stage.approvalDate), 'MMM dd, yyyy hh:mm a')}
                        </p>
                      )}
                      {stage.comment && (
                        <p className="text-xs text-gray-700 mt-1 italic">"{stage.comment}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request Timeline */}
          <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Timeline</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Submitted</span>
                <span className="font-semibold">{format(new Date(leave.createdAt), 'MMM dd, yyyy hh:mm a')}</span>
              </div>
              {leave.reviewedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Reviewed</span>
                  <span className="font-semibold">{format(new Date(leave.reviewedAt), 'MMM dd, yyyy hh:mm a')}</span>
                </div>
              )}
              {leave.approvalWorkflow?.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Time to Decision</span>
                  <span className="font-semibold">
                    {leave.reviewedAt
                      ? Math.ceil(
                          (new Date(leave.reviewedAt) - new Date(leave.createdAt)) / (1000 * 60 * 60)
                        ) + ' hours'
                      : 'Pending'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestDetailModal;
