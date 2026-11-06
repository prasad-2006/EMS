import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import taskService from '../../services/taskService';
import { useNavigationContext } from '../../context/NavigationContext';
import LoadingSpinner from '../Common/LoadingSpinner';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400';

const labelClass = 'block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1';

const formatLeaveDates = (conflicts) =>
  conflicts.map((c) => `${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}`).join('; ');

/**
 * Cascading Assign — 3-tier cascading dropdown (Department → Project →
 * Employee). The Employee tier is leave-aware: candidates with approved leave
 * overlapping the task deadline are disabled, grayed out, and show their
 * exact leave dates in a tooltip.
 */
const CascadingAssign = ({ onAssigned, defaultProjectId, parentTaskId, defaultDeptId }) => {
  const { hierarchy, loading } = useNavigationContext();

  const [selectedDept, setSelectedDept] = useState(defaultDeptId || '');
  const [selectedProject, setSelectedProject] = useState(defaultProjectId || '');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assigneePool, setAssigneePool] = useState([]);
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'other'
  });

  // Flatten hierarchy into selectable lists.
  const departments = useMemo(() => {
    const out = [];
    const walk = (nodes) => {
      nodes.forEach((node) => {
        if (node.type === 'department') out.push(node);
        if (node.children) walk(node.children);
      });
    };
    walk(hierarchy);
    return out;
  }, [hierarchy]);

  const projectsByDept = useMemo(() => {
    const map = new Map();
    const walk = (nodes) => {
      nodes.forEach((node) => {
        if (node.type === 'project') {
          const deptKey = node.departmentId ? String(node.departmentId) : '';
          if (!map.has(deptKey)) map.set(deptKey, []);
          map.get(deptKey).push(node);
        }
        if (node.children) walk(node.children);
      });
    };
    walk(hierarchy);
    return map;
  }, [hierarchy]);

  const availableProjects = selectedDept
    ? projectsByDept.get(String(selectedDept)) || []
    : [];

  // Fetch leave-aware assignee pool whenever the project or deadline changes.
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!selectedProject) {
        setAssigneePool([]);
        setSelectedAssignee('');
        return;
      }
      setLoadingAssignees(true);
      try {
        const response = await taskService.getUsersForAssignment({
          departmentId: selectedDept,
          deadline: deadline || undefined
        });
        if (mounted) {
          setAssigneePool(Array.isArray(response?.data) ? response.data : []);
        }
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load employees');
      } finally {
        if (mounted) setLoadingAssignees(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [selectedProject, deadline]);

  const selectedAssigneeMeta = assigneePool.find((u) => String(u._id) === String(selectedAssignee));

  const handleSubmit = async () => {
    if (!form.title.trim()) return toast.error('Task title is required');
    if (!selectedProject) return toast.error('Select a project first');
    if (!selectedAssignee) return toast.error('Select an assignee');

    if (selectedAssigneeMeta?.assignmentEligible === false) {
      return toast.error('This employee is on approved leave during the deadline');
    }

    try {
      setSaving(true);
      const response = await taskService.createTask({
        title: form.title.trim(),
        description: form.description.trim(),
        assignedTo: selectedAssignee,
        projectId: selectedProject,
        parentTaskId: parentTaskId || undefined,
        deadline: deadline || undefined,
        priority: form.priority,
        category: form.category,
        enforceLeaveConstraint: true
      });
      toast.success(response?.message || 'Task assigned successfully');
      setForm({ title: '', description: '', priority: 'medium', category: 'other' });
      setSelectedAssignee('');
      onAssigned?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to assign task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Smart Single Assignment</p>
        <h3 className="text-lg font-semibold text-slate-900 mt-0.5">Cascading Assign</h3>
        <p className="text-sm text-slate-500 mt-1">Department → Project → Employee (leave-aware)</p>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading hierarchy..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* TIER 1 — Department */}
          <div>
            <label className={labelClass}>1. Department</label>
            <select
              className={inputClass}
              value={selectedDept}
              onChange={(e) => {
                setSelectedDept(e.target.value);
                setSelectedProject('');
                setSelectedAssignee('');
              }}
            >
              <option value="">Select department…</option>
              {departments.map((dept) => (
                <option key={String(dept._id)} value={String(dept._id)}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* TIER 2 — Project */}
          <div>
            <label className={labelClass}>2. Project</label>
            <select
              className={inputClass}
              value={selectedProject}
              disabled={!selectedDept}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setSelectedAssignee('');
              }}
            >
              <option value="">Select project…</option>
              {availableProjects.map((project) => (
                <option key={String(project._id)} value={String(project._id)}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* TIER 3 — Employee (leave-aware) */}
          <div>
            <label className={labelClass}>3. Assign To</label>
            <select
              className={inputClass}
              value={selectedAssignee}
              disabled={!selectedProject || loadingAssignees}
              onChange={(e) => setSelectedAssignee(e.target.value)}
            >
              <option value="">
                {loadingAssignees ? 'Checking leave availability…' : 'Select employee…'}
              </option>
              {assigneePool.map((user) => {
                const onLeave = user.assignmentEligible === false;
                return (
                  <option key={String(user._id)} value={String(user._id)} disabled={onLeave}>
                    {user.name} ({user.employeeId || user.email}){onLeave ? ' — ON LEAVE' : ''}
                  </option>
                );
              })}
            </select>
            {selectedAssigneeMeta?.leaveConflicts?.length > 0 && (
              <p className="text-[11px] text-red-600 mt-1">
                On approved leave: {formatLeaveDates(selectedAssigneeMeta.leaveConflicts)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Task details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className={labelClass}>Task Title *</label>
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="e.g. Implement login validation"
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Description</label>
          <textarea
            className={`${inputClass} min-h-[60px]`}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
        <div>
          <label className={labelClass}>Deadline</label>
          <input
            type="date"
            className={inputClass}
            value={deadline}
            onChange={(e) => {
              setDeadline(e.target.value);
              setSelectedAssignee('');
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Priority</label>
            <select
              className={inputClass}
              value={form.priority}
              onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select
              className={inputClass}
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {['development', 'design', 'testing', 'documentation', 'meeting', 'admin', 'other'].map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
      >
        {saving ? 'Assigning…' : 'Assign Task'}
      </button>
    </div>
  );
};

export default CascadingAssign;
