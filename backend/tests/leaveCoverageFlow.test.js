const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');

const app = require('../server');
const User = require('../models/User');
const Task = require('../models/Task');
const LeaveRequest = require('../models/LeaveRequest');
const Notification = require('../models/Notification');
const DeductionLedger = require('../models/DeductionLedger');

jest.setTimeout(30000);
let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'testsecret';
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod && typeof mongod.stop === 'function') await mongod.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Task.deleteMany({}),
    LeaveRequest.deleteMany({}),
    Notification.deleteMany({}),
    DeductionLedger.deleteMany({})
  ]);
});

describe.skip('Leave coverage end-to-end', () => {
  test('accepting coverage reassigns tasks, computes distribution, creates ledger entries', async () => {
    // Create leaver and coverer
    const leaver = await User.create({ name: 'Leaver', email: 'leaver@example.com', password: 'p', role: 'employee', salary: { monthlyBase: 60000 } });
    const coverer = await User.create({ name: 'Coverer', email: 'coverer@example.com', password: 'p', role: 'employee' });

    // Create a task assigned to leaver
    const task = await Task.create({ title: 'Important task', assignedTo: leaver._id, status: 'open', estimatedHours: 4 });

    // Create an approved leave for leaver
    const leave = await LeaveRequest.create({ userId: leaver._id, leaveType: 'casual', startDate: new Date(), endDate: new Date(), totalDays: 1, status: 'approved' });

    // Create a notification to coverer about the task
    const notification = await Notification.create({
      userId: coverer._id,
      recipientGroup: 'custom',
      type: 'leave',
      category: 'warning',
      actionRequired: true,
      actionLabel: 'Accept & Complete Tasks',
      actionUrl: '/tasks',
      title: 'Cover tasks',
      message: 'Please cover tasks',
      metadata: { leaveId: leave._id.toString(), customData: { taskIds: [task._id.toString()], leaveId: leave._id.toString() } }
    });

    // Sign token for coverer
    const token = jwt.sign({ id: coverer._id }, process.env.JWT_SECRET);

    // Call respond endpoint to accept coverage
    const res = await request(app)
      .post('/api/leave/coverage/respond')
      .set('Authorization', `Bearer ${token}`)
      .send({ notificationId: notification._id, accept: true });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);

    // Reload task
    const updatedTask = await Task.findById(task._id);
    expect(String(updatedTask.assignedTo)).toBe(String(coverer._id));
    expect(updatedTask.isCoverageTask).toBe(true);
    expect(updatedTask.coverageAcceptedAt).toBeTruthy();

    // Check leave updated with distribution
    const updatedLeave = await LeaveRequest.findById(leave._id);
    expect(updatedLeave.deductionTotal).toBeDefined();
    expect(Array.isArray(updatedLeave.deductionDistribution)).toBe(true);

    // Check ledger entries created
    const entries = await DeductionLedger.find({ leaveId: leave._id });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].amount).toBeGreaterThanOrEqual(0);
  }, 20000);
});
