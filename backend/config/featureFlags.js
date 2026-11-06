const featureFlags = {
  leave_capacity_integration: true,
  pilot_project_rollout: false,
  workflow_validation_guardrails: true,
  project_migration_tooling: true
};

const isEnabled = (flag) => Boolean(featureFlags[flag]);
const getEnabledFeatures = () => Object.entries(featureFlags)
  .filter(([, enabled]) => enabled)
  .map(([flag]) => flag);

module.exports = { featureFlags, isEnabled, getEnabledFeatures };
