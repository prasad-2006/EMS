const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');

const calcCoverageBonus = (task) => {
  const estimatedHours = Number(task.estimatedHours) || 2;
  return Math.max(500, Math.round(estimatedHours * 250));
};

async function main() {
  const db = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/vts';
  await mongoose.connect(db, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to', db);

  // Cleanup previous test artifacts
  await Promise.all([
    User.deleteMany({ 'metadata.test': true }),
    Project.deleteMany({ 'metadata.test': true }),
    Task.deleteMany({ 'metadata.test': true }),
    LeaveRequest.deleteMany({ 'metadata.test': true })
  ]);

  // Create leaver and coverer
  const leaver = await User.create({ name: 'Test Leaver', email: 'leaver@test.local', role: 'employee', salary: { monthlyBase: 60000 }, metadata: { test: true } });
  const coverer = await User.create({ name: 'Test Coverer', email: 'coverer@test.local', role: 'employee', salary: { monthlyBase: 60000 }, metadata: { test: true } });

  // Create project and add members
  const project = await Project.create({ name: 'Test Project', code: 'TP1', members: [leaver._id, coverer._id], metadata: { test: true } });

  // Create a task assigned to leaver
  const task = await Task.create({
    title: 'Test Task for leave coverage',
    assignedTo: leaver._id,
    projectId: project._id,
    status: 'todo',
    estimatedHours: 4,
    metadata: { test: true }
  });

  // Create an approved leave for the leaver
  const start = new Date();
  const end = new Date();
  end.setDate(start.getDate() + 1);

  const leave = await LeaveRequest.create({
    userId: leaver._id,
    leaveType: 'casual',
    startDate: start,
    endDate: end,
    totalDays: 2,
    dayCalculation: { chargeableDays: 2 },
    status: 'approved',
    replacementArranged: false,
    metadata: { test: true }
  });

  // Simulate coverer accepting the task(s)
  task.coveredFor = task.assignedTo;
  task.assignedTo = coverer._id;
  task.isCoverageTask = true;
  task.coverageBonus = calcCoverageBonus(task);
  task.coverageLeaveId = leave._id;
  task.coverageAcceptedAt = new Date();
  task.handoverStatus = 'accepted';
  await task.save();

  // Compute distribution
  const coverageTasks = await Task.find({ coverageLeaveId: leave._id, isCoverageTask: true, coverageAcceptedAt: { $ne: null } });
  let weights = {};
  let totalWeight = 0;
  coverageTasks.forEach((t) => {
    const uid = String(t.assignedTo);
    const w = Number(t.coverageBonus) || 1;
    weights[uid] = weights[uid] || { weight: 0, taskIds: [] };
    weights[uid].weight += w;
    weights[uid].taskIds.push(t._id);
    totalWeight += w;
  });

  const monthlyBase = Number(leaver.salary?.monthlyBase) || 60000;
  const perDayRate = monthlyBase / 30;
  const deductionTotal = Math.round((Number(leave.totalDays) || 0) * perDayRate);

  const distribution = [];
  if (totalWeight > 0 && deductionTotal > 0) {
    let allocated = 0;
    for (const [uid, info] of Object.entries(weights)) {
      const share = Math.round(deductionTotal * (info.weight / totalWeight));
      distribution.push({ userId: uid, amount: share, taskIds: info.taskIds });
      allocated += share;
    }
    const diff = deductionTotal - allocated;
    if (diff !== 0 && distribution.length > 0) distribution[0].amount += diff;
  }

  leave.deductionTotal = deductionTotal;
  leave.deductionDistribution = distribution;
  leave.deductionDistributedAt = new Date();
  await leave.save();

  console.log('Leave saved with distribution:', JSON.stringify(leave.deductionDistribution, null, 2));

  // Compute coverer's extra pay (coverageBonus + distributed amount)
  const covererTasks = await Task.find({ assignedTo: coverer._id, isCoverageTask: true }).select('coverageBonus');
  const bonusSum = covererTasks.reduce((s, t) => s + (Number(t.coverageBonus) || 0), 0);
  const distEntry = (distribution.find((d) => String(d.userId) === String(coverer._id)) || {});
  const extraFromDeduction = Number(distEntry.amount) || 0;

  console.log(`Coverer (${coverer.name}) extra pay: coverageBonus=${bonusSum}, distributed=${extraFromDeduction}, totalExtra=${bonusSum + extraFromDeduction}`);

  // Show leaver deduction
  console.log(`Leaver (${leaver.name}) deductionTotal=${deductionTotal}`);

  await mongoose.disconnect();
  console.log('Verification script completed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
