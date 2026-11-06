import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigation } from '../hooks/useNavigation';
import taskService from '../services/taskService';
import Breadcrumb from '../components/Navigation/Breadcrumb';
import HierarchySidebar from '../components/Navigation/HierarchySidebar';
import KpiCards from '../components/Tasks/KpiCards';
import DrillableTaskTable from '../components/Tasks/DrillableTaskTable';
import EmployeeDeepDive from '../components/Tasks/EmployeeDeepDive';
import TaskEditModal from '../components/Tasks/TaskEditModal';
import TaskBulkEditModal from '../components/Tasks/TaskBulkEditModal';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';

/**
 * View All Tasks — enterprise drill-down surface.
 * URL query params are the single source of truth; the breadcrumb maps the
 * filter stack; KPI cards and every table cell are click-to-drill; employee
 * emails open the split-screen deep-dive.
 */
const AdminTaskManagement = () => {
  const { filters, drillDown, searchParams } = useNavigation();
  const [tasks, setTasks] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(filters.q || '');
  const [diveTarget, setDiveTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editUsers, setEditUsers] = useState([]);
  
  // Bulk selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  // ---- Params mirrored from the URL filter stack ----
  const params = useMemo(() => {
    const p = { page: 1, limit: 500 };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) p[key] = value;
    });
    return p;
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskRes, kpiRes] = await Promise.all([
        taskService.getAllTasks(params),
        taskService.getTasksKpi(params)
      ]);
      setTasks(Array.isArray(taskRes?.data) ? taskRes.data : []);
      setKpi(kpiRes?.data || null);
      setSelectedTaskIds([]); // Clear selection on load
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);

  // ---- Debounced free-text search → URL param q ----
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.q || '')) {
        drillDown('q', searchInput.trim() || undefined);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, filters.q, drillDown]);

  // Sync the input when the URL changes from breadcrumb drill-up.
  useEffect(() => {
    setSearchInput(filters.q || '');
  }, [filters.q]);

  // ---- Breadcrumb user lookup ----
  const userLookup = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      const assignee = task.assignedTo;
      if (assignee?._id) map[String(assignee._id)] = assignee;
    });
    return map;
  }, [tasks]);

  // ---- Edit modal: enrich assignee list with leave-aware metadata ----
  const openEdit = async (task) => {
    setEditTarget(task);
    setEditUsers([]);
    try {
      const deadline = task.deadline ? String(task.deadline).slice(0, 10) : undefined;
      const response = await taskService.getUsersForAssignment({
        deadline: deadline || undefined
      });
      setEditUsers(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setEditUsers([]);
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;
    try {
      await taskService.deleteTask(task._id);
      toast.success('Task deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete task');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedTaskIds.length} selected tasks?`)) return;
    try {
      await taskService.bulkDelete(selectedTaskIds);
      toast.success(`${selectedTaskIds.length} tasks deleted`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete tasks');
    }
  };

  const openBulkEdit = async () => {
    setShowBulkEditModal(true);
    if (editUsers.length === 0) {
      try {
        const response = await taskService.getUsersForAssignment({});
        setEditUsers(Array.isArray(response?.data) ? response.data : []);
      } catch (err) {
        setEditUsers([]);
      }
    }
  };

  const handleBulkEditSave = async (updates) => {
    setBulkLoading(true);
    try {
      await taskService.bulkUpdate(selectedTaskIds, updates);
      toast.success(`${selectedTaskIds.length} tasks updated`);
      setShowBulkEditModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update tasks');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-900 to-teal-800 text-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">View All Tasks</p>
        <h1 className="text-3xl font-bold mt-1">Hierarchical Task Board</h1>
        <p className="text-cyan-100/80 mt-2">
          Drill into departments, projects, statuses, priorities and employees — the URL holds your exact view.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
        {/* Recursive Tree Sidebar */}
        <div className="lg:sticky lg:top-24">
          <HierarchySidebar />
        </div>

        {/* Main drill surface */}
        <div className="space-y-4 min-w-0">
          <Breadcrumb userLookup={userLookup} />

          {/* Interactive KPI cards */}
          <KpiCards kpi={kpi} loading={loading} />

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title, description or tag… (drills into ?q=)"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pl-10 text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Count strip and Bulk Actions */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-400">
              Showing <span className="font-bold text-slate-600">{tasks.length}</span> task(s) in scope
              {searchParams.has('nodeId') && ' • context-scoped to selected hierarchy node + descendants'}
            </span>
            {selectedTaskIds.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 mr-2">
                  {selectedTaskIds.length} selected
                </span>
                <button
                  onClick={openBulkEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  <FiEdit2 size={12} />
                  Bulk Edit
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
                >
                  <FiTrash2 size={12} />
                  Bulk Delete
                </button>
              </div>
            )}
          </div>

          {/* Click-to-drill table */}
          <DrillableTaskTable
            tasks={tasks}
            loading={loading}
            onTaskClick={openEdit}
            onEmployeeDive={(id, name) => setDiveTarget({ id, name })}
            onDelete={handleDelete}
            selectedTaskIds={selectedTaskIds}
            onSelectionChange={setSelectedTaskIds}
          />
        </div>
      </div>

      {/* Split-screen Employee Deep-Dive */}
      {diveTarget && (
        <EmployeeDeepDive
          userId={diveTarget.id}
          userName={diveTarget.name}
          onClose={() => setDiveTarget(null)}
        />
      )}

      {/* Task edit modal (secondary drill from table) */}
      {editTarget && (
        <TaskEditModal
          task={editTarget}
          users={editUsers}
          onClose={() => setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            load();
          }}
          onDeleted={() => {
            setEditTarget(null);
            load();
          }}
        />
      )}

      {/* Bulk edit modal */}
      <TaskBulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        onSave={handleBulkEditSave}
        users={editUsers}
        selectedCount={selectedTaskIds.length}
        loading={bulkLoading}
      />
    </div>
  );
};

export default AdminTaskManagement;
