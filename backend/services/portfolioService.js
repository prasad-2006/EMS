const Project = require('../models/Project');
const Task = require('../models/Task');
const Risk = require('../models/Risk');
const Issue = require('../models/Issue');

const getPortfolioSummary = async () => {
  const [projects, taskStats, openRisks, openIssues] = await Promise.all([
    Project.find({ isDeleted: { $ne: true } }).select('name status workflowStatus startDate endDate assignedManager assignedDepartment'),
    Task.aggregate([
      { $match: { projectId: { $ne: null } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Risk.countDocuments({ status: { $in: ['open', 'accepted'] } }),
    Issue.countDocuments({ status: { $in: ['open', 'in-progress', 'blocked'] } })
  ]);

  const now = new Date();
  const atRiskProjects = projects.filter((project) => project.endDate && new Date(project.endDate) < now && !['completed', 'cancelled'].includes(project.status));
  return {
    totals: {
      projects: projects.length,
      active: projects.filter((project) => project.status === 'active').length,
      atRisk: atRiskProjects.length,
      openRisks,
      openIssues
    },
    taskStats,
    projects,
    atRiskProjects
  };
};

module.exports = { getPortfolioSummary };
