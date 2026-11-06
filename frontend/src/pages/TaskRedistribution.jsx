import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import taskService from '../services/taskService';
import { getAllUsers } from '../services/userService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import WorkloadHeatmap from '../components/Tasks/WorkloadHeatmap';

const ACTIVE_STATUSES = ['todo', 'in-progress', 'review'];
const OVERLOAD_THRESHOLD = 5;

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-transparent';

const labelClass = 'block text-xs uppercase tracking-wide text-slate-500 mb-1';

const TaskRedistribution = () => {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [drafts, setDrafts] = useState({});

  // Smart Redistribute state
  const [leavingUserId, setLeavingUserId] = useState('');
  const [leaveFrom, setLeaveFrom] = useState('');
  const [leaveTo, setLeaveTo] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [redistributing, setRedistributing] = useState(false);
  const [heatmap, setHeatmap] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [taskRes, userRes] = await Promise.all([
          taskService.getAllTasks({ page: 1, limit: 500 }),
          getAllUsers({ page: 1, limit: 500 })
        ]);
        const taskRows = Array.isArray(taskRes?.data) ? taskRes.data : [];
        const userRows = Array.isArray(userRes?.data) ? userRes.data : [];
        setTasks(taskRows);
        setUsers(userRows.filter((user) => user.role !== 'admin'));
        setDrafts(taskRows.reduce((acc, task) => ({
          ...acc,
          [task._id]: {
            assignedTo: task.assignedTo?._id || task.assignedTo || '',
            status: task.status || 'todo',
            priority: task.priority || 'medium',
            deadline: task.deadline ? String(task.deadline).slice(0, 10) : ''
          }
        }), {}));
        setError('');
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load redistribution board');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  // ---- Per-owner active workload (equilibrium baseline) ----
  const workloadByAssignee = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!ACTIVE_STATUSES.includes(task.status)) return;
      const id = task.assignedTo?._id || task.assignedTo;
      if (!id) return;
      map[String(id)] = (map[String(id)] || 0) + 1;
    });
    return map;
  }, [tasks]);

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((user) => { map[String(user._id)] = user; });
    return map;
  }, [users]);

  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => new Date(a.deadline || 0) - new Date(b.deadline || 0)), [tasks]);

  const handleSave = async (task) => {
    const draft = drafts[task._id];
    if (!draft) return;

    try {
      setSavingId(task._id);
      await taskService.updateTask(task._id, {
        assignedTo: draft.assignedTo || task.assignedTo?._id || task.assignedTo,
        status: draft.status,
        priority: draft.priority,
        deadline: draft.deadline || undefined
      });
      toast.success('Task reassigned');
      const updated = await taskService.getAllTasks({ page: 1, limit: 500 });
      setTasks(Array.isArray(updated?.data) ? updated.data : []);
      setPreview(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update task');
    } finally {
      setSavingId('');
    }
  };

  // ---- Hierarchical peer preview (Smart Redistribute) ----
  const handlePreview = async () => {
    if (!leavingUserId) return toast.error('Select the employee going on leave');
    try {
      setPreviewing(true);
      setPreview(null);
      const response = await taskService.previewRedistribution({
        leavingUserId,
        from: leaveFrom || undefined,
        to: leaveTo || undefined
      });
      setPreview(response?.data || null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to find available peers');
    } finally {
      setPreviewing(false);
    }
  };

  // ---- Commit: reassign every active task of the leaving employee ----
  const handleSmartRedistribute = async () => {
    if (!leavingUserId || !preview?.suggestedPeer) return;
    const taskIds = tasks
      .filter((task) => {
        const id = task.assignedTo?._id || task.assignedTo;
        return String(id) === String(leavingUserId) && ACTIVE_STATUSES.includes(task.status);
      })
      .map((task) => task._id);

    if (taskIds.length === 0) return toast.error('No active tasks to redistribute');

    try {
      setRedistributing(true);
      const response = await taskService.smartRedistribute({
        leavingUserId,
        taskIds,
        leave: leaveFrom || leaveTo ? { from: leaveFrom, to: leaveTo } : null
      });
      toast.success(response?.message || 'Tasks redistributed');
      setPreview(null);
      setLeavingUserId('');
      const updated = await taskService.getAllTasks({ page: 1, limit: 500 });
      setTasks(Array.isArray(updated?.data) ? updated.data : []);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Redistribution failed');
    } finally {
      setRedistributing(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-cyan-900 to-teal-800 text-white p-6 shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Task Redistribution</p>
        <h1 className="text-3xl font-bold mt-1">Reassign and Balance Workloads</h1>
        <p className="text-cyan-100/80 mt-2">
          Hierarchical Smart Redistribute scans the same parent node for available peers and suggests the lowest-workload owner.
        </p>
      </div>

      {/* ---------- Smart Redistribute panel ---------- */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Smart Redistribute</p>
            <h2 className="text-lg font-semibold text-slate-900 mt-0.5">Hierarchical Workload Equilibrium</h2>
            <p className="text-sm text-slate-500 mt-1">
              Select an employee going on leave — the system scans the same parent node, filters out peers with conflicting
              approved leave, and suggests the peer with the lowest active workload.
            </p>
          </div>
          {leavingUserId && workloadByAssignee[String(leavingUserId)] >= OVERLOAD_THRESHOLD && (
            <button
              type="button"
              onClick={() => setHeatmap({ id: leavingUserId, name: userMap[String(leavingUserId)]?.name || 'Employee' })}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-300 px-3 py-1.5 text-sm font-semibold text-orange-700 hover:bg-orange-100 transition-colors"
              title="Drill into the weekly workload heatmap (Mon–Sun)"
            >
              ⚠ Overloaded — view heatmap
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div className="md:col-span-2">
            <label className={labelClass}>Employee going on leave</label>
            <select
              className={inputClass}
              value={leavingUserId}
              onChange={(e) => {
                setLeavingUserId(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">Select employee…</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.name} ({user.employeeId || user.email}) — {workloadByAssignee[String(user._id)] || 0} active
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Leave from</label>
            <input type="date" className={inputClass} value={leaveFrom} onChange={(e) => { setLeaveFrom(e.target.value); setPreview(null); }} />
          </div>
          <div>
            <label className={labelClass}>Leave to</label>
            <input type="date" className={inputClass} value={leaveTo} onChange={(e) => { setLeaveTo(e.target.value); setPreview(null); }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing || !leavingUserId}
            className="rounded-lg bg-cyan-700 px-5 py-2 text-sm font-semibold text-white hover:bg-cyan-600 transition-colors disabled:opacity-50"
          >
            {previewing ? 'Scanning peers…' : 'Find Available Peers'}
          </button>
          <button
            type="button"
            onClick={handleSmartRedistribute}
            disabled={redistributing || !preview?.suggestedPeer}
            className="rounded-lg bg-emerald-700 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            title={preview?.suggestedPeer ? `Reassign all active tasks to ${preview.suggestedPeer.name}` : 'Preview peers first'}
          >
            {redistributing ? 'Redistributing…' : preview?.suggestedPeer
              ? `Reassign all active tasks → ${preview.suggestedPeer.name}`
              : 'Redistribute'}
          </button>
        </div>

        {/* Peer preview with workload equilibrium bars */}
        {preview && (
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
              Peers in the same hierarchy node ({preview.peers.length})
            </p>
            <div className="space-y-2">
              {preview.peers.map((peer) => {
                const max = Math.max(1, ...preview.peers.map((p) => p.activeWorkload));
                const suggested = preview.suggestedPeer && String(preview.suggestedPeer._id) === String(peer._id);
                return (
                  <div
                    key={String(peer._id)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                      suggested ? 'bg-emerald-50 border border-emerald-300' : 'bg-white border border-slate-200'
                    }`}
                  >
                    <div className="w-44 shrink-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{peer.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{peer.email}</p>
                    </div>
                    <div className="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${suggested ? 'bg-emerald-500' : peer.available ? 'bg-cyan-500' : 'bg-rose-400'}`}
                        style={{ width: `${(peer.activeWorkload / max) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-sm font-bold text-slate-700">{peer.activeWorkload}</span>
                    <span className={`w-24 text-right text-[10px] font-semibold ${peer.available ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {peer.available ? 'Available' : 'On leave'}
                    </span>
                    {suggested && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold">SUGGESTED</span>
                    )}
                  </div>
                );
              })}
            </div>
            {!preview.suggestedPeer && (
              <p className="text-sm text-rose-600 mt-3">
                No available peer found — every candidate in this hierarchy node has conflicting approved leave.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ---------- Manual reassignment cards ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {sortedTasks.map((task) => {
          const ownerId = task.assignedTo?._id || task.assignedTo;
          const ownerWorkload = ownerId ? workloadByAssignee[String(ownerId)] || 0 : 0;
          const overloaded = ownerWorkload >= OVERLOAD_THRESHOLD;

          return (
            <div key={task._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{task.description || 'No description'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {overloaded && (
                    <button
                      type="button"
                      onClick={() => setHeatmap({ id: ownerId, name: task.assignedTo?.name || 'Employee' })}
                      className="text-[10px] px-2 py-1 rounded-full bg-orange-100 border border-orange-300 text-orange-700 font-bold hover:bg-orange-200 transition-colors"
                      title="Click to drill into the weekly workload heatmap (Mon–Sun)"
                    >
                      ⚠ {ownerWorkload} LOADED
                    </button>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${task.status === 'done' ? 'bg-emerald-50 text-emerald-700' : task.status === 'in-progress' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{task.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <label className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Assignee</span>
                  <select
                    value={drafts[task._id]?.assignedTo || ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [task._id]: { ...prev[task._id], assignedTo: e.target.value } }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>{user.name} ({user.role})</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Priority</span>
                  <select
                    value={drafts[task._id]?.priority || 'medium'}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [task._id]: { ...prev[task._id], priority: e.target.value } }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Status</span>
                  <select
                    value={drafts[task._id]?.status || 'todo'}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [task._id]: { ...prev[task._id], status: e.target.value } }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="todo">To Do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Deadline</span>
                  <input
                    type="date"
                    value={drafts[task._id]?.deadline || ''}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [task._id]: { ...prev[task._id], deadline: e.target.value } }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  Current owner: {task.assignedTo?.name || task.assignedTo?.email || 'Unknown'}
                  {ownerId && <span className="text-cyan-700 font-semibold"> • {ownerWorkload} active task(s)</span>}
                </div>
                <button
                  type="button"
                  onClick={() => handleSave(task)}
                  disabled={savingId === task._id}
                  className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600 disabled:opacity-50"
                >
                  {savingId === task._id ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drill-down workload heatmap (Mon-Sun) */}
      {heatmap && (
        <WorkloadHeatmap
          userId={heatmap.id}
          userName={heatmap.name}
          onClose={() => setHeatmap(null)}
        />
      )}
    </div>
  );
};

export default TaskRedistribution;
