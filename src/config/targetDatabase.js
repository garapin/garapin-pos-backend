import mongoose from 'mongoose';
import 'dotenv/config';

const MONGODB_URI = process.env.MONGODB_URI;
const connectionCache = {};
const connectionTimeouts = {};
const CONNECTION_TIMEOUT = 1 * 60 * 1000; // 1 minutes

// Function to connect to a target database
const connectTargetDatabase = async (databaseName) => {
  if (!databaseName) {
    throw new Error('Database name is required');
  }

  if (connectionCache[databaseName]) {
    console.log(`Reusing connection for the Database: ${databaseName}`);
    resetConnectionTimeout(databaseName);
    return connectionCache[databaseName];
  }

  try {
    const connection = await mongoose.createConnection(`${MONGODB_URI}/${databaseName}?authSource=admin`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      minPoolSize: 5,
      maxPoolSize: 50
    }).asPromise(); // Long-lived connection, pool size set

    console.log(`Connected to the Database: ${databaseName}`);

    connectionCache[databaseName] = connection;
    setConnectionTimeout(databaseName);

    return connection;
  } catch (error) {
    console.error(`Failed to connect to the Database: ${databaseName}`, error);
    throw error;
  }
};

const setConnectionTimeout = (databaseName) => {
  if (connectionTimeouts[databaseName]) {
    clearTimeout(connectionTimeouts[databaseName]);
  }

  connectionTimeouts[databaseName] = setTimeout(() => {
    closeConnection(databaseName);
  }, CONNECTION_TIMEOUT);
};

const resetConnectionTimeout = (databaseName) => {
  setConnectionTimeout(databaseName);
};

const closeConnection = (databaseName) => {
  const connection = connectionCache[databaseName];
  if (connection) {
    connection.close();
    delete connectionCache[databaseName];
    delete connectionTimeouts[databaseName];
    console.log(`Connection to the Database: ${databaseName} closed`);
  }
};

export { connectTargetDatabase };