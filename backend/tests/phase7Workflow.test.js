describe('Phase 7 migration and rollout safeguards', () => {
  test('project rollout is feature-flagged and disabled by default', () => {
    const { isEnabled, getEnabledFeatures } = require('../config/featureFlags');

    expect(isEnabled('pilot_project_rollout')).toBe(false);
    expect(getEnabledFeatures()).toEqual(expect.arrayContaining(['leave_capacity_integration']));
  });

  test('legacy project data migrates to canonical fields without losing status history', async () => {
    const { migrateLegacyProjectData } = require('../scripts/legacyProjectMigration');

    const legacyProject = {
      name: 'Legacy Project',
      status: 'active',
      workflowStatus: 'ceo_review',
      department: 'Engineering',
      assignedDepartment: 'Engineering',
      assignedManager: 'manager-123',
      history: [{ action: 'approved', at: '2026-01-01' }]
    };

    const migrated = await migrateLegacyProjectData(legacyProject);

    expect(migrated.departmentId).toEqual('Engineering');
    expect(migrated.assignedManager).toEqual('manager-123');
    expect(migrated.workflowHistory).toHaveLength(1);
    expect(migrated.workflowStatus).toBe('ceo_review');
  });

  test('workflow validation blocks invalid transitions and allows compliant ones', () => {
    const { isWorkflowTransitionAllowed } = require('../services/workflowValidation');

    expect(isWorkflowTransitionAllowed('in_execution', 'manager_review', 'manager')).toBe(true);
    expect(isWorkflowTransitionAllowed('in_execution', 'ceo_review', 'manager')).toBe(false);
    expect(isWorkflowTransitionAllowed('manager_review', 'changes_requested', 'manager')).toBe(true);
  });
});
