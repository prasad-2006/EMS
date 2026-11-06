import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { updateUser, getAllUsers } from '../../services/userService';

const EmployeeEditModal = ({ isOpen, onClose, user, onSave }) => {
  const [formData, setFormData] = useState({
    role: 'employee',
    managerId: '',
    salaryBase: 60000,
    name: '',
    email: '',
    phoneNumber: '',
    alternateEmail: '',
    designation: '',
    grade: '',
    employmentType: 'full_time',
    employeeId: '',
    address: { street: '', city: '', state: '', country: 'India', zipCode: '' },
    emergencyContact: { name: '', relationship: '', phoneNumber: '' },
    status: 'approved',
    leaveBalance: { casual: 12, sick: 10, earned: 15, wfh: 24, emergency: 5 },
    password: ''
  });
  const [saving, setSaving] = useState(false);
  const [managers, setManagers] = useState([]);

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        role: user.role || 'employee',
        managerId: user.managerId?._id || user.managerId || '',
        salaryBase: user.salary?.monthlyBase || 60000,
        name: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        alternateEmail: user.alternateEmail || '',
        designation: user.designation || '',
        grade: user.grade || '',
        employmentType: user.employmentType || 'full_time',
        employeeId: user.employeeId || '',
        address: { ...user.address },
        emergencyContact: { ...user.emergencyContact },
        status: user.status || 'approved',
        leaveBalance: { ...user.leaveBalance },
        password: ''
      });
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (isOpen) {
      // Fetch potential managers (CEO and HRs)
      getAllUsers({ status: 'approved', limit: 100 }).then(res => {
        if (res.data) {
          const eligible = res.data.filter(u => ['admin', 'hr', 'manager'].includes(u.role));
          setManagers(eligible);
        }
      }).catch(err => console.error(err));
    }
  }, [isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        alternateEmail: formData.alternateEmail,
        designation: formData.designation,
        grade: formData.grade,
        employmentType: formData.employmentType,
        employeeId: formData.employeeId,
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        status: formData.status,
        leaveBalance: formData.leaveBalance,
        role: formData.role,
        managerId: formData.managerId || null,
        salary: { monthlyBase: Number(formData.salaryBase) }
      };

      if (formData.password) {
        payload.password = formData.password;
      }
      
      await updateUser(user.id || user._id, payload);
      toast.success('Employee updated successfully');
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
        
        <div className="relative inline-block w-full max-w-2xl p-6 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-slate-900">Edit {user.name}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ['name', 'Full name', 'text'],
                ['email', 'Work email', 'email'],
                ['phoneNumber', 'Phone number', 'text'],
                ['alternateEmail', 'Alternate email', 'email'],
                ['employeeId', 'Employee ID', 'text'],
                ['designation', 'Designation', 'text'],
                ['grade', 'Grade', 'text']
              ].map(([field, label, type]) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
                  <input type={type} required={field === 'name' || field === 'email'} value={formData[field]} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500" />
                </label>
              ))}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Account status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On leave</option>
                <option value="resigned">Resigned</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Leave balances</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {Object.keys(formData.leaveBalance).map((type) => (
                  <label key={type} className="text-xs capitalize text-slate-500">
                    {type}
                    <input type="number" min="0" value={formData.leaveBalance[type]} onChange={(e) => setFormData({ ...formData, leaveBalance: { ...formData.leaveBalance, [type]: Number(e.target.value) } })} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-800" />
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Address</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {['street', 'city', 'state', 'country', 'zipCode'].map((field) => (
                  <input key={field} placeholder={field.replace(/([A-Z])/g, ' $1')} value={formData.address[field] || ''} onChange={(e) => setFormData({ ...formData, address: { ...formData.address, [field]: e.target.value } })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-800">Emergency contact</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {['name', 'relationship', 'phoneNumber'].map((field) => (
                  <input key={field} placeholder={field.replace(/([A-Z])/g, ' $1')} value={formData.emergencyContact[field] || ''} onChange={(e) => setFormData({ ...formData, emergencyContact: { ...formData.emergencyContact, [field]: e.target.value } })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Employment type</label>
              <select value={formData.employmentType} onChange={(e) => setFormData({ ...formData, employmentType: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:ring-2 focus:ring-blue-500">
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contract">Contract</option>
                <option value="intern">Intern</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="admin">CEO (Admin)</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Manager (Reports To)</label>
              <select
                value={formData.managerId}
                onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {managers.map(m => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Base Salary</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.salaryBase}
                  onChange={(e) => setFormData({ ...formData, salaryBase: e.target.value })}
                  className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">New Password (Optional)</label>
              <input
                type="password"
                placeholder="Leave blank to keep current password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmployeeEditModal;
