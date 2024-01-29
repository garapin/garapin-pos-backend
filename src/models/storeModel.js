
import mongoose from 'mongoose';

const storeSchema = new mongoose.Schema({
  name: String,
  address: String,
});

const StoreModel = mongoose.model('Store', storeSchema);

export { StoreModel, storeSchema };
