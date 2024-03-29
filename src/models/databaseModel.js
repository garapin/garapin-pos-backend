import mongoose from 'mongoose';

const databaseScheme = new mongoose.Schema({
  db_name: {
    type: String,
    required: false, 
  }
}, { timestamps: true, autoIndex: false }, { _id: true });

const DatabaseModel = mongoose.model('Database', databaseScheme);

export { DatabaseModel, databaseScheme };