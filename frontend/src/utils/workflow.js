export const WORKFLOW_STAGES = [
  { key: 'draft', label: 'Draft' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'validation', label: 'Validation' },
  { key: 'manager_review', label: 'Manager Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'impact_analysis', label: 'Impact Analysis' },
  { key: 'handover_pending', label: 'Handover Pending' },
  { key: 'handover_completed', label: 'Handover Completed' },
  { key: 'backup_assigned', label: 'Backup Assigned' },
  { key: 'tasks_reassigned', label: 'Tasks Reassigned' },
  { key: 'leave_active', label: 'Leave Active' },
  { key: 'employee_returned', label: 'Employee Returned' },
  { key: 'tasks_restored', label: 'Tasks Restored' },
  { key: 'closed', label: 'Closed' }
];

export const deriveWorkflowStage = (leave) => {
  if (!leave) return 'draft';

  if (leave.workflowStage) return leave.workflowStage;

  if (leave.status === 'cancelled' || leave.status === 'rejected' || leave.status === 'withdrawn') {
    return 'closed';
  }

  if (leave.status === 'approved') {
    const now = new Date();
    const startDate = leave.startDate ? new Date(leave.startDate) : null;
    const endDate = leave.endDate ? new Date(leave.endDate) : null;

    if (leave.taskConflictSummary?.urgentCount > 0 || leave.handoverTo?.userId) {
      return 'handover_pending';
    }

    if (startDate && endDate && now >= startDate && now <= endDate) {
      return 'leave_active';
    }

    if (endDate && now > endDate) {
      return leave.actualReturnDate ? 'employee_returned' : 'tasks_restored';
    }

    return 'approved';
  }

  return 'manager_review';
};

export const buildWorkflowTimeline = (leave) => {
  const currentStage = deriveWorkflowStage(leave);
  const currentIndex = WORKFLOW_STAGES.findIndex((stage) => stage.key === currentStage);

  return WORKFLOW_STAGES.map((stage, index) => ({
    ...stage,
    state: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming'
  }));
};
