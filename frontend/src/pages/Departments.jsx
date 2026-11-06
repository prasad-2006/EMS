import React, { useState, useEffect } from 'react';
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment, getDepartmentEmployees } from '../services/departmentService';
import { getAllUsers, updateUser } from '../services/userService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import toast from 'react-hot-toast';

const Departments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);
  const [deptEmployees, setDeptEmployees] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true
  });

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const response = await getAllDepartments();
      setDepartments(response.data || []);
      setError('');
    } catch (err) {
      setError(err.error || 'Failed to fetch departments');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartmentEmployees = async (deptId) => {
    try {
      setLoadingEmployees(true);
      const response = await getDepartmentEmployees(deptId);
      setDeptEmployees(response.data || []);
    } catch (err) {
      toast.error('Failed to fetch department employees');
    } finally {
      setLoadingEmployees(false);
    }
  };

  const fetchAllEmployees = async () => {
    try {
      const response = await getAllUsers({ status: 'approved', limit: 1000 });
      setAllEmployees(response.data || []);
    } catch (err) {
      toast.error('Failed to fetch employees');
    }
  };

  const handleViewEmployees = async (dept) => {
    setSelectedDept(dept);
    await fetchDepartmentEmployees(dept._id);
    await fetchAllEmployees();
    setShowEmployeeModal(true);
  };

  const handleAssignEmployee = async (employeeId, employeeName) => {
    if (!selectedDept) return;

    const employee = allEmployees.find(emp => (emp.id || emp._id) === employeeId);

    try {
      const currentDepartmentIds = (employee?.departments || [])
        .map(department => department.id || department._id || department)
        .filter(Boolean);
      const primaryDepartmentId = employee?.department?.id || employee?.department?._id || employee?.department;
      if (primaryDepartmentId && !currentDepartmentIds.includes(primaryDepartmentId)) {
        currentDepartmentIds.push(primaryDepartmentId);
      }
      if (!currentDepartmentIds.includes(selectedDept._id)) currentDepartmentIds.push(selectedDept._id);

      await updateUser(employeeId, {
        department: primaryDepartmentId || selectedDept._id,
        departments: currentDepartmentIds
      });
      toast.success(`${employeeName} assigned to ${selectedDept.name}`);
      await fetchDepartmentEmployees(selectedDept._id);
      await fetchAllEmployees();
      await fetchDepartments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign employee');
    }
  };

  const handleRemoveEmployee = async (employeeId, employeeName) => {
    if (!selectedDept) return;
    
    if (!window.confirm(`Remove ${employeeName} from ${selectedDept.name}? They will remain in any other departments.`)) return;
    
    try {
      const employee = deptEmployees.find(emp => (emp.id || emp._id) === employeeId);
      const currentDepartmentIds = (employee?.departments || [])
        .map(department => department.id || department._id || department)
        .filter(Boolean)
        .filter(departmentId => departmentId !== selectedDept._id);
      const primaryDepartmentId = employee?.department?.id || employee?.department?._id || employee?.department;
      const nextPrimaryDepartmentId = primaryDepartmentId === selectedDept._id
        ? (currentDepartmentIds[0] || null)
        : primaryDepartmentId;

      await updateUser(employeeId, {
        department: nextPrimaryDepartmentId,
        departments: currentDepartmentIds
      });
      toast.success(`${employeeName} removed from department`);
      await fetchDepartmentEmployees(selectedDept._id);
      await fetchAllEmployees();
      await fetchDepartments();
    } catch (err) {
      toast.error('Failed to remove employee');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDept) {
        await updateDepartment(editingDept._id, formData);
        toast.success('Department updated successfully');
      } else {
        await createDepartment(formData);
        toast.success('Department created successfully');
      }
      setShowDeptModal(false);
      resetForm();
      fetchDepartments();
      window.dispatchEvent(new Event('ems:hierarchy-refresh'));
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Operation failed';
      toast.error(errorMessage);
    }
  };

  const handleEdit = (dept) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      code: dept.code,
      description: dept.description || '',
      isActive: dept.isActive
    });
    setShowDeptModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      try {
        await deleteDepartment(id);
        toast.success('Department deleted successfully');
        fetchDepartments();
        window.dispatchEvent(new Event('ems:hierarchy-refresh'));
      } catch (err) {
        toast.error(err.error || 'Failed to delete department');
      }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', code: '', description: '', isActive: true });
    setEditingDept(null);
  };

  // Filter available employees - exclude those who are already in current employees list
  const currentEmployeeIds = deptEmployees.map(emp => emp.id || emp._id);
  const unassignedEmployees = allEmployees.filter(emp => 
    !currentEmployeeIds.includes(emp.id || emp._id)
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Departments</h1>
          <p className="text-gray-600 mt-1">Manage departments and assign employees</p>
        </div>
        <button
          onClick={() => setShowDeptModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Department
        </button>
      </div>

      {error && <ErrorMessage message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div key={dept._id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">{dept.name}</h3>
                <p className="text-sm text-gray-500 mt-1">Code: {dept.code}</p>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${dept.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                {dept.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <p className="text-gray-600 mb-4 text-sm line-clamp-2">
              {dept.description || 'No description'}
            </p>
            
            <div className="flex items-center gap-2 text-sm text-gray-700 mb-4 p-3 bg-gray-50 rounded">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <span className="font-semibold">{dept.employeeCount || 0}</span>
              <span className="text-gray-500">Employees</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleViewEmployees(dept)}
                className="col-span-3 bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700 text-sm font-medium"
              >
                Manage Employees
              </button>
              <button
                onClick={() => handleEdit(dept)}
                className="bg-yellow-500 text-white px-3 py-2 rounded hover:bg-yellow-600 text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(dept._id)}
                className="col-span-2 bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600 text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Department Form Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingDept ? 'Edit Department' : 'Add Department'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength="10"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
              </div>
              <div className="mb-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="mr-2 w-4 h-4"
                  />
                  <span className="text-gray-700">Active</span>
                </label>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-medium"
                >
                  {editingDept ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeptModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Management Modal */}
      {showEmployeeModal && selectedDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedDept.name} - Employees</h2>
                <p className="text-gray-600">Assign and manage employees in this department</p>
              </div>
              <button
                onClick={() => {
                  setShowEmployeeModal(false);
                  setSelectedDept(null);
                  setDeptEmployees([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingEmployees ? (
              <LoadingSpinner />
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Current Employees */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">
                    Current Employees ({deptEmployees.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {deptEmployees.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No employees assigned</p>
                    ) : (
                      deptEmployees.map((emp) => (
                        <div key={emp.id || emp._id} className="flex justify-between items-center p-3 bg-green-50 border border-green-200 rounded">
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{emp.name}</p>
                            <p className="text-sm text-gray-600">{emp.email}</p>
                            {emp.designation && (
                              <p className="text-xs text-gray-500">{emp.designation}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveEmployee(emp.id || emp._id, emp.name)}
                            className="ml-2 text-red-600 hover:text-red-800 p-2"
                            title="Remove from department"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Available Employees */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">
                    Available Employees ({unassignedEmployees.length})
                  </h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {unassignedEmployees.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">All employees are assigned</p>
                    ) : (
                      unassignedEmployees.map((emp) => (
                        <div key={emp.id || emp._id} className={`flex justify-between items-center p-3 border rounded ${
                          emp.department || emp.departments?.length ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800">{emp.name}</p>
                            <p className="text-sm text-gray-600">{emp.email}</p>
                            {emp.designation && (
                              <p className="text-xs text-gray-500">{emp.designation}</p>
                            )}
                            {(emp.department || emp.departments?.length) && (
                              <div className="flex items-center gap-1 mt-1">
                                <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                <p className="text-xs text-blue-600 font-medium">
                                  Current departments: {(emp.departments?.length
                                    ? emp.departments.map(department => department.name || department.code).join(', ')
                                    : emp.department.name) || 'Unknown'}
                                </p>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleAssignEmployee(emp.id || emp._id, emp.name)}
                            className={`ml-2 p-2 ${
                              emp.department || emp.departments?.length
                                ? 'text-orange-600 hover:text-orange-800' 
                                : 'text-green-600 hover:text-green-800'
                            }`}
                            title="Add to this department"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Departments;
