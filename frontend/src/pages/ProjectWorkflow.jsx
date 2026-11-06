import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import projectService from '../services/projectService';
import taskService from '../services/taskService';
import { getAllUsers } from '../services/userService';
import { getAllDepartments } from '../services/departmentService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';
import CascadingAssign from '../components/Tasks/CascadingAssign';

const STATUS_LABELS = {
  draft: 'Draft',
  assigned_to_hr: 'With HR',
  assigned_to_manager: 'With Manager',
  in_execution: 'In Execution',
  manager_review: 'Manager Review',
  hr_review: 'HR Review',
  ceo_review: 'CEO Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  rejected: 'Rejected'
};

const WORKFLOW_STEPS = [
  { key: 'draft', label: 'Draft', owner: 'CEO' },
  { key: 'assigned_to_hr', label: 'HR review', owner: 'HR' },
  { key: 'assigned_to_manager', label: 'Manager', owner: 'Manager' },
  { key: 'in_execution', label: 'Execution', owner: 'Manager' },
  { key: 'manager_review', label: 'Manager review', owner: 'Manager' },
  { key: 'hr_review', label: 'HR review', owner: 'HR' },
  { key: 'ceo_review', label: 'CEO decision', owner: 'CEO' },
  { key: 'approved', label: 'Approved', owner: 'Complete' }
];

const getWorkflowStep = (status) => {
  if (status === 'rejected' || status === 'changes_requested') return 0;
  return Math.max(0, WORKFLOW_STEPS.findIndex((step) => step.key === status));
};

const getWorkflowMessage = (status, role) => {
  if (role === 'admin' && status === 'assigned_to_hr') return 'HR is reviewing this project. CEO actions unlock after HR forwards it for a final decision.';
  if (role === 'admin' && status === 'ceo_review') return 'This project is ready for your final decision.';
  if (role === 'hr' && ['assigned_to_hr', 'hr_review'].includes(status)) return 'Review the project, assign a matching manager, or forward it to the CEO.';
  if (role === 'manager' && status === 'assigned_to_manager') return 'Start execution when the project is ready for delivery.';
  if (role === 'manager' && status === 'in_execution') return 'Assign project tasks to employees before submitting the project for manager review.';
  return `Next owner: ${WORKFLOW_STEPS[getWorkflowStep(status)]?.owner || 'Workflow team'}.`;
};

const getReferenceId = (value) => String(value?._id || value || '');
const FILE_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');
const getWorkspacePath = (role, projectId) => {
  const basePath = role === 'admin' ? '/admin/projects' : role === 'hr' ? '/hr/projects' : '/projects';
  return `${basePath}/${projectId}`;
};

const ProjectWorkflow = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyProject, setBusyProject] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState({});
  const [selectedDepartments, setSelectedDepartments] = useState({});
  const [notes, setNotes] = useState({});
  const [files, setFiles] = useState({});

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await projectService.getProjects({ limit: 200 });
      setProjects(Array.isArray(response?.data) ? response.data : []);
      if (user?.role === 'manager') {
        const taskResponse = await taskService.getAllTasks({ page: 1, limit: 1000 });
        setTasks(Array.isArray(taskResponse?.data) ? taskResponse.data : []);
      }
      if (user?.role === 'admin' || user?.role === 'hr') {
        const [usersResponse, departmentsResponse] = await Promise.all([
          getAllUsers({ status: 'approved', page: 1, limit: 200 }),
          getAllDepartments({ isActive: true, limit: 200 })
        ]);
        setCandidates(Array.isArray(usersResponse?.data) ? usersResponse.data : []);
        setDepartments(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load project workflow');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?.role]);

  const setNote = (projectId, value) => setNotes((current) => ({ ...current, [projectId]: value }));
  const setSelectedUser = (projectId, value) => setSelectedUsers((current) => ({ ...current, [projectId]: value }));
  const setSelectedDepartment = (projectId, value) => setSelectedDepartments((current) => ({ ...current, [projectId]: value }));

  const runAction = async (project, action, payload = {}) => {
    try {
      setBusyProject(project._id);
      await action(project._id, payload);
      toast.success('Project workflow updated');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to update project workflow');
    } finally {
      setBusyProject(null);
    }
  };

  const uploadDocument = async (project) => {
    const file = files[project._id];
    if (!file) {
      toast.error('Choose a document first');
      return;
    }
    try {
      setBusyProject(project._id);
      await projectService.uploadDocument(project._id, file, notes[project._id]);
      setFiles((current) => ({ ...current, [project._id]: null }));
      toast.success('Document uploaded to the project history');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to upload document');
    } finally {
      setBusyProject(null);
    }
  };

  const reviewTask = async (task, decision) => {
    try {
      setBusyProject(task._id);
      await taskService.reviewSubmission(task._id, { decision, note: notes[task._id] || undefined });
      toast.success(decision === 'approved' ? 'Task approved' : 'Changes requested from employee');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Unable to review task');
    } finally {
      setBusyProject(null);
    }
  };

  const actionNote = (project) => ({ note: notes[project._id] || undefined });
  const getProjectTasks = (project) => tasks.filter((task) => String(task.projectId?._id || task.projectId) === String(project._id));
  const getSubmittedTasks = (project) => getProjectTasks(project).filter((task) => task.reviewStatus === 'submitted');
  const getApprovedTaskCount = (project) => getProjectTasks(project).filter((task) => task.reviewStatus === 'approved').length;
  const hrCandidates = candidates.filter((candidate) => candidate.role === 'hr');
  const managerCandidates = candidates.filter((candidate) => candidate.role === 'manager');
  const isBusy = (project) => busyProject === project._id;

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={fetchData} />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Project workflow</p>
        <h1 className="text-3xl font-bold text-slate-900 mt-1">{user?.role === 'admin' ? 'CEO Project Decisions' : `${user?.role === 'hr' ? 'HR' : 'Manager'} Project Queue`}</h1>
        <p className="text-slate-600 mt-2">Every handoff is recorded and each role can only perform its next workflow action.</p>
      </header>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-500">No projects are waiting in your workflow queue.</div>
      ) : (
        <div className="space-y-4">
          {projects.map((project) => (
            <article key={project._id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-slate-900">{project.name}</h2>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                      {STATUS_LABELS[project.workflowStatus] || project.workflowStatus}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2">{project.description || 'No project description provided.'}</p>
                  <div className="mt-3 text-sm text-slate-600 flex flex-wrap gap-x-5 gap-y-1">
                    <span>HR: {project.assignedHr?.name || 'Unassigned'}</span>
                    <span>Manager: {project.assignedManager?.name || 'Unassigned'}</span>
                    <span>Department: {project.assignedDepartment?.name || 'Unassigned'}</span>
                  </div>
                  <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow progress</span>
                      <span className="text-xs font-semibold text-indigo-700">Step {getWorkflowStep(project.workflowStatus) + 1} of {WORKFLOW_STEPS.length}</span>
                    </div>
                    <div className="mt-3 flex items-center gap-1">
                      {WORKFLOW_STEPS.map((step, index) => (
                        <div key={step.key} className="flex-1" title={`${step.label} - ${step.owner}`}>
                          <div className={`h-2 rounded-full ${index <= getWorkflowStep(project.workflowStatus) ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-600">{getWorkflowMessage(project.workflowStatus, user?.role)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button type="button" onClick={() => navigate(getWorkspacePath(user?.role, project._id))} className="font-semibold text-indigo-700 hover:text-indigo-900">Open workspace</button>
                  <span className="text-slate-500">{project.workflowHistory?.length || 0} workflow events</span>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 border-t border-slate-100 pt-4">
                <div className="space-y-3">
                  {user?.role === 'manager' && getSubmittedTasks(project).length > 0 && (
                    <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-indigo-900">Employee submissions awaiting review</h3>
                        <span className="text-xs font-semibold text-indigo-700">{getSubmittedTasks(project).length} awaiting review</span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {getSubmittedTasks(project).map((task) => (
                          <div key={task._id} className="bg-white rounded-lg border border-indigo-100 p-3">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <p className="font-medium text-slate-900">{task.title}</p>
                                <p className="text-xs text-slate-500 mt-1">Submitted by {task.assignedTo?.name || 'Employee'}{task.submission?.submittedAt ? ` on ${new Date(task.submission.submittedAt).toLocaleString()}` : ''}</p>
                                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                                  {task.submission?.repositoryUrl && <a href={task.submission.repositoryUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">Open repository</a>}
                                  {task.submission?.pullRequestUrl && <a href={task.submission.pullRequestUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">Open pull request</a>}
                                  {task.submission?.documentationLinks?.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">Open documentation</a>)}
                                  {task.attachments?.map((attachment) => <a key={attachment.url} href={`${FILE_BASE_URL}${attachment.url}`} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">View {attachment.filename}</a>)}
                                </div>
                                {task.submission?.completionNotes && <p className="mt-2 rounded-md bg-slate-50 p-2 text-sm text-slate-700">{task.submission.completionNotes}</p>}
                              </div>
                              <div className="flex gap-2">
                                <button type="button" disabled={isBusy(task)} onClick={() => reviewTask(task, 'approved')} className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg disabled:opacity-50">Approve Task</button>
                                <button type="button" disabled={isBusy(task) || !notes[task._id]} onClick={() => reviewTask(task, 'changes_requested')} className="px-3 py-1.5 text-sm bg-amber-100 text-amber-800 rounded-lg disabled:opacity-50">Request Changes</button>
                              </div>
                            </div>
                            <textarea value={notes[task._id] || ''} onChange={(event) => setNote(task._id, event.target.value)} rows={2} placeholder="Review note, required for changes" className="mt-2 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {user?.role === 'manager' && project.workflowStatus === 'in_execution' && getProjectTasks(project).length > 0 && getSubmittedTasks(project).length === 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      {getApprovedTaskCount(project)} of {getProjectTasks(project).length} tasks approved. Waiting for employee submissions or remaining task work.
                    </div>
                  )}
                  {(user?.role === 'admin' && ['draft', 'rejected'].includes(project.workflowStatus)) && (
                    <div className="flex flex-wrap gap-2">
                      <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={selectedUsers[project._id] || ''} onChange={(event) => setSelectedUser(project._id, event.target.value)}>
                        <option value="">Select HR</option>
                        {hrCandidates.map((candidate) => <option key={candidate._id || candidate.id} value={candidate._id || candidate.id}>{candidate.name}</option>)}
                      </select>
                      <button type="button" disabled={!selectedUsers[project._id] || isBusy(project)} onClick={() => runAction(project, projectService.assignToHr, { hrId: selectedUsers[project._id], ...actionNote(project) })} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Assign to HR</button>
                    </div>
                  )}

                  {user?.role === 'admin' && project.workflowStatus === 'assigned_to_hr' && (
                    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <span className="text-sm text-amber-900">Waiting for HR review and handoff.</span>
                      <button type="button" onClick={() => navigate('/admin/projects')} className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">Open project workspace</button>
                    </div>
                  )}

                  {(user?.role === 'hr' && ['assigned_to_hr', 'hr_review'].includes(project.workflowStatus)) && (
                    <div className="flex flex-wrap gap-2">
                      <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={selectedUsers[project._id] || ''} onChange={(event) => setSelectedUser(project._id, event.target.value)}>
                        <option value="">Select manager</option>
                        {managerCandidates.map((candidate) => <option key={candidate._id || candidate.id} value={candidate._id || candidate.id}>{candidate.name}</option>)}
                      </select>
                      <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={selectedDepartments[project._id] || getReferenceId(project.assignedDepartment || project.departmentId)} onChange={(event) => setSelectedDepartment(project._id, event.target.value)}>
                        <option value="">Select project department</option>
                        {departments.map((department) => <option key={department._id} value={department._id}>{department.name}</option>)}
                      </select>
                      <button type="button" disabled={!selectedUsers[project._id] || !(selectedDepartments[project._id] || getReferenceId(project.assignedDepartment || project.departmentId)) || isBusy(project)} onClick={() => runAction(project, projectService.assignToManager, { managerId: selectedUsers[project._id], departmentId: selectedDepartments[project._id] || getReferenceId(project.assignedDepartment || project.departmentId), ...actionNote(project) })} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Assign Manager & Department</button>
                      {project.workflowStatus === 'hr_review' && <button type="button" disabled={isBusy(project)} onClick={() => runAction(project, projectService.forwardToCeo, actionNote(project))} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">Send to CEO</button>}
                    </div>
                  )}

                  {user?.role === 'manager' && project.workflowStatus === 'assigned_to_manager' && (
                    <button type="button" disabled={isBusy(project)} onClick={() => runAction(project, projectService.startExecution, actionNote(project))} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Start Execution</button>
                  )}
                  {user?.role === 'manager' && project.workflowStatus === 'in_execution' && (
                    <div className="space-y-3">
                      <CascadingAssign
                        defaultProjectId={project._id}
                        defaultDeptId={getReferenceId(project.assignedDepartment || project.departmentId)}
                        onAssigned={fetchData}
                      />
                      <button type="button" disabled={isBusy(project) || getProjectTasks(project).length === 0} onClick={() => runAction(project, projectService.submitManagerReview, actionNote(project))} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">Submit for Manager Review</button>
                      {getProjectTasks(project).length === 0 && <p className="text-xs text-amber-700">Assign at least one project task before submitting for review.</p>}
                    </div>
                  )}
                  {user?.role === 'manager' && project.workflowStatus === 'manager_review' && (
                    <div className="flex flex-wrap gap-2">
                      <span className="basis-full text-sm font-medium text-slate-600">All project tasks approved. Send this project to HR for review.</span>
                      <button type="button" disabled={isBusy(project)} onClick={() => runAction(project, projectService.forwardToHr, actionNote(project))} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm disabled:opacity-50">Send to HR</button>
                      <button type="button" disabled={isBusy(project) || !notes[project._id]} onClick={() => runAction(project, projectService.requestChanges, actionNote(project))} className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm disabled:opacity-50">Request Changes</button>
                    </div>
                  )}
                  {user?.role === 'hr' && project.workflowStatus === 'hr_review' && notes[project._id] && (
                    <button type="button" disabled={isBusy(project)} onClick={() => runAction(project, projectService.requestChanges, actionNote(project))} className="px-3 py-2 bg-amber-100 text-amber-800 rounded-lg text-sm disabled:opacity-50">Request Changes</button>
                  )}
                  {user?.role === 'hr' && project.workflowStatus === 'hr_review' && (
                    <p className="text-sm text-slate-600">Review the manager handoff, project documents, and task history, then use <strong>Send to CEO</strong> when the project is ready for executive review.</p>
                  )}
                  {user?.role === 'admin' && project.workflowStatus === 'ceo_review' && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={isBusy(project)} onClick={() => runAction(project, projectService.decide, { decision: 'approved', ...actionNote(project) })} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50">Approve Project</button>
                      <button type="button" disabled={isBusy(project) || !notes[project._id]} onClick={() => runAction(project, projectService.decide, { decision: 'rejected', ...actionNote(project) })} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-sm disabled:opacity-50">Reject Project</button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <input type="text" value={notes[project._id] || ''} onChange={(event) => setNote(project._id, event.target.value)} placeholder="Handoff or review note" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.md,.txt" onChange={(event) => setFiles((current) => ({ ...current, [project._id]: event.target.files?.[0] || null }))} className="text-sm text-slate-600" />
                    <button type="button" disabled={!files[project._id] || isBusy(project)} onClick={() => uploadDocument(project)} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm disabled:opacity-50">Upload Document</button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectWorkflow;
