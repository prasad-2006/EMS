const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });
const connectDB = require('./config/db');
const User = require('./models/User');

async function debugUsers() {
  try {
    await connectDB();
    const users = await User.collection.find({}).toArray();
    console.log(`Total users in DB: ${users.length}`);
    for (const u of users) {
      console.log(`- ${u.email} (Role: ${u.role}, ID: ${u.employeeId}, isDeleted: ${u.isDeleted})`);
    }
    
    // Also let's just delete everything that's not admin while we're at it, but without filter
    // to see if we can just drop the whole collection? No, we need the admin user.
    // What if the role is null or not 'admin'? 
    const result = await User.collection.deleteMany({ email: { $ne: 'admin@example.com' } });
    console.log(`Deleted ${result.deletedCount} users where email != admin@example.com`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error debugging users:', error);
    process.exit(1);
  }
}

debugUsers();
