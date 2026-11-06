const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Task = require('../models/Task');
const WorkItem = require('../models/WorkItem');

const main = async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vts');
  const tasks = await Task.find({ projectId: { $ne: null } }).lean();
  let created = 0;

  for (const task of tasks) {
    const existing = await WorkItem.findOne({ legacyTaskId: task._id }).select('_id');
    if (existing) continue;

    await WorkItem.create({
      legacyTaskId: task._id,
      projectId: task.projectId,
      type: 'task',
      title: task.title,
      description: task.description,
      status: task.status === 'todo' ? 'ready' : task.status === 'in-progress' ? 'in-progress' : task.status === 'done' ? 'done' : 'backlog',
      priority: task.priority,
      assignedTo: task.assignedTo,
      estimateHours: task.estimatedHours,
      actualHours: task.actualHours,
      deadline: task.deadline,
      createdBy: task.createdBy
    });
    created += 1;
  }

  console.log(`Migrated ${created} project tasks into work items.`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
