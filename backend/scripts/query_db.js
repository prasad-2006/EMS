const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const query = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Department = require('../models/Department');
  const User = require('../models/User');
  const Project = require('../models/Project');
  const Task = require('../models/Task');

  const depts = await Department.find({});
  console.log('Departments:', depts.map(d => ({ id: d._id, name: d.name, code: d.code })));

  const users = await User.find({ role: 'employee' });
  console.log('Employees:', users.map(u => ({ id: u._id, name: u.name, department: u.department })));

  const projects = await Project.find({});
  console.log('Projects:', projects.map(p => ({ id: p._id, name: p.name })));

  await mongoose.connection.close();
  process.exit(0);
};

query();
