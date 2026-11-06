const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const main = async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI or MONGODB_URI is required');

  await mongoose.connect(uri);
  const users = mongoose.connection.db.collection('users');
  const cursor = users.find({ department: { $exists: true, $ne: null } });
  let migrated = 0;

  for await (const user of cursor) {
    const currentDepartments = Array.isArray(user.departments) ? user.departments : [];
    const departmentIds = [...new Map(
      [user.department, ...currentDepartments]
        .filter(Boolean)
        .map((departmentId) => [departmentId.toString(), departmentId])
    ).values()];

    if (departmentIds.length !== currentDepartments.length) {
      await users.updateOne({ _id: user._id }, { $set: { departments: departmentIds } });
      migrated += 1;
    }
  }

  console.log(JSON.stringify({ database: mongoose.connection.db.databaseName, migrated }, null, 2));
  await mongoose.disconnect();
};

main().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect();
  process.exit(1);
});