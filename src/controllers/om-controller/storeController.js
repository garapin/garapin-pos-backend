import mongoose from "../../config/db.js";
import { StoreModel, storeSchema } from "../../models/storeModel.js";
import { UserModel, userSchema } from "../../models/userModel.js";
import { DatabaseModel, databaseScheme } from "../../models/databaseModel.js";
import { ConfigCostModel, configCostSchema } from "../../models/configCost.js";
import { TemplateModel, templateSchema } from "../../models/templateModel.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import {
  connectTargetDatabase,
  closeConnection,
} from "../../config/targetDatabase.js";
import saveBase64Image, {
  saveBase64ImageWithAsync,
} from "../../utils/base64ToImage.js";
import mainDatabase from "../../config/db.js";
import "dotenv/config";
import axios from "axios";
import validateRequiredParams from "../../utils/validateRequiredParam.js";
import { MongoClient } from "mongodb";
import { config } from "dotenv";
import { hashPin, verifyPin } from "../../utils/hashPin.js";
import { otpVerification } from "../../utils/otp.js";
import { showImage } from "../../utils/handleShowImage.js";
import { configSettingSchema } from "../../models/configSetting.js";

const MONGODB_URI = process.env.MONGODB_URI;
const XENDIT_API_KEY = process.env.XENDIT_API_KEY_DEV;

const registerStore = async (req, res) => {
  try {
    let { store_name, email, connection_string, role } = req.body;

    // Validasi email
    email = email.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendResponse(res, 400, "Invalid email format");
    }
    if (store_name.length > 20) {
      return sendResponse(
        res,
        400,
        "Store name should not exceed 30 characters"
      );
    }
    //databasename uniq
    const uniqueId = uuidv4().slice(0, 12);
    const storeDatabaseName = `om_${store_name.replace(/\s+/g, "_")}_${uniqueId}`;

    const dbGarapin = await DatabaseModel({ db_name: storeDatabaseName });
    const dataUser = await dbGarapin.save();

    const user = await UserModel.findOne({ email });

    const newDatabaseEntry = {
      type: "USER",
      merchant_role: null,
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
    const configSettingModel = database.model(
      "configSetting",
      configSettingSchema
    );

    const configSetting = await configSettingModel.create({
      payment_duration: 1200,
      minimum_rent_date: 1,
    });

    const storeDataInStoreDatabase = new StoreModelInStoreDatabase({});
    storeDataInStoreDatabase.store_type = "SUPPLIER";
    await storeDataInStoreDatabase.save();

    const ConfigCost = database.model("config_cost", configCostSchema);
    const configCost = new ConfigCost({
      start: 0,
      end: 999999999999999,
      cost: 500,
    });
    configCost.save();

    return sendResponse(res, 200, "Store registration successful", user);
  } catch (error) {
    console.error("Failed to register store:", error);
    return sendResponse(res, 400, "Failed to registration store", {
      error: error.message,
    });
  }
};

const updateStore = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(
        res,
        400,
        "error",
        "Target database is not specified"
      );
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
      "bank_name",
      "holder_name",
      "account_number",
      "id_card_image",
      "id_card_number",
    ];
    const missingParam = requiredParam.filter((prop) => !req.body[prop]);

    if (missingParam.length > 0) {
      const formattedMissingParam = missingParam.map((param) =>
        param.replace(/_/g, " ")
      );
      const missingParamString = formattedMissingParam.join(", ");
      return sendResponse(res, 400, `${missingParamString} tidak boleh kosong`);
    }

    const existingStore = await StoreModel.findOne();

    if (!existingStore) {
      return sendResponse(res, 404, "Tidak ada data toko yang ditemukan");
    }

    // // Find the most recent OTP for the email
    // const isVerification = await otpVerification(
    //   res,
    //   req.body.email,
    //   req.body.otp_code
    // );

    // if (!isVerification) {
    //   return sendResponse(res, 400, "error", "Otp is not valid");
    // }

    const updatedData = {
      store_name: req.body.store_name,
      pic_name: req.body.pic_name,
      phone_number: req.body.phone_number,
      address: req.body.address,
      city: req.body.city,
      country: req.body.country,
      state: req.body.state,
      postal_code: req.body.postal_code,
      bank_account: {
        bank_name: req.body.bank_name,
        holder_name: req.body.holder_name,
        account_number: req.body.account_number,
      },
      details: {
        id_card_image: existingStore?.details?.id_card_image,
        id_card_number: req.body?.id_card_number,
      },
    };

    //create account holder
    if (existingStore.account_holder.id === null) {
      const accounHolder = await createAccountHolder(req);
      updatedData.account_holder = accounHolder;
    }

    const store_image_new = req?.body?.store_image;

    if (store_image_new) {
      if (!store_image_new.startsWith("data:image")) {
        return sendResponse(
          res,
          400,
          "Store Image format must be start with data:image ",
          null
        );
      }

      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (store_image_new.startsWith("data:image")) {
        const targetDirectory = "store_images";
        updatedData.store_image = await saveBase64ImageWithAsync(
          store_image_new,
          targetDirectory,
          targetDatabase,
          existingStore?.store_image
            ? existingStore?.store_image.split("\\")[3]
            : null
        );
      }
    }

    const id_card_image_new = req.body.id_card_image;

    if (id_card_image_new) {
      if (!id_card_image_new.startsWith("data:image")) {
        return sendResponse(
          res,
          400,
          "Id Card Image format must be start with data:image ",
          null
        );
      }

      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (id_card_image_new.startsWith("data:image")) {
        const targetDirectory = "raku_id_card_image";
        updatedData.details.id_card_image = await saveBase64ImageWithAsync(
          id_card_image_new,
          targetDirectory,
          targetDatabase,
          existingStore?.details?.id_card_image !== ""
            ? existingStore?.details?.id_card_image.split("\\")[3]
            : null
        );
      }
    }

    const updateResult = await StoreModel.updateOne({}, { $set: updatedData });

    if (updateResult.nModified === 0) {
      return sendResponse(
        res,
        404,
        "Tidak ada data toko yang ditemukan atau tidak ada perubahan yang dilakukan"
      );
    }

    const updatedStoreModel = await StoreModel.findOne();

    updatedStoreModel.store_image = await showImage(
      req,
      updatedStoreModel.store_image
    );

    updatedStoreModel.details.id_card_image = await showImage(
      req,
      updatedStoreModel.details.id_card_image
    );

    return sendResponse(
      res,
      200,
      "Update profile supplier successfully",
      updatedStoreModel
    );
  } catch (error) {
    console.error("Gagal mengupdate informasi toko:", error);
    return sendResponse(res, 500, "error", {
      error: error.message,
    });
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
    console.error("Error:", error.response.data.errors);
    throw new Error("Failed to update account holder", {
      error: error.message,
    });
  }
};

const updateAccountHolder = async (req, res) => {
  const { account_holder_email } = req?.body;

  if (!req?.params?.account_holder_id) {
    return sendResponse(res, 402, "Param account_holder_id is required");
  }
  const account_holder_id = req?.params?.account_holder_id;
  const apiKey = XENDIT_API_KEY; // Ganti dengan API key Xendit Anda di env

  const endpoint = `https://api.xendit.co/v2/accounts/${account_holder_id}`;

  const headers = {
    Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
  };

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(
        res,
        400,
        "error",
        "Target database is not specified"
      );
    }

    const database = await connectTargetDatabase(targetDatabase);
    const StoreModel = database.model("Store", storeSchema);

    const existingStore = await StoreModel.findOne();

    if (!existingStore) {
      return sendResponse(res, 404, "Tidak ada data toko yang ditemukan");
    }

    const response = await axios.patch(
      endpoint,
      {
        email: account_holder_email,
      },
      { headers }
    );

    if (response.data) {
      existingStore.account_holder.email = response.data.email;
    }

    await existingStore.save();
    return sendResponse(
      res,
      200,
      "Update Account Holder Email successfully",
      existingStore
    );
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllStore = async (req, res) => {
  try {
    const allStore = await DatabaseModel.find({});

    if (!allStore) {
      return sendResponse(res, 400, `Store not found `, null);
    }

    const filterData = allStore.filter(
      (entry) => !entry.db_name.startsWith("om")
    );

    const allStoreFilter = [];
    for (const item of filterData) {
      const database = await connectTargetDatabase(item.db_name);
      const StoreModel = database.model("Store", storeSchema);
      const existingStore = await StoreModel.findOne();
      if (existingStore) {
        const objectDatabase = {
          db_name: item.db_name,
          store_name: existingStore.store_name,
          store_image: existingStore.store_image,
          country: existingStore.country,
          state: existingStore.state,
          city: existingStore.city,
          address: existingStore.address,
          postal_code: existingStore.postal_code,
          policy: existingStore.policy,
          store_type: existingStore.store_type,
          merchant_role: existingStore.merchant_role,
          id_parent: existingStore.id_parent,
        };

        allStoreFilter.push(objectDatabase);
      }
      database.close();
    }

    return sendResponse(res, 200, "Get all store successfully", allStoreFilter);
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    database.close();
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
  database.close();
};

export default {
  registerStore,
  updateStore,
  getAllStore,
  updateAccountHolder,
};
