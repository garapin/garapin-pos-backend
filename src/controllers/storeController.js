import mongoose from "../config/db.js";
import { StoreModel, storeSchema } from "../models/storeModel.js";
import { UserModel, userSchema } from "../models/userModel.js";
import { DatabaseModel, databaseScheme } from "../models/databaseModel.js";
import { ConfigCostModel, configCostSchema } from "../models/configCost.js";
import { TemplateModel, templateSchema } from "../models/templateModel.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { apiResponseList, apiResponse } from "../utils/apiResponseFormat.js";
import { connectTargetDatabase } from "../config/targetDatabase.js";
import saveBase64Image from "../utils/base64ToImage.js";
import mainDatabase from "../config/db.js";
import "dotenv/config";
import axios from "axios";
import validateRequiredParams from "../utils/validateRequiredParam.js";
import { MongoClient } from "mongodb";
import { config } from "dotenv";
import { hashPin, verifyPin } from "../utils/hashPin.js";
import { configSettingSchema } from "../models/configSetting.js";
import {
  configAppForPOSSchema,
  ConfigAppModel as MasterConfigAppModel,
} from "../models/configAppModel.js";
import { databaseMerchantSchema } from "../models/merchantModel.js";

const MONGODB_URI = process.env.MONGODB_URI;
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;

const registerStore = async (req, res) => {
  try {
    let { store_name, email, connection_string, role } = req.body;

    // Validasi email
    email = email.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiResponse(res, 400, "Invalid email format");
    }
    if (store_name.length > 20) {
      return apiResponse(
        res,
        400,
        "Store name should not exceed 30 characters"
      );
    }

    let user;
    const isRakuStore = req?.body?.isRakuStore;
    if (isRakuStore && isRakuStore === true) {
      //databasename uniq
      const uniqueId = uuidv4().slice(0, 12);
      const storeDatabaseName = `om_${store_name.replace(/\s+/g, "_")}_${uniqueId}`;

      const dbGarapin = await DatabaseModel({ db_name: storeDatabaseName });
      await dbGarapin.save();

      user = await UserModel.findOne({ email });

      const newDatabaseEntry = {
        type: "USER",
        merchant_role: null,
        isRakuStore,
        store_name: store_name,
        name: storeDatabaseName,
        connection_string,
        role,
      };

      user.store_database_name.push(newDatabaseEntry);

      await user.save();

      // Buat database baru
      const database = mongoose.createConnection(
        `${MONGODB_URI}/${storeDatabaseName}?authSource=admin`,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        }
      );
      const StoreModelInStoreDatabase = database.model("Store", storeSchema);

      const storeDataInStoreDatabase = new StoreModelInStoreDatabase({});
      storeDataInStoreDatabase.store_type = "SUPPLIER";
      await storeDataInStoreDatabase.save();
    } else {
      //databasename uniq
      const uniqueId = uuidv4().slice(0, 12);
      const storeDatabaseName = `${store_name.replace(/\s+/g, "_")}_${uniqueId}`;

      const dbGarapin = await DatabaseModel({ db_name: storeDatabaseName });

      const dataUser = await dbGarapin.save();

      user = await UserModel.findOne({ email });

      const newDatabaseEntry = {
        type: "USER",
        merchant_role: null,
        store_name: store_name,
        name: storeDatabaseName,
        connection_string,
        role,
      };

      user.store_database_name.push(newDatabaseEntry);

      await user.save();

      // Buat database baru
      const database = mongoose.createConnection(
        `${MONGODB_URI}/${storeDatabaseName}?authSource=admin`,
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        }
      );
      const StoreModelInStoreDatabase = database.model("Store", storeSchema);
      const masterConfigApp = await MasterConfigAppModel.find();

      if (masterConfigApp > 0) {
        const ConfigAppModel = database.model(
          "config_app",
          configAppForPOSSchema
        );

        await ConfigAppModel.create({
          payment_duration: masterConfigApp[0].payment_duration,
          minimum_rent_date: masterConfigApp[0].minimum_rent_date,
          rent_due_date: masterConfigApp[0].rent_due_date,
        });
      }

      const storeDataInStoreDatabase = new StoreModelInStoreDatabase({});
      await storeDataInStoreDatabase.save();

      const ConfigCost = database.model("config_cost", configCostSchema);
      const configCost = new ConfigCost({
        start: 0,
        end: 999999999999999,
        cost: 500,
      });
      configCost.save();
    }

    return apiResponse(res, 200, "Store registration successful", user);
  } catch (error) {
    console.error("Failed to register store:", error);
    return apiResponse(res, 400, "Failed to registration store");
  }
};

const registerCashier = async (req, res) => {
  try {
    const { email, connection_string } = req.body;
    const targetDatabase = req.get("target-database");

    const isValidEmail = (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    if (!isValidEmail(email)) {
      return apiResponse(res, 400, "Email tidak valid");
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
      return apiResponse(res, 200, "Berhasil menambahkan kasir", newUser);
    } else {
      const existingStore = user.store_database_name.find(
        (db) => db.name === targetDatabase
      );
      if (!existingStore) {
        user.store_database_name.push(newDatabaseEntry);
        await user.save();
        return apiResponse(res, 200, "Berhasil menambahkan kasir", user);
      } else {
        return apiResponse(res, 400, "Email sudah terdaftar", user);
      }
    }
  } catch (error) {
    console.error("Gagal menambahkan kasir:", error);
    return apiResponse(res, 400, "Gagal menambahkan kasir");
  }
};

const removeCashier = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Database tidak ditemukan");
    }

    const { id_user, id_database } = req.body;

    const user = await UserModel.findById(id_user);

    if (!user) {
      return apiResponse(res, 404, "Pengguna tidak ditemukan");
    }

    const cashierDelete = user.store_database_name.find(
      (db) => db._id.toString() === id_database
    );

    if (!cashierDelete) {
      return apiResponse(res, 404, "Kasir tidak ditemukan");
    }

    if (cashierDelete.role === "ADMIN") {
      return apiResponse(res, 400, "Admin tidak dapat dihapus");
    }

    user.store_database_name = user.store_database_name.filter(
      (db) => db._id.toString() !== id_database
    );

    await user.save();

    return apiResponse(
      res,
      200,
      `Berhasil menghapus kasir ${user.email}`,
      user
    );
  } catch (error) {
    console.error("Gagal menghapus kasir:", error);
    return apiResponse(res, 500, "Gagal menghapus kasir");
  }
};

const getStoreInfo = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "error", "Target database is not specified");
    }

    const database = await connectTargetDatabase(targetDatabase);

    const storeModel = await database
      .model("Store", StoreModel.schema)
      .findOne();

    if (!storeModel) {
      return apiResponse(res, 404, "error", "No store information found");
    }

    const users = await UserModel.find();

    const filteredAccounts = users.filter((user) => {
      return user.store_database_name.some(
        (store) => store.name === targetDatabase
      );
    });

    const userInstore = filteredAccounts.map((account) => ({
      ...account.toObject(),
      store_database_name: account.store_database_name.find(
        (store) => store.name === targetDatabase
      ),
    }));

    storeModel.bank_account.pin = null;
    const response = {
      store: storeModel,
      users: userInstore,
    };
    console.log(response);

    return apiResponse(res, 200, "success", response);
  } catch (error) {
    console.error("Failed to get store information:", error);
    return apiResponse(
      res,
      500,
      "error",
      `Failed to get store information: ${error.message}`
    );
  }
};

const requestBussinessPartner = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    if (!targetDatabase) {
      return apiResponse(res, 400, "error", "Target database is not specified");
    }
    const database = await connectTargetDatabase(targetDatabase);
    const StoreModel = database.model("Store", storeSchema);
    const requiredParam = [
      "company_name",
      "no_npwp",
      "no_nib",
      "image_npwp",
      "image_nib",
      "image_akta",
      "status",
    ];
    const isTrue = validateRequiredParams(res, requiredParam, req.body);
    if (isTrue !== true) {
      return apiResponse(res, 400, isTrue);
    }
    const existingStore = await StoreModel.findOne();
    if (!existingStore) {
      return apiResponse(
        res,
        404,
        "error",
        "Tidak ada data toko yang ditemukan"
      );
    }
    const {
      company_name,
      no_npwp,
      no_nib,
      image_npwp,
      image_nib,
      image_akta,
      status,
    } = req.body;

    const bussinessPartnerData = {
      company_name: company_name,
      no_npwp: no_npwp,
      no_nib: no_nib,
      image_npwp: image_npwp,
      image_nib: image_nib,
      image_akta: image_akta,
      status: status,
    };

    if (image_npwp !== "") {
      bussinessPartnerData.image_npwp = image_npwp;
      if (bussinessPartnerData.image_npwp.startsWith("data:")) {
        const targetDirectory = "store_images";
        bussinessPartnerData.image_npwp = saveBase64Image(
          bussinessPartnerData.image_npwp,
          targetDirectory,
          targetDatabase
        );
      }
    }
    if (image_nib !== "") {
      bussinessPartnerData.image_nib = image_nib;
      if (bussinessPartnerData.image_nib.startsWith("data:")) {
        const targetDirectory = "store_images";
        bussinessPartnerData.image_nib = saveBase64Image(
          bussinessPartnerData.image_nib,
          targetDirectory,
          targetDatabase
        );
      }
    }
    if (image_akta !== "") {
      bussinessPartnerData.image_akta = image_akta;
      if (bussinessPartnerData.image_akta.startsWith("data:")) {
        const targetDirectory = "store_images";
        bussinessPartnerData.image_akta = saveBase64Image(
          bussinessPartnerData.image_akta,
          targetDirectory,
          targetDatabase
        );
      }
    }

    const updateResult = await StoreModel.updateOne(
      {},
      { $set: { business_partner: bussinessPartnerData } }
    );

    if (updateResult.nModified === 0) {
      return apiResponse(
        res,
        404,
        "error",
        "Tidak ada data toko yang ditemukan atau tidak ada perubahan yang dilakukan"
      );
    }

    const updatedStoreModel = await StoreModel.findOne();

    return apiResponse(res, 200, "Sukses edit toko", updatedStoreModel);
  } catch (error) {
    console.error("Gagal mengupdate informasi toko:", error);
    return apiResponse(res, 500, "error", `Gagal update: ${error.message}`);
  }
};

const addBankAccount = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    if (!targetDatabase) {
      return apiResponse(res, 400, "error", "Target database is not specified");
    }
    const database = await connectTargetDatabase(targetDatabase);
    const StoreModel = database.model("Store", storeSchema);
    const requiredParam = ["bank_name", "holder_name", "account_number", "pin"];
    const isTrue = validateRequiredParams(res, requiredParam, req.body);
    if (isTrue !== true) {
      return apiResponse(res, 400, isTrue);
    }
    const existingStore = await StoreModel.findOne();
    if (!existingStore) {
      return apiResponse(
        res,
        404,
        "error",
        "Tidak ada data toko yang ditemukan"
      );
    }
    const { bank_name, holder_name, account_number, pin } = req.body;

    const hashedPin = hashPin(pin);
    const bankData = {
      bank_name: bank_name,
      holder_name: holder_name,
      account_number: account_number,
      pin: hashedPin,
    };

    const updateResult = await StoreModel.updateOne(
      {},
      { $set: { bank_account: bankData } }
    );

    if (updateResult.nModified === 0) {
      return apiResponse(
        res,
        404,
        "error",
        "Tidak ada data toko yang ditemukan atau tidak ada perubahan yang dilakukan"
      );
    }

    const updatedStoreModel = await StoreModel.findOne();

    return apiResponse(res, 200, "Menambahkan akun bank", updatedStoreModel);
  } catch (error) {
    console.error("Gagal mengupdate informasi toko:", error);
    return apiResponse(res, 500, "error", `Gagal update: ${error.message}`);
  }
};

const updateStore = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "error", "Target database is not specified");
    }

    const database = await connectTargetDatabase(targetDatabase);
    const StoreModel = database.model("Store", storeSchema);

    const requiredParam = [
      "store_name",
      "pic_name",
      "phone_number",
      "address",
      "city",
      "country",
      "state",
      "postal_code",
    ];
    const missingParam = requiredParam.filter((prop) => !req.body[prop]);

    if (missingParam.length > 0) {
      const formattedMissingParam = missingParam.map((param) =>
        param.replace(/_/g, " ")
      );
      const missingParamString = formattedMissingParam.join(", ");
      return apiResponse(res, 400, `${missingParamString} tidak boleh kosong`);
    }

    const existingStore = await StoreModel.findOne();

    if (!existingStore) {
      return apiResponse(
        res,
        404,
        "error",
        "Tidak ada data toko yang ditemukan"
      );
    }

    const updatedData = {
      store_name:
        existingStore.store_name !== null
          ? existingStore.store_name
          : req.body.store_name,
      pic_name: req.body.pic_name,
      phone_number: req.body.phone_number,
      address: req.body.address,
      city: req.body.city,
      country: req.body.country,
      state: req.body.state,
      postal_code: req.body.postal_code,
    };

    //create account holder
    if (existingStore.account_holder.id === null) {
      const accounHolder = await createAccountHolder(req);
      updatedData.account_holder = accounHolder;
    }

    if (req.body.store_image !== "") {
      updatedData.store_image = req.body.store_image;

      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (updatedData.store_image.startsWith("data:image")) {
        const targetDirectory = "store_images";
        updatedData.store_image = saveBase64Image(
          updatedData.store_image,
          targetDirectory,
          targetDatabase
        );
      }
    }

    const updateResult = await StoreModel.updateOne({}, { $set: updatedData });

    if (updateResult.nModified === 0) {
      return apiResponse(
        res,
        404,
        "error",
        "Tidak ada data toko yang ditemukan atau tidak ada perubahan yang dilakukan"
      );
    }

    const updatedStoreModel = await StoreModel.findOne();

    return apiResponse(res, 200, "Sukses edit toko", updatedStoreModel);
  } catch (error) {
    console.error("Gagal mengupdate informasi toko:", error);
    return apiResponse(res, 500, "error", `Gagal update: ${error.message}`);
  }
};

//not use
const createDatabase = async (req, res) => {
  try {
    const { email, store_name, connection_string, role } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      return apiResponse(res, 404, "User not found");
    }

    const newDatabaseEntry = {
      name: store_name,
      connection_string,
      role,
    };

    user.store_database_name.push(newDatabaseEntry);

    await user.save();

    return apiResponse(res, 200, "Database added successfully", user);
  } catch (error) {
    console.error("Error:", error);
    return apiResponse(res, 500, "Internal Server Error");
  }
};

const createAccountHolder = async (req) => {
  const apiKey = XENDIT_API_KEY; // Ganti dengan API key Xendit Anda di env

  const { account_holder } = req.body;

  const endpoint = "https://api.xendit.co/v2/accounts";

  const headers = {
    Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
  };

  try {
    const response = await axios.post(endpoint, account_holder, { headers });
    return response.data;
  } catch (error) {
    // Tangani error jika ada
    console.error("Error:", req.body);
    throw new Error("Failed to update account holder");
  }
};

let client;
let timeoutId;

// Inisialisasi dan gunakan kembali MongoClient dengan timeout
const initializeClient = async () => {
  if (!client) {
    client = new MongoClient(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      authSource: "admin",
      minPoolSize: 5,
      maxPoolSize: 50,
    });
    await client.connect();
    console.log("Buat Koneksi Baru!");
  } else {
    console.log("Re-use current connection!");
    clearTimeout(timeoutId);
  }

  // Setel timeout untuk menutup koneksi setelah 1 menit idle
  timeoutId = setTimeout(async () => {
    if (client) {
      await client.close();
      client = null;
      console.log("Connection Closed!");
    }
  }, 60000);
};

const getAllStoreInDatabase = async (req, res) => {
  try {
    await initializeClient();

    const adminDB = client.db("admin");
    const databases = await adminDB.admin().listDatabases();

    const result = [];

    // Loop melalui setiap database
    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;
      const db = client.db(dbName);

      const collections = await db.listCollections().toArray();
      const storesCollection = collections.find(
        (collection) => collection.name === "stores"
      );

      if (storesCollection) {
        const storesData = await db
          .collection("stores")
          .find()
          .limit(1)
          .toArray();

        // Simpan nama database dan data dari koleksi "stores" dalam result
        result.push({
          dbName: dbName,
          storesData: storesData.length > 0 ? storesData[0] : null,
        });
      }
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

const getStoresByParentId = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "database tidak ditemukan");
    }

    const databases = await connectTargetDatabase(targetDatabase);
    const DatabaseMerchant = databases.model('Database_Merchant', databaseMerchantSchema);
    const listDatabaseMerchant = await DatabaseMerchant.find();

    const result = await Promise.all(listDatabaseMerchant.map(async (dbInfo) => {
      const dbName = dbInfo.name;
      const emailOwner = dbInfo.email_owner;
      const database = await connectTargetDatabase(dbName);
      const StoreModelDatabase = database.model("Store", storeSchema);
      const data = await StoreModelDatabase.findOne({
        id_parent: targetDatabase,
      });

      if (data) {
        return {
          dbName: dbName,
          email_owner: emailOwner ?? null,
          storesData: data,
        };
      }
    }));

    const filteredResult = result.filter(item => item !== undefined);

    return apiResponse(res, 200, "success", filteredResult);
  } catch (err) {
    console.error(err);
    return apiResponse(res, 400, "error");
  }
};

const getTrxNotRegisteredInTemplateByIdParent = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "database tidak ditemukan");
    }
    const dbTemplate = await connectTargetDatabase(targetDatabase);
    const Template = dbTemplate.model("Template", templateSchema);
    const template = await Template.find();

    const databases = await DatabaseModel.find();
    const result = [];

    for (const dbInfo of databases) {
      const dbName = dbInfo.db_name;
      const database = await connectTargetDatabase(dbName);
      const StoreModelDatabase = database.model("Store", storeSchema);
      const data = await StoreModelDatabase.findOne({
        id_parent: targetDatabase,
      });
      if (data != null) {
        const foundTemplate = template.find(
          (temp) => temp.db_trx && temp.db_trx.includes(dbName)
        );
        if (!foundTemplate) {
          result.push({
            dbName: dbName,
            storesData: data,
          });
        }
      }
    }
    return apiResponse(res, 200, "success", result);
  } catch (err) {
    console.error(err);
    return apiResponse(res, 400, "error");
  }
};
const updatePrivacyPolice = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 400, "database tidak ditemukan");
  }
  const database = await connectTargetDatabase(targetDatabase);
  const StoreModelDatabase = database.model("Store", storeSchema);
  const data = await StoreModelDatabase.findOneAndUpdate(
    {}, // Kriteria pencarian, kosongkan untuk memperbarui dokumen pertama yang ditemukan
    { $set: { policy: true } }, // Update yang akan dilakukan
    { new: true } // Opsi untuk mengembalikan dokumen yang diperbarui
  );
  console.log(data);
  return apiResponse(res, 200, "ok");
};

const getStoreProfile = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 401, "database raku is required!");
  }

  try {
    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const storeModelStore = storeDatabase.model("store", storeSchema);

    const result = await storeModelStore.findOne();

    if (!result) {
      return apiResponse(res, 401, "database raku tidak di temukan!");
    }

    return apiResponse(res, 200, "success", result);
  } catch (error) {
    return apiResponse(res, 400, "error" + error);
  }
};

export default {
  registerStore,
  getStoreInfo,
  createDatabase,
  updateStore,
  registerCashier,
  removeCashier,
  addBankAccount,
  requestBussinessPartner,
  getAllStoreInDatabase,
  getStoresByParentId,
  getTrxNotRegisteredInTemplateByIdParent,
  updatePrivacyPolice,
  getStoreProfile,
};
