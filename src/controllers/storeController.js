import mongoose from '../config/db.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { UserModel, userSchema } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; 
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';
import saveBase64Image from '../utils/base64ToImage.js';
import mainDatabase from '../config/db.js';
import 'dotenv/config';
import axios from 'axios';

const MONGODB_URI = process.env.MONGODB_URI;
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;

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

    // Buat database baru
    const database = mongoose.createConnection(`${MONGODB_URI}/${storeDatabaseName}?authSource=admin`, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    const StoreModelInStoreDatabase = database.model('Store', storeSchema);

    const storeDataInStoreDatabase = new StoreModelInStoreDatabase({
    });
   await storeDataInStoreDatabase.save();

  return apiResponse(res, 200,'Store registration successful', user);
  } catch (error) {
    console.error('Failed to register store:', error);
    return apiResponse(res, 400,'Failed to registration store');
  }
};

const registerCashier = async (req, res) => {
  try {
  const {email, connection_string } = req.body;
  const targetDatabase = req.get('target-database');

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  
  if (!isValidEmail(email)) {
    return apiResponse(res, 400, 'Email tidak valid');
  }
  
  const user = await UserModel.findOne({ email });

  const newDatabaseEntry = {
    name: targetDatabase,
    connection_string,
    role: "CASHIER",
  };

  if (!user) {
    const newUser = new UserModel({ email });
    newUser.store_database_name.push(newDatabaseEntry);
    await newUser.save();
    return apiResponse(res, 200, 'Berhasil menambahkan kasir', newUser);
  } else {
    const existingStore = user.store_database_name.find(db => db.name === targetDatabase);
    if (!existingStore) {
      user.store_database_name.push(newDatabaseEntry);
      await user.save();
      return apiResponse(res, 200, 'Berhasil menambahkan kasir', user);
    } else {
      return apiResponse(res, 400, 'Email sudah terdaftar', user);
    }
  }
    } catch (error) {
  console.error('Gagal menambahkan kasir:', error);
  return apiResponse(res, 400,"Gagal menambahkan kasir");
}
}

const removeCashier = async (req, res) => {
  try {
    const targetDatabase = req.get('target-database');

    if (!targetDatabase) {
      return apiResponse(res, 400, 'Database tidak ditemukan');
    }

    const { id_user, id_database } = req.body; 

    const user = await UserModel.findById(id_user);

    if (!user) {
      return apiResponse(res, 404, 'Pengguna tidak ditemukan');
    }

    const cashierDelete = user.store_database_name.find(db => db._id.toString() === id_database);

    if (!cashierDelete) {
      return apiResponse(res, 404, 'Kasir tidak ditemukan');
    }

    if (cashierDelete.role === "ADMIN") {
      return apiResponse(res, 400, 'Admin tidak dapat dihapus');
    }

    user.store_database_name = user.store_database_name.filter(db => db._id.toString() !== id_database);

    await user.save();

    return apiResponse(res, 200, `Berhasil menghapus kasir ${user.email}`, user);
  } catch (error) {
    console.error('Gagal menghapus kasir:', error);
    return apiResponse(res, 500, 'Gagal menghapus kasir');
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

    const users = await UserModel.find();

   const filteredAccounts = users.filter(user => {
    return user.store_database_name.some(store => store.name === targetDatabase);
  });
  
  const userInstore = filteredAccounts.map(account => ({
    ...account.toObject(),
    store_database_name: account.store_database_name.find(store => store.name === targetDatabase)
  }))
  
    const response = {
      store: storeModel,
      users: userInstore
    };

    return apiResponse(res, 200, 'success', response);
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

    const requiredParam = ['store_name', 'pic_name', 'phone_number', 'address', 'city', 'country', 'state', 'postal_code'];
    const missingParam = requiredParam.filter(prop => !req.body[prop]);

    if (missingParam.length > 0) {
      const formattedMissingParam = missingParam.map(param => param.replace(/_/g, ' '));
      const missingParamString = formattedMissingParam.join(', ');
      return apiResponse(res, 400, `${missingParamString} tidak boleh kosong`);
    }

    const existingStore = await StoreModel.findOne();
   

    if (!existingStore) {
      return apiResponse(res, 404, 'error', 'Tidak ada data toko yang ditemukan');
    }

    const updatedData = {
      store_name:(existingStore.store_name !== null)?existingStore.store_name :req.body.store_name,
      pic_name: req.body.pic_name,
      phone_number: req.body.phone_number,
      address: req.body.address,
      city: req.body.city,
      country: req.body.country,
      state: req.body.state,
      postal_code: req.body.postal_code,
    };
// if(updatedData.store_name !== req.body.account_holder.public_profile.business_name){
//   return apiResponse(res, 400, 'nama store dan business name tidak sama');
// }
    //create account holder
    if(existingStore.account_holder.id === null){
      const accounHolder = await  createAccountHolder(req);
      updatedData.account_holder = accounHolder;
    }
    
    if (req.body.store_image !== "") {
      updatedData.store_image = req.body.store_image;

      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (updatedData.store_image.startsWith('data:image')) {
        const targetDirectory = 'store_images';
        updatedData.store_image = saveBase64Image(updatedData.store_image, targetDirectory,targetDatabase);
      }
    }

    const updateResult = await StoreModel.updateOne({}, { $set: updatedData });

    if (updateResult.nModified === 0) {
      return apiResponse(res, 404, 'error', 'Tidak ada data toko yang ditemukan atau tidak ada perubahan yang dilakukan');
    }

    const updatedStoreModel = await StoreModel.findOne();

    return apiResponse(res, 200, 'Sukses edit toko', updatedStoreModel);
  } catch (error) {
    console.error('Gagal mengupdate informasi toko:', error);
    return apiResponse(res, 500, 'error', `Gagal update: ${error.message}`);
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

const createAccountHolder = async (req) => {
  const apiKey = XENDIT_API_KEY; // Ganti dengan API key Xendit Anda di env

  const { account_holder } = req.body;

  const endpoint = 'https://api.xendit.co/v2/accounts';

  const headers = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
  };

  try {
      const response = await axios.post(endpoint, account_holder, { headers });
      return response.data;
  } catch (error) {
      // Tangani error jika ada
      console.error('Error:', req.body);
      throw new Error('Failed to update account holder');
  }
}




export default { registerStore, getStoreInfo, createDatabase, updateStore, registerCashier, removeCashier };
