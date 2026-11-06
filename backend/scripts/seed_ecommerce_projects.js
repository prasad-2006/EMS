const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const User = require('../models/User');
  const Department = require('../models/Department');
  const Project = require('../models/Project');
  const Task = require('../models/Task');

  // Find admin user
  const admin = await User.findOne({ role: 'admin' });

  // Clean up any projects I created previously
  const myProjects = ['Retail E-Commerce Platform', 'B2B Wholesale Portal', 'Payment Gateway Integration'];
  await Project.deleteMany({ name: { $in: myProjects } });
  
  // Clean up my departments
  const myDepts = ['Engineering', 'Marketing'];
  await Department.deleteMany({ name: { $in: myDepts } });
  
  // Clean up dummy users
  await User.deleteMany({ name: { $in: ['John Doe', 'Jane Smith'] } });

  console.log('Cleaned up previous seed data.');

  // Find existing departments
  const departments = await Department.find({ name: { $nin: myDepts } }).limit(2);
  
  if (departments.length === 0) {
      console.log('No existing departments found to use!');
      process.exit(1);
  }

  const dept1 = departments[0];
  const dept2 = departments.length > 1 ? departments[1] : departments[0];
  console.log(`Using existing departments: ${dept1.name}, ${dept2.name}`);

  // Find some existing employees from dept1 and dept2
  const employees1 = await User.find({ role: 'employee', department: dept1._id }).limit(3);
  const employees2 = await User.find({ role: 'employee', department: dept2._id }).limit(3);

  if (employees1.length === 0) {
      console.log('No existing employees found for dept 1');
      process.exit(1);
  }

  const employeeIds1 = employees1.map(e => e._id);
  const employeeIds2 = employees2.length > 0 ? employees2.map(e => e._id) : employeeIds1;

  // Create Project 1: Retail E-Commerce under dept1
  const project1 = await Project.create({
    name: 'Retail E-Commerce Platform',
    code: 'EC-RET-01',
    description: 'A modern B2C e-commerce platform with cart, checkout, and user profiles.',
    owner: admin ? admin._id : employees1[0]._id,
    members: employeeIds1,
    departmentId: dept1._id,
    status: 'active',
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 6))
  });
  console.log('Created Project: Retail E-Commerce Platform');

  // Create Frontend and Backend Tasks for Project 1
  await Task.create({
    title: 'Frontend - Develop Shopping Cart',
    description: 'Implement the UI for the shopping cart and checkout process.',
    project: project1._id,
    assignedTo: employeeIds1[0],
    createdBy: admin ? admin._id : employeeIds1[0],
    status: 'in-progress',
    priority: 'high',
    startDate: new Date(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
    departmentId: dept1._id
  });

  await Task.create({
    title: 'Backend - Payment Gateway API',
    description: 'Integrate Stripe API for processing payments securely.',
    project: project1._id,
    assignedTo: employeeIds1.length > 1 ? employeeIds1[1] : employeeIds1[0],
    createdBy: admin ? admin._id : employeeIds1[0],
    status: 'todo',
    priority: 'critical',
    startDate: new Date(),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 7)),
    departmentId: dept1._id
  });
  
  await Task.create({
    title: 'Frontend - Product Listing Page',
    description: 'Build out the main product listing with filters.',
    project: project1._id,
    assignedTo: employeeIds1.length > 2 ? employeeIds1[2] : employeeIds1[0],
    createdBy: admin ? admin._id : employeeIds1[0],
    status: 'done',
    priority: 'medium',
    startDate: new Date(new Date().setDate(new Date().getDate() - 10)),
    dueDate: new Date(),
    departmentId: dept1._id
  });

  // Create Project 2: B2B Wholesale Portal under dept2
  const project2 = await Project.create({
    name: 'B2B Wholesale Portal',
    code: 'EC-B2B-01',
    description: 'A wholesale platform for bulk ordering, invoicing, and inventory sync.',
    owner: admin ? admin._id : employees2[0]._id,
    members: employeeIds2,
    departmentId: dept2._id,
    status: 'planned',
    startDate: new Date(new Date().setDate(new Date().getDate() + 15)),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 8))
  });
  console.log('Created Project: B2B Wholesale Portal');

  // Create Tasks for Project 2
  await Task.create({
    title: 'Frontend - Bulk Order Table',
    description: 'Create an AG-Grid table for bulk adding items to order.',
    project: project2._id,
    assignedTo: employeeIds2[0],
    createdBy: admin ? admin._id : employeeIds2[0],
    status: 'todo',
    priority: 'high',
    startDate: new Date(new Date().setDate(new Date().getDate() + 15)),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
    departmentId: dept2._id
  });

  await Task.create({
    title: 'Backend - Inventory Sync Webhook',
    description: 'Listen for inventory changes from the warehouse system.',
    project: project2._id,
    assignedTo: employeeIds2.length > 1 ? employeeIds2[1] : employeeIds2[0],
    createdBy: admin ? admin._id : employeeIds2[0],
    status: 'todo',
    priority: 'high',
    startDate: new Date(new Date().setDate(new Date().getDate() + 15)),
    dueDate: new Date(new Date().setDate(new Date().getDate() + 20)),
    departmentId: dept2._id
  });

  await mongoose.connection.close();
  console.log('Seed complete with tasks');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
