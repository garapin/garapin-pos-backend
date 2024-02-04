import mongoose from '../config/db.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { UserModel, userSchema } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';

const registerStore = async (req, res) => {
  try {
    const { store_name, address, username, password, email } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    //databasename uniq
      const uniqueId = uuidv4();
      const storeDatabaseName = `${store_name.replace(/\s+/g, '_')}_${uniqueId}`;
  
    const newUser = new UserModel({
      username,
      password: hashedPassword,
      email,
      store_database_name: storeDatabaseName, 
      role: "SUPER_ADMIN",
    });

    await newUser.save();

    // Buat koneksi untuk database toko dan simpan data di sana
    const storeDatabase = mongoose.createConnection(`mongodb://127.0.0.1:27017/${storeDatabaseName}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const StoreModelInStoreDatabase = storeDatabase.model('Store', storeSchema);

    const storeDataInStoreDatabase = new StoreModelInStoreDatabase({
      store_name: store_name,
      address: address
    });
   await storeDataInStoreDatabase.save();

  return apiResponse(res, 200,'Store registration successful', newUser);
  } catch (error) {
    console.error('Failed to register store:', error);
    return apiResponse(res, 400,'Failed to registration store');
  }
};



const getStoreInfo = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'error', 'Target database is not specified');
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const storeModel = await storeDatabase.model('Store', StoreModel.schema).findOne();

    closeConnection(storeDatabase);
    if (!storeModel) {
      return apiResponse(res, 404, 'error', 'No store information found');
    }
    return apiResponse(res, 200, 'success', storeModel);
  } catch (error) {
    console.error('Failed to get store information:', error);
    return apiResponse(res, 500, 'error', `Failed to get store information: ${error.message}`);
  }
};




export default { registerStore, getStoreInfo };
