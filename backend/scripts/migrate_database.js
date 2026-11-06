const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ORPHAN_COLLECTIONS = new Set([
  'courses',
  'certificates',
  'enrollments',
  'payments'
]);

const getDatabaseName = (connection) => connection.db.databaseName;

const getDestinationUri = (sourceUri, databaseName) => {
  const uri = new URL(sourceUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
};

const getSourceUri = (configuredUri, databaseName) => {
  if (!databaseName) return configuredUri;
  const uri = new URL(configuredUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
};

const getCollectionNames = async (db) => {
  const collections = await db.listCollections().toArray();
  return collections
    .map(({ name }) => name)
    .filter((name) => !ORPHAN_COLLECTIONS.has(name));
};

const copyCollection = async (sourceDb, destinationDb, name, apply) => {
  const source = sourceDb.collection(name);
  const destination = destinationDb.collection(name);
  const count = await source.countDocuments();
  const indexes = await source.indexes();

  if (!apply) {
    return { name, count, indexes: indexes.length - 1, copied: false };
  }

  if (count > 0) {
    const documents = await source.find({}).toArray();
    await destination.insertMany(documents, { ordered: true });
  }

  const indexesToCreate = indexes
    .filter((index) => index.name !== '_id_')
    .map(({ key, name: indexName, ...options }) => ({
      key,
      name: indexName,
      ...options
    }));

  if (indexesToCreate.length > 0) {
    await destination.createIndexes(indexesToCreate);
  }

  return { name, count, indexes: indexesToCreate.length, copied: true };
};

const main = async () => {
  const sourceUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const sourceDatabaseName = process.env.MONGO_SOURCE_DATABASE;
  const destinationName = process.env.MONGO_DATABASE || 'project_ems';
  const apply = process.argv.includes('--apply');

  if (!sourceUri) {
    throw new Error('MONGO_URI or MONGODB_URI is required');
  }

  const source = await mongoose.createConnection(getSourceUri(sourceUri, sourceDatabaseName)).asPromise();
  const destinationUri = getDestinationUri(sourceUri, destinationName);
  const destination = await mongoose.createConnection(destinationUri).asPromise();

  try {
    const sourceName = getDatabaseName(source);
    const sourceCollections = await getCollectionNames(source.db);
    const destinationCollections = await destination.db.listCollections().toArray();

    if (apply && destinationCollections.length > 0) {
      throw new Error(`Destination database ${destinationName} is not empty; refusing to merge data`);
    }

    const results = [];
    for (const name of sourceCollections) {
      results.push(await copyCollection(source.db, destination.db, name, apply));
    }

    console.log(JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      sourceDatabase: sourceName,
      destinationDatabase: destinationName,
      excludedCollections: [...ORPHAN_COLLECTIONS],
      collections: results
    }, null, 2));
  } finally {
    await source.close();
    await destination.close();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});