const migrateLegacyProjectData = async (project) => {
  const migrated = {
    ...project,
    departmentId: project.departmentId || project.department || project.assignedDepartment || null,
    workflowHistory: Array.isArray(project.workflowHistory)
      ? project.workflowHistory
      : Array.isArray(project.history)
        ? project.history.map((entry) => ({ action: entry.action, note: entry.note || entry.reason || '', createdAt: entry.at || new Date() }))
        : [],
    workflowStatus: project.workflowStatus || project.status || 'draft',
    status: project.status || 'planned'
  };

  if (Array.isArray(project.history) && !Array.isArray(project.workflowHistory)) {
    migrated.workflowHistory = project.history.map((entry) => ({
      action: entry.action,
      note: entry.note || '',
      createdAt: entry.at || new Date()
    }));
  }

  return migrated;
};

module.exports = { migrateLegacyProjectData };
