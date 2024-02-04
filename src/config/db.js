import mongoose from 'mongoose';
import 'dotenv/config';

mongoose.set('strictQuery', false);
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const mainDatabase = mongoose.connection;

mainDatabase.on('error', console.error.bind(console, 'Connection to the Main Database failed:'));

mainDatabase.once('open', () => {
  console.log('Connected to the Main Database');
});


export default mongoose;