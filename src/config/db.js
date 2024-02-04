import mongoose from 'mongoose';
// mongoose.set('strictQuery', false);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/main_database';

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const mainDatabase = mongoose.connection;

mainDatabase.on('error', console.error.bind(console, 'Connection to the Main Database failed:'));

mainDatabase.once('open', () => {
  console.log('Connected to the Main Database');
});


export default mongoose;