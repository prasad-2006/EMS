import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import projectService from '../services/projectService';
import taskService from '../services/taskService';
import { getAllUsers } from '../services/userService';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorMessage from '../components/Common/ErrorMessage';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5001/api').replace(/\/api\/?$/, '');

const statusLabels = {
  draft: 'Draft',
  assigned_to_hr: 'With HR',
  assigned_to_manager: 'With Manager',
  in_execution: 'In Execution',
  manager_review: 'Manager Review',
  hr_review: 'HR Review',
  ceo_review: 'CEO Review',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes Requested'
};

const taskStatusLabels = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  review: 'In Review',
  done: 'Done',
  rejected: 'Changes Requested',
  cancelled: 'Cancelled'
};

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : 'Not set';

const ProjectWorkspace = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [workItems, setWorkItems] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [capacity, setCapacity] = useState([]);
  const [weeklyCapacity, setWeeklyCapacity] = useState(null);
  const [resourceRequests, setResourceRequests] = useState([]);
  const [skills, setSkills] = useState([]);
  const [risks, setRisks] = useState([]);
  const [issues, setIssues] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [criticalPath, setCriticalPath] = useState({ totalHours: 0, workItems: [] });
  const [conversations, setConversations] = useState([]);
  const [comments, setComments] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [approvalGates, setApprovalGates] = useState([]);
  const [memberCandidates, setMemberCandidates] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workItemForm, setWorkItemForm] = useState({ title: '', type: 'task', priority: 'medium', estimateHours: '' });
  const [milestoneForm, setMilestoneForm] = useState({ name: '', dueDate: '' });
  const [memberForm, setMemberForm] = useState({ userId: '', projectRole: 'member', allocationPercent: 100 });
  const [savingPlan, setSavingPlan] = useState(false);
  const [conversationTitle, setConversationTitle] = useState('Project discussion');
  const [commentBody, setCommentBody] = useState('');
  const [decisionForm, setDecisionForm] = useState({ title: '', context: '', decision: '' });
  const [gateForm, setGateForm] = useState({ name: '', stage: 'manager_review', approverRole: 'manager' });
  const [resourceForm, setResourceForm] = useState({ roleTitle: '', skillId: '', allocationPercent: 100, headcount: 1, reason: '' });
  const [governanceForm, setGovernanceForm] = useState({ title: '', description: '', impact: 'medium' });

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      const [projectResponse, taskResponse, auditResponse, workItemResponse, milestoneResponse, capacityResponse, peopleResponse, criticalPathResponse, conversationsResponse, decisionsResponse, submissionsResponse, reviewsResponse, gatesResponse, weeklyCapacityResponse, resourceRequestsResponse, skillsResponse, risksResponse, issuesResponse, changeRequestsResponse] = await Promise.all([
        projectService.getProjectById(id),
        taskService.getAllTasks({ projectId: id, page: 1, limit: 500 }),
        projectService.getAuditEvents(id),
        projectService.getWorkItems(id),
        projectService.getMilestones(id),
        projectService.getProjectCapacity(id),
        ['admin', 'hr', 'manager'].includes(user?.role) ? getAllUsers({ status: 'approved', page: 1, limit: 200 }) : Promise.resolve({ data: [] }),
        projectService.getCriticalPath(id),
        projectService.getConversations(id),
        projectService.getDecisions(id),
        projectService.getSubmissions(id),
        projectService.getReviews(id),
        projectService.getApprovalGates(id),
        projectService.getWeeklyCapacity(id),
        ['admin', 'hr', 'manager'].includes(user?.role) ? projectService.getResourceRequests(id) : Promise.resolve({ data: [] }),
        ['admin', 'hr', 'manager'].includes(user?.role) ? projectService.getSkills() : Promise.resolve({ data: [] }),
        projectService.getRisks(id),
        projectService.getIssues(id),
        projectService.getChangeRequests(id)
      ]);
      setProject(projectResponse?.data?.project || projectResponse?.data || null);
      setTasks(Array.isArray(taskResponse?.data) ? taskResponse.data : []);
      setAuditEvents(Array.isArray(auditResponse?.data) ? auditResponse.data : []);
      setWorkItems(Array.isArray(workItemResponse?.data) ? workItemResponse.data : []);
      setMilestones(Array.isArray(milestoneResponse?.data) ? milestoneResponse.data : []);
      setCapacity(Array.isArray(capacityResponse?.data) ? capacityResponse.data : []);
      setMemberCandidates(Array.isArray(peopleResponse?.data) ? peopleResponse.data : []);
      setCriticalPath(criticalPathResponse?.data || { totalHours: 0, workItems: [] });
      const conversationData = Array.isArray(conversationsResponse?.data) ? conversationsResponse.data : [];
      setConversations(conversationData);
      setDecisions(Array.isArray(decisionsResponse?.data) ? decisionsResponse.data : []);
      setSubmissions(Array.isArray(submissionsResponse?.data) ? submissionsResponse.data : []);
      setReviews(Array.isArray(reviewsResponse?.data) ? reviewsResponse.data : []);
      setApprovalGates(Array.isArray(gatesResponse?.data) ? gatesResponse.data : []);
      setWeeklyCapacity(weeklyCapacityResponse?.data || null);
      setResourceRequests(Array.isArray(resourceRequestsResponse?.data) ? resourceRequestsResponse.data : []);
      setSkills(Array.isArray(skillsResponse?.data) ? skillsResponse.data : []);
      setRisks(Array.isArray(risksResponse?.data) ? risksResponse.data : []);
      setIssues(Array.isArray(issuesResponse?.data) ? issuesResponse.data : []);
      setChangeRequests(Array.isArray(changeRequestsResponse?.data) ? changeRequestsResponse.data : []);
      if (conversationData[0]?._id) {
        const commentResponse = await projectService.getComments(conversationData[0]._id);
        setComments(Array.isArray(commentResponse?.data) ? commentResponse.data : []);
      } else {
        setComments([]);
      }
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load project workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [id]);

  const taskSummary = useMemo(() => tasks.reduce((summary, task) => {
    summary.total += 1;
    summary[task.status] = (summary[task.status] || 0) + 1;
    if (task.reviewStatus === 'submitted') summary.submitted += 1;
    if (task.reviewStatus === 'approved') summary.approved += 1;
    return summary;
  }, { total: 0, submitted: 0, approved: 0 }), [tasks]);
  const canPlan = ['admin', 'hr', 'manager'].includes(user?.role);
  const canApproveGate = (gate) => {
    if (user?.role === 'admin') return ['admin', 'stakeholder'].includes(gate.approverRole);
    if (gate.approverRole === 'manager') return user?._id === project?.assignedManager?._id;
    if (gate.approverRole === 'hr') return user?._id === project?.assignedHr?._id;
    return ['qa', 'stakeholder'].includes(gate.approverRole) && project?.members?.some((member) => member._id === user?._id);
  };

  const createWorkItem = async (event) => {
    event.preventDefault();
    if (!workItemForm.title.trim()) return;
    try {
      setSavingPlan(true);
      await projectService.createWorkItem(id, { ...workItemForm, estimateHours: workItemForm.estimateHours ? Number(workItemForm.estimateHours) : undefined });
      setWorkItemForm({ title: '', type: 'task', priority: 'medium', estimateHours: '' });
      await loadWorkspace();
    } finally {
      setSavingPlan(false);
    }
  };

  const createMilestone = async (event) => {
    event.preventDefault();
    if (!milestoneForm.name.trim()) return;
    try {
      setSavingPlan(true);
      await projectService.createMilestone(id, milestoneForm);
      setMilestoneForm({ name: '', dueDate: '' });
      await loadWorkspace();
    } finally {
      setSavingPlan(false);
    }
  };

  const assignMember = async (event) => {
    event.preventDefault();
    if (!memberForm.userId) return;
    try {
      setSavingPlan(true);
      await projectService.assignProjectMember(id, { ...memberForm, allocationPercent: Number(memberForm.allocationPercent) });
      setMemberForm({ userId: '', projectRole: 'member', allocationPercent: 100 });
      await loadWorkspace();
    } finally {
      setSavingPlan(false);
    }
  };

  const createConversation = async (event) => {
    event.preventDefault();
    if (!conversationTitle.trim()) return;
    await projectService.createConversation(id, { title: conversationTitle.trim() });
    await loadWorkspace();
  };

  const sendComment = async (event) => {
    event.preventDefault();
    if (!conversations[0]?._id || !commentBody.trim()) return;
    await projectService.createComment(conversations[0]._id, { body: commentBody.trim() });
    setCommentBody('');
    await loadWorkspace();
  };

  const createDecision = async (event) => {
    event.preventDefault();
    if (!decisionForm.title.trim()) return;
    await projectService.createDecision(id, decisionForm);
    setDecisionForm({ title: '', context: '', decision: '' });
    await loadWorkspace();
  };

  const createGate = async (event) => {
    event.preventDefault();
    if (!gateForm.name.trim()) return;
    await projectService.createApprovalGate(id, gateForm);
    setGateForm({ name: '', stage: 'manager_review', approverRole: 'manager' });
    await loadWorkspace();
  };

  const createResourceRequest = async (event) => {
    event.preventDefault();
    if (!resourceForm.roleTitle.trim()) return;
    await projectService.createResourceRequest(id, { ...resourceForm, allocationPercent: Number(resourceForm.allocationPercent), headcount: Number(resourceForm.headcount) });
    setResourceForm({ roleTitle: '', skillId: '', allocationPercent: 100, headcount: 1, reason: '' });
    await loadWorkspace();
  };

  const createGovernanceRecord = async (event, type) => {
    event.preventDefault();
    if (!governanceForm.title.trim()) return;
    const data = { ...governanceForm };
    if (type === 'risk') await projectService.createRisk(id, data);
    if (type === 'issue') await projectService.createIssue(id, data);
    if (type === 'change') await projectService.createChangeRequest(id, data);
    setGovernanceForm({ title: '', description: '', impact: 'medium' });
    await loadWorkspace();
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error) return <ErrorMessage message={error} onRetry={loadWorkspace} />;
  if (!project) return <ErrorMessage message="Project not found" onRetry={loadWorkspace} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950 to-cyan-900 text-white p-6 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/80">Project workspace</p>
            <h1 className="text-3xl font-bold mt-1">{project.name}</h1>
            <p className="text-cyan-100/80 mt-2">{project.description || 'No project description provided.'}</p>
          </div>
          <span className="px-3 py-1.5 rounded-full bg-white/15 text-sm font-semibold whitespace-nowrap">
            {statusLabels[project.workflowStatus] || project.workflowStatus}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Tasks', taskSummary.total, 'bg-slate-50'],
          ['Submitted', taskSummary.submitted, 'bg-indigo-50'],
          ['Approved', taskSummary.approved, 'bg-emerald-50'],
          ['Start', formatDate(project.startDate), 'bg-blue-50'],
          ['End', formatDate(project.endDate), 'bg-amber-50']
        ].map(([label, value, style]) => (
          <div key={label} className={`rounded-xl border border-slate-200 p-4 ${style}`}>
            <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Project team</h2>
              <p className="text-sm text-slate-500 mt-1">Project-specific ownership and delivery responsibility.</p>
            </div>
            <span className="text-xs text-slate-500">{project.members?.length || 0} members</span>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              ['HR / PMO', project.assignedHr?.name],
              ['Manager', project.assignedManager?.name],
              ['Department', project.assignedDepartment?.name]
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-1 font-medium text-slate-900">{value || 'Unassigned'}</p>
              </div>
            ))}
          </div>
          {project.members?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.members.map((member) => <span key={member._id} className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-800 text-xs">{member.name}</span>)}
            </div>
          )}
          {canPlan && (
            <form onSubmit={assignMember} className="mt-4 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
              <select value={memberForm.userId} onChange={(event) => setMemberForm({ ...memberForm, userId: event.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="">Add project member</option>
                {memberCandidates.map((candidate) => <option key={candidate._id} value={candidate._id}>{candidate.name} ({candidate.role})</option>)}
              </select>
              <select value={memberForm.projectRole} onChange={(event) => setMemberForm({ ...memberForm, projectRole: event.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['member', 'lead', 'qa', 'stakeholder', 'developer', 'designer'].map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <input type="number" min="1" max="100" value={memberForm.allocationPercent} onChange={(event) => setMemberForm({ ...memberForm, allocationPercent: event.target.value })} className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm" aria-label="Allocation percent" />
              <button disabled={savingPlan} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Assign</button>
            </form>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-lg font-semibold text-slate-900">Project documents</h2>
          <div className="mt-4 space-y-2">
            {(project.documents || []).map((document) => (
              <a key={`${document.filename}-${document.uploadedAt}`} href={`${API_ORIGIN}${document.url}`} target="_blank" rel="noreferrer" className="block rounded-lg border border-slate-200 p-3 hover:border-indigo-300">
                <p className="text-sm font-medium text-indigo-700">{document.originalName}</p>
                <p className="text-xs text-slate-500 mt-1">{document.stage || 'Project document'} · {formatDate(document.uploadedAt)}</p>
              </a>
            ))}
            {(!project.documents || project.documents.length === 0) && <p className="text-sm text-slate-500">No project documents uploaded.</p>}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Work items</h2>
            <p className="text-sm text-slate-500 mt-1">Tasks, submissions, and review state for this project.</p>
          </div>
          {user?.role === 'manager' && <Link to="/manager/projects" className="text-sm font-semibold text-indigo-700 hover:text-indigo-900">Open workflow queue</Link>}
        </div>
        <div className="divide-y divide-slate-200">
          {tasks.map((task) => (
            <div key={task._id} className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{task.title}</p>
                <p className="text-sm text-slate-500 mt-1">Assigned to {task.assignedTo?.name || 'Unassigned'} · {taskStatusLabels[task.status] || task.status}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">{task.priority}</span>
                <span className={`px-2.5 py-1 rounded-full ${task.reviewStatus === 'approved' ? 'bg-emerald-50 text-emerald-700' : task.reviewStatus === 'submitted' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>{task.reviewStatus?.replace(/_/g, ' ')}</span>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <p className="p-8 text-center text-sm text-slate-500">No work items have been assigned yet.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Planning work items</h2>
              <p className="text-sm text-slate-500 mt-1">Epics, features, stories, bugs, and planned tasks.</p>
            </div>
            <span className="text-xs text-slate-500">{workItems.length} items</span>
          </div>
          {canPlan && (
            <form onSubmit={createWorkItem} className="mt-4 grid grid-cols-2 gap-2">
              <input value={workItemForm.title} onChange={(event) => setWorkItemForm({ ...workItemForm, title: event.target.value })} placeholder="New work item" className="col-span-2 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <select value={workItemForm.type} onChange={(event) => setWorkItemForm({ ...workItemForm, type: event.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['epic', 'feature', 'story', 'task', 'bug', 'subtask'].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select value={workItemForm.priority} onChange={(event) => setWorkItemForm({ ...workItemForm, priority: event.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
                {['low', 'medium', 'high', 'critical'].map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              <input type="number" min="0" value={workItemForm.estimateHours} onChange={(event) => setWorkItemForm({ ...workItemForm, estimateHours: event.target.value })} placeholder="Estimate hours" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <button disabled={savingPlan} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add work item</button>
            </form>
          )}
          <div className="mt-4 space-y-2">
            {workItems.map((item) => <div key={item._id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-sm font-medium text-slate-900">{item.title}</p><p className="text-xs text-slate-500 mt-1">{item.type} · {item.status} · {item.estimateHours || 0}h</p></div><span className="text-xs text-slate-500">{item.assignedTo?.name || 'Unassigned'}</span></div>)}
            {workItems.length === 0 && <p className="text-sm text-slate-500">No planning work items yet.</p>}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Milestones</h2>
              <p className="text-sm text-slate-500 mt-1">Delivery checkpoints and target dates.</p>
            </div>
            <span className="text-xs text-slate-500">{milestones.length} milestones</span>
          </div>
          {canPlan && (
            <form onSubmit={createMilestone} className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
              <input value={milestoneForm.name} onChange={(event) => setMilestoneForm({ ...milestoneForm, name: event.target.value })} placeholder="Milestone name" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={milestoneForm.dueDate} onChange={(event) => setMilestoneForm({ ...milestoneForm, dueDate: event.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <button disabled={savingPlan} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
            </form>
          )}
          <div className="mt-4 space-y-2">
            {milestones.map((milestone) => <div key={milestone._id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-sm font-medium text-slate-900">{milestone.name}</p><p className="text-xs text-slate-500 mt-1">{milestone.status} · Due {formatDate(milestone.dueDate)}</p></div><span className="text-xs text-slate-500">{milestone.owner?.name || 'Unassigned'}</span></div>)}
            {milestones.length === 0 && <p className="text-sm text-slate-500">No milestones defined yet.</p>}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Submission and approval center</h2><p className="text-sm text-slate-500 mt-1">Versioned employee evidence, review decisions, and workflow gates.</p></div><span className="text-xs text-slate-500">{submissions.length} submissions · {approvalGates.length} gates</span></div>
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 space-y-2">{submissions.map((submission) => <div key={submission._id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-900">{submission.taskId?.title || 'Task submission'} · v{submission.version}</p><span className="text-xs capitalize text-slate-500">{submission.status.replace(/_/g, ' ')}</span></div><p className="text-xs text-slate-500 mt-1">Submitted by {submission.submittedBy?.name || 'Employee'} on {formatDate(submission.submittedAt)}</p><div className="mt-2 flex flex-wrap gap-2 text-xs">{submission.repositoryUrl && <a href={submission.repositoryUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">Repository</a>}{submission.pullRequestUrl && <a href={submission.pullRequestUrl} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">Pull request</a>}{submission.artifacts?.map((artifact) => <a key={artifact.fileUrl} href={`${API_ORIGIN}${artifact.fileUrl}`} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">{artifact.fileName}</a>)}</div></div>)}{submissions.length === 0 && <p className="text-sm text-slate-500">No versioned submissions yet.</p>}</div>
          <div className="space-y-3">{canPlan && <form onSubmit={createGate} className="space-y-2 rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add approval gate</p><input value={gateForm.name} onChange={(event) => setGateForm({ ...gateForm, name: event.target.value })} placeholder="Gate name" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /><div className="grid grid-cols-2 gap-2"><select value={gateForm.stage} onChange={(event) => setGateForm({ ...gateForm, stage: event.target.value })} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">{['manager_review', 'qa_review', 'hr_review', 'stakeholder_review', 'ceo_review'].map((stage) => <option key={stage} value={stage}>{stage.replace(/_/g, ' ')}</option>)}</select><select value={gateForm.approverRole} onChange={(event) => setGateForm({ ...gateForm, approverRole: event.target.value })} className="border border-slate-300 rounded-lg px-2 py-2 text-sm">{['manager', 'qa', 'hr', 'stakeholder', 'admin'].map((role) => <option key={role} value={role}>{role}</option>)}</select></div><button className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Create gate</button></form>}{approvalGates.map((gate) => <div key={gate._id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-900">{gate.name}</p><span className={`text-xs capitalize ${gate.status === 'approved' ? 'text-emerald-700' : 'text-amber-700'}`}>{gate.status}</span></div><p className="text-xs text-slate-500 mt-1">{gate.stage.replace(/_/g, ' ')} · {gate.approverRole}</p>{canApproveGate(gate) && gate.status === 'pending' && <button type="button" onClick={async () => { await projectService.updateApprovalGate(gate._id, { status: 'approved' }); await loadWorkspace(); }} className="mt-2 text-xs font-semibold text-emerald-700">Mark approved</button>}</div>)}</div>
        </div>
        {reviews.length > 0 && <p className="mt-4 text-xs text-slate-500">{reviews.length} review decisions recorded. Latest: {reviews[0].decision.replace(/_/g, ' ')} by {reviews[0].reviewerId?.name || 'Reviewer'}.</p>}
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Governance registers</h2><p className="text-sm text-slate-500 mt-1">Risks, issues, and changes with owners and status.</p></div><span className="text-xs text-slate-500">{risks.length} risks · {issues.length} issues · {changeRequests.length} changes</span></div>
        {canPlan && <form onSubmit={(event) => createGovernanceRecord(event, 'risk')} className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-2"><input value={governanceForm.title} onChange={(event) => setGovernanceForm({ ...governanceForm, title: event.target.value })} placeholder="Risk, issue, or change title" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" /><input value={governanceForm.description} onChange={(event) => setGovernanceForm({ ...governanceForm, description: event.target.value })} placeholder="Description" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" /><select value={governanceForm.impact} onChange={(event) => setGovernanceForm({ ...governanceForm, impact: event.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">{['low', 'medium', 'high', 'critical'].map((impact) => <option key={impact} value={impact}>{impact}</option>)}</select><div className="flex gap-2"><button className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white">Add risk</button><button type="button" onClick={(event) => createGovernanceRecord(event, 'issue')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white">Add issue</button><button type="button" onClick={(event) => createGovernanceRecord(event, 'change')} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Add change</button></div></form>}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">{[[risks, 'Risks', 'rose'], [issues, 'Issues', 'amber'], [changeRequests, 'Change requests', 'indigo']].map(([rows, label, color]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><p className={`text-xs uppercase tracking-wide text-${color}-700`}>{label}</p><div className="mt-2 space-y-2">{rows.slice(0, 5).map((row) => <div key={row._id} className="border-b border-slate-200 pb-2"><p className="text-sm font-medium text-slate-900">{row.title}</p><p className="text-xs text-slate-500 mt-1">{row.status} · {row.impact || row.severity || 'pending'}</p></div>)}{rows.length === 0 && <p className="text-xs text-slate-500">None recorded.</p>}</div></div>)}</div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Resource planning</h2><p className="text-sm text-slate-500 mt-1">Request people by role, skill, allocation, and delivery need.</p></div><span className="text-xs text-slate-500">{resourceRequests.length} requests</span></div>
        {canPlan && <form onSubmit={createResourceRequest} className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-2"><input value={resourceForm.roleTitle} onChange={(event) => setResourceForm({ ...resourceForm, roleTitle: event.target.value })} placeholder="Role needed" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" /><select value={resourceForm.skillId} onChange={(event) => setResourceForm({ ...resourceForm, skillId: event.target.value })} className="border border-slate-300 rounded-lg px-3 py-2 text-sm"><option value="">Skill optional</option>{skills.map((skill) => <option key={skill._id} value={skill._id}>{skill.name}</option>)}</select><input type="number" min="1" max="100" value={resourceForm.allocationPercent} onChange={(event) => setResourceForm({ ...resourceForm, allocationPercent: event.target.value })} placeholder="Allocation %" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" /><input value={resourceForm.reason} onChange={(event) => setResourceForm({ ...resourceForm, reason: event.target.value })} placeholder="Reason" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" /><button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Request resource</button></form>}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">{resourceRequests.map((request) => <div key={request._id} className="rounded-lg border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-900">{request.roleTitle}</p><span className="text-xs capitalize text-slate-500">{request.status}</span></div><p className="text-xs text-slate-500 mt-1">{request.allocationPercent}% · {request.skillId?.name || 'Any skill'}</p>{canPlan && request.status === 'pending' && ['admin', 'hr'].includes(user?.role) && <div className="mt-2 flex gap-2"><button type="button" onClick={async () => { await projectService.updateResourceRequest(request._id, { status: 'approved' }); await loadWorkspace(); }} className="text-xs font-semibold text-emerald-700">Approve</button><button type="button" onClick={async () => { await projectService.updateResourceRequest(request._id, { status: 'rejected' }); await loadWorkspace(); }} className="text-xs font-semibold text-rose-700">Reject</button></div>}</div>)}{resourceRequests.length === 0 && <p className="text-sm text-slate-500">No resource requests for this project.</p>}</div>
        {weeklyCapacity && <p className="mt-4 text-xs text-slate-500">Capacity window: {formatDate(weeklyCapacity.weekStart)} to {formatDate(weeklyCapacity.weekEnd)} · {weeklyCapacity.members?.length || 0} allocated people.</p>}
      </section>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Capacity and allocation</h2>
            <p className="text-sm text-slate-500 mt-1">Weekly allocation, planned work, and approved leave conflicts.</p>
          </div>
          <span className="text-xs text-slate-500">{capacity.length} people</span>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {capacity.map((entry) => <div key={entry.user?._id} className={`rounded-lg border p-3 ${entry.overAllocated ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}><p className="font-medium text-slate-900">{entry.user?.name}</p><p className="text-xs text-slate-500 mt-1">{entry.projectRole} · {entry.allocationPercent}% allocation</p><p className="text-sm mt-2">{entry.plannedHours}h planned / {entry.weeklyCapacityHours}h capacity</p>{entry.approvedLeave && <p className="text-xs text-amber-700 mt-2">Approved leave affects this allocation.</p>}{entry.overAllocated && <p className="text-xs text-rose-700 mt-2">Over allocated</p>}</div>)}
          {capacity.length === 0 && <p className="text-sm text-slate-500">No project allocations recorded yet.</p>}
        </div>
        <div className="mt-5 rounded-lg border border-indigo-100 bg-indigo-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs uppercase tracking-wide text-indigo-700">Critical path</p><p className="text-sm text-indigo-950 mt-1">Longest dependency chain for planned work.</p></div>
            <span className="text-lg font-bold text-indigo-800">{criticalPath.totalHours || 0}h</span>
          </div>
          <p className="text-xs text-indigo-800 mt-2">{criticalPath.workItems?.length ? criticalPath.workItems.map((item) => item.title).join(' -> ') : 'No dependency chain defined yet.'}</p>
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-semibold text-slate-900">Project discussion</h2><p className="text-sm text-slate-500 mt-1">Use `@email` mentions to notify teammates.</p></div>
            <span className="text-xs text-slate-500">{conversations.length} threads</span>
          </div>
          {conversations.length === 0 ? (
            <form onSubmit={createConversation} className="mt-4 flex gap-2"><input value={conversationTitle} onChange={(event) => setConversationTitle(event.target.value)} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" /><button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Start thread</button></form>
          ) : (
            <>
              <div className="mt-4 max-h-56 overflow-y-auto space-y-2">{comments.map((comment) => <div key={comment._id} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-600">{comment.authorId?.name || 'User'} · {formatDate(comment.createdAt)}</p><p className="text-sm text-slate-800 mt-1">{comment.body}</p></div>)}{comments.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}</div>
              <form onSubmit={sendComment} className="mt-4 flex gap-2"><input value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Write an update or mention @person" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" /><button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Post</button></form>
            </>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">Decision register</h2><p className="text-sm text-slate-500 mt-1">Record decisions, options, and accountable owners.</p></div><span className="text-xs text-slate-500">{decisions.length} decisions</span></div>
          {canPlan && <form onSubmit={createDecision} className="mt-4 space-y-2"><input value={decisionForm.title} onChange={(event) => setDecisionForm({ ...decisionForm, title: event.target.value })} placeholder="Decision title" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /><textarea value={decisionForm.context} onChange={(event) => setDecisionForm({ ...decisionForm, context: event.target.value })} placeholder="Context and options" rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /><button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Propose decision</button></form>}
          <div className="mt-4 space-y-2">{decisions.map((decision) => <div key={decision._id} className="rounded-lg bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-900">{decision.title}</p><span className="text-xs capitalize text-slate-500">{decision.status}</span></div><p className="text-xs text-slate-600 mt-1">Proposed by {decision.proposedBy?.name || 'User'}{decision.context ? ` · ${decision.context}` : ''}</p>{canPlan && decision.status === 'proposed' && <div className="mt-2 flex gap-2"><button type="button" onClick={async () => { await projectService.updateDecision(decision._id, { status: 'approved' }); await loadWorkspace(); }} className="text-xs font-semibold text-emerald-700">Approve</button><button type="button" onClick={async () => { await projectService.updateDecision(decision._id, { status: 'rejected' }); await loadWorkspace(); }} className="text-xs font-semibold text-rose-700">Reject</button></div>}</div>)}{decisions.length === 0 && <p className="text-sm text-slate-500">No decisions recorded yet.</p>}</div>
        </section>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-900">Activity timeline</h2>
        <div className="mt-4 space-y-3">
          {[...(project.workflowHistory || []).map((event) => ({ ...event, source: 'Workflow' })), ...auditEvents.map((event) => ({ ...event, source: 'Audit' }))]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map((event, index) => (
              <div key={`${event._id || event.action}-${event.createdAt}-${index}`} className="flex gap-3 border-l-2 border-indigo-200 pl-4">
                <div>
                  <p className="text-sm font-medium text-slate-900">{event.action || 'Project activity'}</p>
                  <p className="text-xs text-slate-500 mt-1">{event.source} · {formatDate(event.createdAt)}{event.note ? ` · ${event.note}` : ''}</p>
                </div>
              </div>
            ))}
          {(project.workflowHistory || []).length === 0 && auditEvents.length === 0 && <p className="text-sm text-slate-500">No activity recorded yet.</p>}
        </div>
      </section>
    </div>
  );
};

export default ProjectWorkspace;
