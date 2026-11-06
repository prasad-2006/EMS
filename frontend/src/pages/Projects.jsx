import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useNavigationContext } from '../context/NavigationContext';
import ProjectTree from '../components/Projects/ProjectTree';
import GanttChart from '../components/Projects/GanttChart';
import TaskEditModal from '../components/Tasks/TaskEditModal';
import taskService from '../services/taskService';
import projectService from '../services/projectService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import ProjectCreateModal from '../components/Projects/ProjectCreateModal';

/**
 * Projects — Nested Aggregation View + Gantt Deep Drill.
 * Parent cards roll up progress %, task counts and members-on-leave from all
 * child nodes. Clicking a card's progress bar replaces the main view with a
 * Gantt chart of every task under that node; clicking a task bar opens the
 * Task Edit Modal (secondary drill).
 *
 * Projects are always fetched directly from the API as well, so every project
 * stays visible on this page even when it has not been linked to a department
 * in the navigation hierarchy.
 */
const STATUS_STYLES = {
  planned: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-blue-100 text-blue-700',
  'on-hold': 'bg-amber-100 text-amber-700',
  cancelled: 'bg-rose-100 text-rose-700',
};

const FlatProjectCard = ({ project, onOpenGantt, onOpenWorkspace, canManage, selected, onToggle, onEdit }) => {
  const statusStyle = STATUS_STYLES[project.status] || 'bg-slate-100 text-slate-700';

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {canManage && (
              <input
                type="checkbox"
                aria-label={`Select ${project.name}`}
                checked={selected}
                onChange={() => onToggle(project._id)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            )}
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
            <h3 className="text-lg font-semibold text-slate-900">{project.name}</h3>
          </div>
          {project.code && <p className="text-xs text-slate-400 mt-0.5">{project.code}</p>}
        </div>
        <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusStyle}`}>
          {project.status}
        </span>
      </div>

      {project.description && (
        <p className="text-sm text-slate-500 mt-2 line-clamp-2">{project.description}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
        {project.startDate && (
          <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>
        )}
        {project.endDate && (
          <span>End: {new Date(project.endDate).toLocaleDateString()}</span>
        )}
      </div>

      <button
        type="button"
        onClick={() => onOpenGantt(project)}
        className="mt-4 text-xs font-semibold text-blue-700 hover:text-blue-800"
      >
        Open Gantt timeline →
      </button>
      <button
        type="button"
        onClick={() => onOpenWorkspace(project)}
        className="mt-4 ml-4 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
      >
        Open workspace
      </button>
      {canManage && (
        <button
          type="button"
          onClick={() => onEdit(project)}
          className="mt-4 ml-4 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          Edit project
        </button>
      )}
    </div>
  );
};

const Projects = () => {
  const { hierarchy, loading: hierarchyLoading, refresh: refreshHierarchy } = useNavigationContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ganttProject, setGanttProject] = useState(null);
  const [ganttTasks, setGanttTasks] = useState([]);
  const [ganttLoading, setGanttLoading] = useState(false);
  const [taskEditTarget, setTaskEditTarget] = useState(null);
  const [editUsers, setEditUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectEditTarget, setProjectEditTarget] = useState(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);

  const fetchProjects = async () => {
    setProjectsLoading(true);
    try {
      const response = await projectService.getProjects({ limit: 500 });
      setProjects(Array.isArray(response?.data) ? response.data : []);
      setSelectedProjectIds([]);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setProjectsLoading(false);
    }
  };

  const toggleProjectSelection = (projectId) => {
    setSelectedProjectIds((currentIds) => (
      currentIds.includes(projectId)
        ? currentIds.filter((id) => id !== projectId)
        : [...currentIds, projectId]
    ));
  };

  const deleteSelectedProjects = async () => {
    if (selectedProjectIds.length === 0) return;
    const confirmed = window.confirm(
      `Delete ${selectedProjectIds.length} selected project${selectedProjectIds.length === 1 ? '' : 's'} permanently? Their child projects will also be removed.`
    );
    if (!confirmed) return;

    try {
      const response = await projectService.bulkDeleteProjects(selectedProjectIds);
      const result = response || {};
      if (result.failed?.length > 0) {
        toast.error(`${result.deleted || 0} deleted, ${result.failed.length} failed`);
      } else {
        toast.success(`${result.deleted || selectedProjectIds.length} project${(result.deleted || selectedProjectIds.length) === 1 ? '' : 's'} deleted successfully`);
      }
      await fetchProjects();
      refreshHierarchy();
    } catch (err) {
      const response = err.response?.data;
      if (response?.deleted > 0) {
        toast.error(`${response.deleted} deleted, ${response.failed?.length || 0} failed`);
        await fetchProjects();
        refreshHierarchy();
      } else {
        toast.error(response?.error || 'Failed to delete selected projects');
      }
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Projects visible through the navigation hierarchy tree.
  const hierarchyProjects = useMemo(() => {
    const found = [];
    const walk = (nodes) => {
      nodes.forEach((node) => {
        if (node.type === 'project') found.push(node);
        if (node.children) walk(node.children);
      });
    };
    walk(hierarchy || []);
    return found;
  }, [hierarchy]);

  const hierarchyDepartments = useMemo(() => {
    const found = [];
    const walk = (nodes) => {
      nodes.forEach((node) => {
        if (node.type === 'department') found.push(node);
        if (node.children) walk(node.children);
      });
    };
    walk(hierarchy || []);
    return found;
  }, [hierarchy]);

  const openGantt = async (node) => {
    setGanttProject({ id: String(node._id), name: node.name });
    setGanttTasks([]);
    setGanttLoading(true);
    try {
      // nodeType=project resolves the node + all descendant sub-projects.
      const [response, workItemResponse] = await Promise.all([
        taskService.getAllTasks({ nodeType: 'project', nodeId: String(node._id), limit: 1000 }),
        projectService.getWorkItems(String(node._id))
      ]);
      const tasks = Array.isArray(response?.data) ? response.data : [];
      const workItems = Array.isArray(workItemResponse?.data) ? workItemResponse.data : [];
      const migratedTaskIds = new Set(workItems.map((item) => String(item.legacyTaskId)).filter(Boolean));
      const planningItems = workItems
        .filter((item) => !item.legacyTaskId)
        .map((item) => ({
          ...item,
          _id: `work-item-${item._id}`,
          status: item.status === 'approved' ? 'done' : item.status === 'in-progress' ? 'in-progress' : item.status === 'cancelled' ? 'cancelled' : 'todo'
        }));
      setGanttTasks([...tasks.filter((task) => !migratedTaskIds.has(String(task._id))), ...planningItems]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load project tasks');
    } finally {
      setGanttLoading(false);
    }
  };

  // Secondary drill: clicking a Gantt bar opens the Task Edit Modal.
  const openTaskEdit = async (task) => {
    setTaskEditTarget(task);
    setEditUsers([]);
    try {
      const deadline = task.deadline ? String(task.deadline).slice(0, 10) : undefined;
      const response = await taskService.getUsersForAssignment({ deadline: deadline || undefined });
      setEditUsers(Array.isArray(response?.data) ? response.data : []);
    } catch (err) {
      setEditUsers([]);
    }
  };

  const hasProjects = projects.length > 0 || hierarchyProjects.length > 0;
  const openWorkspace = (project) => {
    const basePath = user?.role === 'admin' ? '/admin/projects' : user?.role === 'hr' ? '/hr/projects' : '/projects';
    navigate(`${basePath}/${project._id}`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-cyan-900 text-white p-6 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Projects</p>
          <h1 className="text-3xl font-bold mt-1">Nested Project Workspaces</h1>
          <p className="text-cyan-100/80 mt-2">
            Parent cards aggregate all sub-project metrics. Click any progress bar to open the Gantt deep drill.
          </p>
        </div>
        {user?.role === 'admin' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="shrink-0 px-5 py-2.5 bg-white text-indigo-900 rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-50 transition-colors"
          >
            + Create Project
          </button>
        )}
      </div>

      {hierarchyLoading || projectsLoading ? (
        <LoadingSpinner fullPage />
      ) : hasProjects ? (
        <div className="space-y-8">
          {hierarchyProjects.length > 0 ? (
            <ProjectTree roots={hierarchy} onOpenGantt={openGantt} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {projects.map((project) => (
                  <FlatProjectCard
                    key={String(project._id)}
                    project={project}
                    onOpenGantt={openGantt}
                    onOpenWorkspace={openWorkspace}
                    canManage={user?.role === 'admin'}
                    selected={selectedProjectIds.includes(project._id)}
                    onToggle={toggleProjectSelection}
                    onEdit={setProjectEditTarget}
                  />
              ))}
            </div>
          )}

          {/* Always show the flat list of all projects as well */}
          <section>
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900">All Projects</h2>
                {user?.role === 'admin' && <span className="text-sm text-slate-500">{selectedProjectIds.length} selected</span>}
              </div>
              {user?.role === 'admin' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedProjectIds(selectedProjectIds.length === projects.length ? [] : projects.map((project) => project._id))}
                    className="px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    {selectedProjectIds.length === projects.length ? 'Clear Selection' : 'Select All'}
                  </button>
                  <button
                    type="button"
                    onClick={deleteSelectedProjects}
                    disabled={selectedProjectIds.length === 0}
                    className="px-3 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete Selected
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {projects.map((project) => (
                <FlatProjectCard
                  key={String(project._id)}
                  project={project}
                  onOpenGantt={openGantt}
                  onOpenWorkspace={openWorkspace}
                  canManage={user?.role === 'admin'}
                  selected={selectedProjectIds.includes(project._id)}
                  onToggle={toggleProjectSelection}
                  onEdit={setProjectEditTarget}
                />
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          No projects found yet. Projects created by the administrator will appear here.
          <button
            type="button"
            onClick={() => {
              fetchProjects();
              refreshHierarchy();
            }}
            className="block mx-auto mt-4 text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Gantt deep drill */}
      {ganttProject && (
        <GanttChart
          tasks={ganttTasks}
          title={ganttProject.name}
          onClose={() => setGanttProject(null)}
          onTaskClick={openTaskEdit}
        />
      )}

      {/* Loading overlay while Gantt data streams in */}
      {ganttProject && ganttLoading && (
        <div className="fixed inset-0 z-40 bg-slate-900/30 flex items-center justify-center">
          <LoadingSpinner label="Loading Gantt timeline..." />
        </div>
      )}

      {/* Secondary drill: task editor */}
      {taskEditTarget && (
        <TaskEditModal
          task={taskEditTarget}
          users={editUsers}
          onClose={() => setTaskEditTarget(null)}
          onSaved={() => {
            setTaskEditTarget(null);
            if (ganttProject) openGantt({ _id: ganttProject.id, name: ganttProject.name });
          }}
          onDeleted={() => {
            setTaskEditTarget(null);
            if (ganttProject) openGantt({ _id: ganttProject.id, name: ganttProject.name });
          }}
        />
      )}

      {/* Project Create Modal */}
      {showCreateModal && (
        <ProjectCreateModal
          departments={hierarchyDepartments}
          onClose={() => setShowCreateModal(false)}
          onSaved={() => {
            setShowCreateModal(false);
            fetchProjects();
            refreshHierarchy();
          }}
        />
      )}

      {projectEditTarget && (
        <ProjectCreateModal
          project={projectEditTarget}
          departments={hierarchyDepartments}
          onClose={() => setProjectEditTarget(null)}
          onSaved={() => {
            setProjectEditTarget(null);
            fetchProjects();
            refreshHierarchy();
          }}
        />
      )}
    </div>
  );
};

export default Projects;