const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB connected');

  const User = require('./models/User');
  const Task = require('./models/Task');

  // 1. Set the monthly base salary for all current employees to Rs.60000.
  const salariedResult = await User.updateMany(
    { role: 'employee', 'salary.monthlyBase': { $ne: 60000 } },
    { $set: { salary: { monthlyBase: 60000, currency: 'INR' } } }
  );
  console.log(`Salary migration: ${salariedResult.modifiedCount} employee(s) set to Rs.60000/month`);

  // 2. Existing task handover fields default (no action needed, schema defaults apply).

  await mongoose.connection.close();
  console.log('Migration complete');
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});