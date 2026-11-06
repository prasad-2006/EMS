const allowedTransitions = {
  in_execution: ['manager_review', 'changes_requested'],
  manager_review: ['hr_review', 'changes_requested', 'ceo_review'],
  hr_review: ['ceo_review', 'changes_requested'],
  ceo_review: ['approved', 'rejected'],
  changes_requested: ['in_execution', 'manager_review']
};

const isWorkflowTransitionAllowed = (fromStatus, toStatus, actorRole) => {
  const allowed = allowedTransitions[fromStatus] || [];
  if (actorRole === 'manager' && ['ceo_review', 'approved', 'rejected'].includes(toStatus)) return false;
  return allowed.includes(toStatus);
};

module.exports = { isWorkflowTransitionAllowed };
