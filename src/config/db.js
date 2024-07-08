import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.set('strictQuery', false);
const MONGODB_URI = process.env.MONGODB_URI;

const connectToDatabase = async () => {
  try {
    mongoose.connect(`${MONGODB_URI}/garapin_pos?authSource=admin`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      minPoolSize: 5,
      maxPoolSize: 50
    });
    console.log(`Connected to the ${MONGODB_URI}/garapin_pos`);
  } catch (error) {
    console.error('Connection to the Main Database failed: ', error);
    setTimeout(connectToDatabase, 5000); // Retry connection after 5 seconds
  }
};

const mainDatabase = mongoose.connection;

mainDatabase.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mainDatabase.on('disconnected', () => {
  console.log('MongoDB disconnected. Attempting to reconnect...');
  setTimeout(connectToDatabase, 5000); // Retry connection after 5 seconds
});

await connectToDatabase();

export default mongoose;