import mongoose from 'mongoose';
import 'dotenv/config';


const MONGODB_URI = process.env.MONGODB_URI;

const connectTargetDatabase = async (databaseName) => {
  try {

    const connection = mongoose.createConnection(`${MONGODB_URI}/${databaseName}?authSource=admin`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    connection.on('error', console.error.bind(console, 'Connection to the Database failed:'));

    connection.once('open', () => {
      console.log(`Connected to the Database: ${databaseName}`);
    });

    await new Promise((resolve) => connection.once('open', resolve));

    return connection;
  } catch (error) {
    console.error(`Failed to connect to the Database: ${databaseName}`, error);
    throw error;
  }
};

const closeConnection = (connection) => {
  connection.close();
  console.log(`Connection to the Database closed`);
};

export { connectTargetDatabase, closeConnection };
