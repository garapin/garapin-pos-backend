import mongoose from '../config/db.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { UserModel, userSchema } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; // Import uuid
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';

const registerStore = async (req, res) => {
  try {
    const { store_name, email, connection_string, role } = req.body;

    // const hashedPassword = await bcrypt.hash(password, 10);
    //databasename uniq
      const uniqueId = uuidv4();
      const storeDatabaseName = `${store_name.replace(/\s+/g, '_')}_${uniqueId}`;
  
      const user = await UserModel.findOne({ email });

    const newDatabaseEntry = {
      name: storeDatabaseName,
      connection_string,
      role,
    };

    user.store_database_name.push(newDatabaseEntry);


    await user.save();

    // Buat koneksi untuk database toko dan simpan data di sana
    const database = mongoose.createConnection(`mongodb://127.0.0.1:27017/${storeDatabaseName}`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const StoreModelInStoreDatabase = database.model('Store', storeSchema);

    const storeDataInStoreDatabase = new StoreModelInStoreDatabase({
      store_name: store_name,
    });
   await storeDataInStoreDatabase.save();

  return apiResponse(res, 200,'Store registration successful', user);
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
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model('Store', StoreModel.schema).findOne();

    if (!storeModel) {
      return apiResponse(res, 404, 'error', 'No store information found');
    }
    return apiResponse(res, 200, 'success', storeModel);
  } catch (error) {
    console.error('Failed to get store information:', error);
    return apiResponse(res, 500, 'error', `Failed to get store information: ${error.message}`);
  }
};


const updateStore = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'error', 'Target database is not specified');
    }

    const database = await connectTargetDatabase(targetDatabase);
    const StoreModel = database.model('Store', storeSchema);

    const updatedData = {
      pic_name: req.body.pic_name || null,
      phone_number: req.body.phone_number || null,
      address: req.body.address || null,
      city: req.body.city || null,
      country: req.body.country || null,
      postal_code: req.body.postal_code || null,
      store_image: req.body.store_image || null,
    };

    const updateResult = await StoreModel.updateOne({}, { $set: updatedData });

    if (updateResult.nModified === 0) {
      return apiResponse(res, 404, 'error', 'No store data found or no changes made');
    }

    const updatedStoreModel = await StoreModel.findOne();

    return apiResponse(res, 200, 'success', updatedStoreModel);
  } catch (error) {
    console.error('Failed to update store information:', error);
    return apiResponse(res, 500, 'error', `Failed to update store information: ${error.message}`);
  }
};



//not use
const createDatabase = async (req, res) => {
  try {
    const { email, store_name, connection_string, role } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      return apiResponse(res, 404, 'User not found');
    }


    const newDatabaseEntry = {
      name: store_name,
      connection_string,
      role,
    };

    user.store_database_name.push(newDatabaseEntry);

    await user.save();

    return apiResponse(res, 200, 'Database added successfully', user);
  } catch (error) {
    console.error('Error:', error);
    return apiResponse(res, 500, 'Internal Server Error');
  }
}




export default { registerStore, getStoreInfo, createDatabase, updateStore };
