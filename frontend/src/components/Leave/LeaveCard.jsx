import React from 'react';
import { format } from 'date-fns';

// Inline SVG Icons
const ClockIcon = () => (
  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const XCircleIcon = () => (
  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LeaveCard = ({ leave, onApprove, onReject, onCancel, showActions = false, showCancel = false }) => {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };

  const StatusIcon = ({ status }) => {
    if (status === 'pending') return <ClockIcon />;
    if (status === 'approved') return <CheckCircleIcon />;
    if (status === 'cancelled') return <XCircleIcon />;
    return <XCircleIcon />;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 capitalize">
            {leave.leaveType} Leave
          </h3>
          {leave.userId && (
            <div className="mt-1">
              <p className="text-sm text-gray-600">
                {leave.userId.name} • {leave.userId.email}
              </p>
              {leave.userId.designation && (
                <p className="text-xs text-gray-500">
                  {leave.userId.designation}
                </p>
              )}
              {leave.userId.department && (
                <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {leave.userId.department.name} ({leave.userId.department.code})
                </p>
              )}
            </div>
          )}
        </div>
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusColors[leave.status]}`}>
          <StatusIcon status={leave.status} />
          {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
        </span>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        <p>
          <span className="font-medium">Duration:</span>{' '}
          {format(new Date(leave.startDate), 'MMM dd, yyyy')} - {format(new Date(leave.endDate), 'MMM dd, yyyy')}
        </p>
        <p>
          <span className="font-medium">Total Days:</span> {leave.totalDays}
        </p>
        <p>
          <span className="font-medium">Reason:</span> {leave.reason}
        </p>
        <p>
          <span className="font-medium">Applied on:</span>{' '}
          {format(new Date(leave.createdAt), 'MMM dd, yyyy')}
        </p>
        {leave.adminComment && (
          <p className="text-sm text-gray-700">
            <span className="font-medium">Comment:</span> {leave.adminComment}
          </p>
        )}
      </div>

      {showActions && leave.status === 'pending' && (
        <div className="mt-4 flex space-x-3">
          <button
            onClick={() => onApprove(leave._id)}
            className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            Approve
          </button>
          <button
            onClick={() => onReject(leave._id)}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Reject
          </button>
        </div>
      )}

      {showCancel && leave.status === 'pending' && (
        <div className="mt-4">
          <button
            onClick={() => onCancel(leave._id)}
            className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            Cancel Request
          </button>
        </div>
      )}
    </div>
  );
};

export default LeaveCard;
