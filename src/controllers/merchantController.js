import mongoose from '../config/db.js';
import { StoreModel, storeSchema } from '../models/storeModel.js';
import { UserModel, userSchema } from '../models/userModel.js';
import { DatabaseModel, databaseScheme } from '../models/databaseModel.js';
import { DatabaseMerchantModel, databaseMerchantSchema } from '../models/merchantModel.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid'; 
import { apiResponseList, apiResponse } from '../utils/apiResponseFormat.js';
import { connectTargetDatabase, closeConnection } from '../config/targetDatabase.js';
import saveBase64Image from '../utils/base64ToImage.js';
import mainDatabase from '../config/db.js';
import { ConfigCostModel, configCostSchema } from '../models/configCost.js';
import 'dotenv/config';
import axios from 'axios';
import validateRequiredParams from '../utils/validateRequiredParam.js';

const MONGODB_URI = process.env.MONGODB_URI;
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;


const createMerchant = async (req, res) => {
    try {
    const targetDatabase = req.get('target-database');
    let { store_name, email, merchant_role } = req.body;


        email = email.toLowerCase();
         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
         if (!emailRegex.test(email)) {
           return apiResponse(res, 400, 'Invalid email format');
         }
         if (store_name.length > 20) {
          return apiResponse(res, 400, 'Nama database tidak boleh lebih dari 30 karakter');
        }

      const existDb = await DatabaseModel.findOne({ db_parent: targetDatabase, email_owner: email });
      if (existDb) {
       const db2 = await connectTargetDatabase(existDb.db_name);
        const StoreModel = db2.model('Store', storeSchema);
        const storeData = await StoreModel.findOne();
        console.log(existDb);
        return apiResponse(res, 400, `Email sudah terdaftar sebagai ${storeData.merchant_role}`);
      }
        const uniqueId = uuidv4().slice(0, 12);
        const storeDatabaseName = `mr-${store_name.replace(/\s+/g, '_')}_${uniqueId}`;
        const dbGarapin = await DatabaseModel({ db_name: storeDatabaseName, email_owner: email, db_parent:targetDatabase });
        const dataUser = await dbGarapin.save();
        
        const user = await UserModel.findOne({ email });
  
        
      const newDatabaseEntry = {
        type: 'MERCHANT',
        merchant_role: merchant_role,
        name: storeDatabaseName,
        connection_string: '',
        role: 'ADMIN',
        message: 'Anda mendapat undangan untuk menggunakan database ini',
        status: 'MENUNGGU_APPROVAL',
        email_owner: email.toLowerCase(),
      };
  

  if (!user) {
    const newUser = new UserModel({ email });
    newUser.store_database_name.push(newDatabaseEntry);
    await newUser.save();
  } else {
    const existingStore = user.store_database_name.find(db => db.name === targetDatabase);
    // if (!existingStore) {
      user.store_database_name.push(newDatabaseEntry);
      await user.save();
    // } else {
    //   return apiResponse(res, 400, 'Email sudah terdaftar', user);
    // }
  }
      // Buat database baru
      const database = mongoose.createConnection(`${MONGODB_URI}/${storeDatabaseName}?authSource=admin`, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        
      });
      const StoreModelInStoreDatabase = database.model('Store', storeSchema);
      const storeDataInStoreDatabase = new StoreModelInStoreDatabase({
        store_status: 'PENDING',
        store_type: 'MERCHANT',
        merchant_role: merchant_role,
        id_parent: targetDatabase
      });
     await storeDataInStoreDatabase.save();

    //  store to database merchant
     const merchantDatabase = await connectTargetDatabase(targetDatabase);
     const DatabaseMerchant = merchantDatabase.model('Database_Merchant', databaseMerchantSchema);
     const merchantCreate = new DatabaseMerchant(newDatabaseEntry);
     await merchantCreate.save();

     const ConfigCost = database.model('config_cost', configCostSchema);
     const configCost = new ConfigCost(
      { start: 0, end: 999999999999999, cost: 500 }
    );
     await configCost.save();


    return apiResponse(res, 200, 'Store registration successful', user);
    } catch (error) {
      console.error('Failed to register store:', error);
      return apiResponse(res, 400, 'Failed to registration store');
    }
  };

  const approvalRequestMerchant = async (req, res) => {
    try {
    const { target_database, approve } = req.body;
  
     const db = await connectTargetDatabase(target_database);
     const StoreModelInStoreDatabase = db.model('Store', storeSchema);
     const storeData = await StoreModelInStoreDatabase.findOne();
     if (approve === 'Y') {
      const updateStore = await StoreModelInStoreDatabase.updateOne({}, { $set:  {
        store_type: 'BUSSINESS_PARTNER',
        business_partner: { 
          ...storeData.business_partner, // Salin semua data dari business_partner yang sudah ada
          status: 'ACTIVE' // Perbarui hanya status
        }
      }, });
      return apiResponse(res, 200, 'Request merchant diterima');
     } else if (approve === 'N') {
      const storeDataInStoreDatabase = new StoreModelInStoreDatabase({
        store_type: 'USER',
        business_partner: { status : 'DECLINE' }
        
      });
      await storeDataInStoreDatabase.save();
      return apiResponse(res, 200, 'Request merchant ditolak');
     } else {
      return apiResponse(res, 400, 'Data approve tidak valid, kirim Y/N');
     }
    } catch (error) {
      console.error('Failed to register store:', error);
      return apiResponse(res, 400, 'Failed to registration store');
    }
  };
  const acceptInvitationMerchant = async (req, res) => {
    try {
      const targetDatabase = req.get('target-database');
      const { status } = req.body;
      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
      const database = await connectTargetDatabase(targetDatabase);
      const StoreModel = database.model('Store', storeSchema);
      const updateResult = await StoreModel.updateOne({}, { $set: { store_status: status } });

      return apiResponse(res, 200, 'Store active');
    } catch (error) {
      // Menangani kesalahan yang mungkin terjadi
      console.error('Failed to get all merchant:', error);
      return apiResponse(res, 500, 'Failed to get all merchant');
    }
  };

  const getAllMerchant = async (req, res) => {
    try {
      const targetDatabase = req.get('target-database');
      
      if (!targetDatabase) {
        return apiResponseList(res, 400, 'Target database is not specified');
      }
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const MerchantModel = storeDatabase.model('Database_Merchant', databaseMerchantSchema);
      const allMerchant = await MerchantModel.find();

      return apiResponseList(res, 200, 'Success', allMerchant);
    } catch (error) {
      // Menangani kesalahan yang mungkin terjadi
      console.error('Failed to get all merchant:', error);
      return apiResponseList(res, 500, 'Failed to get all merchant');
    }
  };



  

  export default { createMerchant, approvalRequestMerchant, getAllMerchant, acceptInvitationMerchant };