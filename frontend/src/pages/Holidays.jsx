import React, { useEffect, useMemo, useState } from 'react';
import { getAllHolidays, createHoliday, updateHoliday, deleteHoliday } from '../services/holidayService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const Holidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [sortMode, setSortMode] = useState('date_asc');
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'company',
    description: '',
    isRecurring: false,
    isActive: true
  });

  useEffect(() => {
    fetchData();
  }, []);

  const getErrorMessage = (err, fallback) => {
    return (
      err?.response?.data?.error ||
      err?.response?.data?.message ||
      err?.message ||
      fallback
    );
  };

  const normalizeHolidayList = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const holidaysRes = await getAllHolidays({ limit: 200 });
      setHolidays(normalizeHolidayList(holidaysRes));
      setError('');
    } catch (err) {
      // Retry with a smaller payload for transient timeouts or slow DB responses.
      try {
        const fallbackRes = await getAllHolidays({ limit: 80 });
        setHolidays(normalizeHolidayList(fallbackRes));
        setError('');
      } catch (fallbackErr) {
        setError(getErrorMessage(fallbackErr, 'Failed to fetch holidays'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday._id, formData);
        toast.success('Holiday updated successfully');
      } else {
        await createHoliday(formData);
        toast.success('Holiday created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Operation failed'));
    }
  };

  const handleEdit = (holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      date: format(new Date(holiday.date), 'yyyy-MM-dd'),
      type: holiday.type,
      description: holiday.description || '',
      isRecurring: holiday.isRecurring,
      applicableDepartments: holiday.applicableDepartments?.map(d => d._id) || [],
      isActive: holiday.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await deleteHoliday(id);
        toast.success('Holiday deleted successfully');
        fetchData();
      } catch (err) {
        toast.error(getErrorMessage(err, 'Failed to delete holiday'));
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      type: 'company',
      description: '',
      isRecurring: false,
      isActive: true
    });
    setEditingHoliday(null);
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];

  const filteredHolidays = useMemo(() => {
    const scoped = holidays.filter((holiday) => {
      const holidayYear = new Date(holiday.date).getFullYear();
      const matchesYear = yearFilter === 'all' || String(holidayYear) === yearFilter;
      const matchesType = typeFilter === 'all' || holiday.type === typeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? holiday.isActive : !holiday.isActive);
      const matchesSearch =
        !searchTerm ||
        holiday.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (holiday.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      return matchesYear && matchesType && matchesStatus && matchesSearch;
    });

    const sorted = [...scoped].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();

      if (sortMode === 'date_desc') return dateB - dateA;
      if (sortMode === 'name_asc') return a.name.localeCompare(b.name);
      if (sortMode === 'name_desc') return b.name.localeCompare(a.name);
      return dateA - dateB;
    });

    return sorted;
  }, [holidays, yearFilter, typeFilter, statusFilter, searchTerm, sortMode]);

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const total = filteredHolidays.length;
    const upcoming = filteredHolidays.filter((holiday) => new Date(holiday.date) >= now).length;
    const optional = filteredHolidays.filter((holiday) => holiday.type === 'optional').length;
    const recurring = filteredHolidays.filter((holiday) => holiday.isRecurring).length;

    return { total, upcoming, optional, recurring };
  }, [filteredHolidays]);

  const upcomingPreview = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return filteredHolidays
      .filter((holiday) => new Date(holiday.date) >= now)
      .slice(0, 5);
  }, [filteredHolidays]);

  const getTypeColor = (type) => {
    switch (type) {
      case 'national': return 'bg-red-100 text-red-800';
      case 'company': return 'bg-blue-100 text-blue-800';
      case 'optional': return 'bg-yellow-100 text-yellow-800';
      case 'state': return 'bg-purple-100 text-purple-800';
      case 'regional': return 'bg-teal-100 text-teal-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (isActive) => {
    return isActive
      ? 'bg-emerald-100 text-emerald-800'
      : 'bg-gray-100 text-gray-700';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setStatusFilter('all');
    setYearFilter(String(currentYear));
    setSortMode('date_asc');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-900 to-cyan-800 p-6 text-white shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Holiday Command Center</h1>
            <p className="text-blue-100 mt-1 text-sm">Plan, track, and tune holiday visibility across the organization.</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-white text-slate-900 px-5 py-2.5 rounded-lg font-semibold hover:bg-slate-100 transition-colors"
          >
            Add Holiday
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Visible Holidays</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Upcoming</p>
          <p className="text-2xl font-bold text-indigo-700 mt-2">{stats.upcoming}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Optional</p>
          <p className="text-2xl font-bold text-amber-700 mt-2">{stats.optional}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Recurring</p>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{stats.recurring}</p>
        </div>
      </div>

      {error && <ErrorMessage message={error} onRetry={fetchData} />}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or description"
            className="input-field md:col-span-2"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field">
            <option value="all">All Types</option>
            <option value="national">National</option>
            <option value="state">State</option>
            <option value="regional">Regional</option>
            <option value="company">Company</option>
            <option value="optional">Optional</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="input-field">
            <option value="all">All Years</option>
            {yearOptions.map((year) => (
              <option key={year} value={String(year)}>{year}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">Sort:</label>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="border border-gray-300 rounded px-2 py-1">
              <option value="date_asc">Date (old to new)</option>
              <option value="date_desc">Date (new to old)</option>
              <option value="name_asc">Name (A-Z)</option>
              <option value="name_desc">Name (Z-A)</option>
            </select>
          </div>
          <button onClick={clearFilters} className="text-sm text-indigo-700 hover:text-indigo-900 font-medium">Reset Filters</button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Day</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredHolidays.map((holiday) => (
                <tr key={holiday._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {format(new Date(holiday.date), 'MMM dd, yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {format(new Date(holiday.date), 'EEEE')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <p className="font-medium">{holiday.name}</p>
                    {holiday.description ? (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">{holiday.description}</p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getTypeColor(holiday.type)}`}>
                      {holiday.type}
                    </span>
                    {holiday.isRecurring && (
                      <span className="ml-2 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Recurring</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(holiday.isActive)}`}>
                      {holiday.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm space-x-4">
                    <button onClick={() => handleEdit(holiday)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                    <button onClick={() => handleDelete(holiday._id)} className="text-red-600 hover:text-red-800 font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredHolidays.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-gray-500">No holidays match your current filters.</p>
              <button onClick={clearFilters} className="mt-3 text-indigo-700 font-medium hover:text-indigo-900">Clear filters</button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Upcoming Snapshot</h3>
          <div className="mt-4 space-y-3">
            {upcomingPreview.length > 0 ? (
              upcomingPreview.map((holiday) => (
                <div key={holiday._id} className="border border-gray-100 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-900">{holiday.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{format(new Date(holiday.date), 'MMM dd, yyyy')}</p>
                  <div className="mt-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(holiday.type)}`}>
                      {holiday.type}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No upcoming holidays in this view.</p>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-xl w-full max-h-screen overflow-y-auto shadow-2xl">
            <h2 className="text-2xl font-bold mb-1 text-gray-900">
              {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">Configure date, visibility, and recurrence details.</p>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="Example: Republic Day"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Date</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2 font-medium">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="national">National</option>
                    <option value="state">State</option>
                    <option value="regional">Regional</option>
                    <option value="company">Company</option>
                    <option value="optional">Optional</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 mb-2 font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows="3"
                  placeholder="Optional context shown to employees"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <label className="flex items-center gap-3 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked={formData.isRecurring}
                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  />
                  Recurs every year
                </label>
                <label className="flex items-center gap-3 text-sm text-gray-700 border border-gray-200 rounded-lg px-3 py-2">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Mark as active
                </label>
              </div>

              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-medium"
                >
                  {editingHoliday ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Holidays;
