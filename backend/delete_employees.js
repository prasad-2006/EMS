const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const connectDB = require('./config/db');
const User = require('./models/User');

async function deleteNonAdmins() {
  try {
    await connectDB();
    const result = await User.collection.deleteMany({ role: { $ne: 'admin' } });
    console.log(`Successfully deleted ${result.deletedCount} non-admin users (employees, managers, hr, etc.).`);
    process.exit(0);
  } catch (error) {
    console.error('Error deleting users:', error);
    process.exit(1);
  }
}

deleteNonAdmins();
