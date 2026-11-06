import React from 'react';
import { format } from 'date-fns';

const dateValue = (value) => value ? format(new Date(value), 'MMM d, yyyy') : 'Not available';
const displayValue = (value) => value || 'Not provided';

const UserDetailsDrawer = ({ userDetails, onClose, onEdit }) => {
  if (!userDetails) return null;

  const { user, tasks = [], leaveRequests = [], actionHistory = [] } = userDetails;
  const departments = user.departments?.length
    ? user.departments.map((department) => department.name || department.code).join(', ')
    : user.department?.name || 'Unassigned';

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close employee details" onClick={onClose} className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-slate-50 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Employee profile</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">{user.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onEdit(user)} className="rounded-lg bg-cyan-700 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-800">Edit</button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">Close</button>
          </div>
        </div>

        <div className="space-y-5 p-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-cyan-100 text-xl font-bold text-cyan-800">{user.name?.charAt(0).toUpperCase()}</div>
              <div>
                <p className="font-semibold text-slate-900">{user.email}</p>
                <p className="text-sm capitalize text-slate-500">{user.role} · {user.status}</p>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Employee ID', user.employeeId],
              ['Designation', user.designation],
              ['Department', departments],
              ['Manager', user.managerId?.name],
              ['Employment type', user.employmentType?.replace('_', ' ')],
              ['Grade', user.grade],
              ['Joining date', dateValue(user.joiningDate)],
              ['Last login', dateValue(user.lastLoginAt)],
              ['Phone', user.phoneNumber],
              ['Alternate email', user.alternateEmail]
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold capitalize text-slate-800">{displayValue(value)}</p>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Contact and emergency details</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p><span className="text-slate-500">Address:</span> {displayValue([user.address?.street, user.address?.city, user.address?.state, user.address?.country, user.address?.zipCode].filter(Boolean).join(', '))}</p>
              <p><span className="text-slate-500">Emergency contact:</span> {displayValue(user.emergencyContact?.name)}</p>
              <p><span className="text-slate-500">Relationship:</span> {displayValue(user.emergencyContact?.relationship)}</p>
              <p><span className="text-slate-500">Emergency phone:</span> {displayValue(user.emergencyContact?.phoneNumber)}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Leave and compensation</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              {Object.entries(user.leaveBalance || {}).map(([type, value]) => <div key={type} className="rounded-lg bg-slate-50 p-3 capitalize"><span className="text-slate-500">{type}</span><strong className="mt-1 block text-slate-900">{value}</strong></div>)}
              <div className="rounded-lg bg-slate-50 p-3"><span className="text-slate-500">Monthly salary</span><strong className="mt-1 block text-slate-900">{user.salary?.currency || 'INR'} {user.salary?.monthlyBase ?? 'Not set'}</strong></div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Recent leave requests ({leaveRequests.length})</h3>
            <div className="mt-3 space-y-2">{leaveRequests.slice(0, 8).map((request) => <div key={request._id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm"><span className="capitalize">{request.leaveType} · {dateValue(request.startDate)}</span><span className="capitalize text-slate-500">{request.status}</span></div>)}</div>
            {!leaveRequests.length && <p className="mt-3 text-sm text-slate-500">No leave requests.</p>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Work and account activity</h3>
            <p className="mt-2 text-sm text-slate-600">Tasks: {tasks.length} · MFA: {user.mfaEnabled ? 'Enabled' : 'Not enabled'}</p>
            <div className="mt-3 space-y-2">{actionHistory.slice(0, 6).map((item) => <div key={item._id} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium capitalize">{item.actionType.replaceAll('_', ' ')}</span><span className="ml-2 text-slate-500">{dateValue(item.createdAt)}</span></div>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900">Professional record</h3>
            <div className="mt-3 space-y-3 text-sm">
              <p><span className="text-slate-500">Skills:</span> {displayValue(user.skills?.join(', '))}</p>
              <p><span className="text-slate-500">Certifications:</span> {displayValue(user.certifications?.map((item) => item.name).join(', '))}</p>
              {user.performanceRatings?.length > 0 && <p><span className="text-slate-500">Latest performance:</span> {user.performanceRatings[0].rating}/5 · {displayValue(user.performanceRatings[0].period)}</p>}
              <div>
                <p className="mb-2 text-slate-500">Work history</p>
                <div className="space-y-2">{(user.workHistory || []).slice(-6).reverse().map((item, index) => <div key={`${item.action}-${index}`} className="rounded-lg bg-slate-50 p-3"><span className="font-medium capitalize">{item.action?.replaceAll('_', ' ')}</span><span className="ml-2 text-slate-500">{dateValue(item.effectiveDate || item.timestamp)}</span>{item.reason && <p className="mt-1 text-xs text-slate-500">{item.reason}</p>}</div>)}</div>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
};

export default UserDetailsDrawer;
