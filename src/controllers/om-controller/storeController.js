import mongoose from "../../config/db.js";
import { StoreModel, storeSchema } from "../../models/storeModel.js";
import { UserModel, userSchema } from "../../models/userModel.js";
import { DatabaseModel, databaseScheme } from "../../models/databaseModel.js";
import { TemplateModel, templateSchema } from "../../models/templateModel.js";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
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
import moment from "moment";

const MONGODB_URI = process.env.MONGODB_URI;
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;

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
    await dbGarapin.save();

    const user = await UserModel.findOne({ email });

    const newDatabaseEntry = {
      type: "USER",
      merchant_role: null,
      name: storeDatabaseName,
      connection_string,
      isRakuStore: false,
      role,
    };

    user.store_database_name.push(newDatabaseEntry);

    await user.save();

    // Buat database baru
    const database = await connectTargetDatabase(storeDatabaseName);
    const StoreModelInStoreDatabase = database.model("Store", storeSchema);

    const storeDataInStoreDatabase = new StoreModelInStoreDatabase({
      store_type: "SUPPLIER",
    });
    await storeDataInStoreDatabase.save();

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
      const missingParamString = missingParam
        .map((param) => param.replace(/_/g, " "))
        .join(", ");
      return sendResponse(res, 400, `${missingParamString} tidak boleh kosong`);
    }

    const existingStore = await StoreModel.findOne();

    if (!existingStore) {
      return sendResponse(res, 404, "Tidak ada data toko yang ditemukan");
    }

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
    if (!existingStore.account_holder.id) {
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

    if (updatedStoreModel.store_image) {
      updatedStoreModel.store_image = await showImage(
        req,
        updatedStoreModel.store_image
      );
    }

    if (updatedStoreModel.details.id_card_image) {
      updatedStoreModel.details.id_card_image = await showImage(
        req,
        updatedStoreModel.details.id_card_image
      );
    }

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
  const apiKey = XENDIT_API_KEY;

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
      { email: account_holder_email },
      { headers }
    );

    if (response.data) {
      existingStore.account_holder.email = response.data.email;
      await existingStore.save();
    }

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

const getAllStoreRaku = async (req, res) => {
  try {
    // Filter langsung di database untuk mendapatkan hanya store yang isRakuStore = true
    const allStore = await UserModel.find({});

    if (allStore.length < 1) {
      return sendResponse(res, 404, "Store not found", null);
    }

    // Menggabungkan semua array store_database_name menjadi satu array
    const mergedStoreDatabaseNames = allStore.reduce(
      (accumulator, currentUser) => {
        return accumulator.concat(currentUser.store_database_name);
      },
      []
    );

    // Menyaring dokumen dengan isRakuStore true
    const rakuStoreDatabaseNames = mergedStoreDatabaseNames.filter(
      (store) => store.isRakuStore
    );

    let result = [];
    for (const db of rakuStoreDatabaseNames) {
      const database = await connectTargetDatabase(db.name);

      const StoreModelDatabase = database.model("Store", storeSchema);
      const data = await StoreModelDatabase.findOne();

      const dataItem = {
        db_name: db.name,
        store_name: data?.store_name || db.name,
        isRakuStore: db.isRakuStore,
        address: data?.address || null,
        state: data?.state || null,
        city: data?.city || null,
        country: data?.country || null,
        postal_code: data?.postal_code || null,
        rent: db.rent,
        store_type: db.type,
        merchant_role: data?.merchant_role || null,
      };
      result.push(dataItem);
    }

    return sendResponse(res, 200, "Get all store successfully", result);
  } catch (error) {
    console.error("Error getting all stores:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};
// const getAllStoreRaku = async (req, res) => {
//   try {
//     // Filter langsung di database untuk mendapatkan hanya store yang isRakuStore = true
//     const allStore = await UserModel.find({
//       "store_database_name.isRakuStore": true,
//     });

//     if (allStore.length < 1) {
//       return sendResponse(res, 404, "Store not found", null);
//     }

//     // Membangun array store berdasarkan hasil query yang telah difilter
//     const store = allStore.flatMap((user) =>
//       user.store_database_name.map((row) => {
//         let rent = false;

//         if (row.rent && row.rent.length > 0) {
//           const findRent = row.rent.find((rentRow) =>
//             moment(rentRow.end_date).isAfter(moment())
//           );

//           if (findRent) rent = true;
//         }

//         return {
//           db_name: row.name,
//           store_name: row.store_name || row.name,
//           isRakuStore: row.isRakuStore,
//           address: row.address,
//           state: row.state,
//           city: row.city,
//           country: row.country,
//           postal_code: row.postal_code,
//           rent: rent,
//           store_type: row.type,
//           merchant_role: row.merchant_role,
//         };
//       })
//     );

//     return sendResponse(res, 200, "Get all store successfully", store);
//   } catch (error) {
//     console.error("Error getting all stores:", error);
//     return sendResponse(res, 500, "Internal Server Error", {
//       error: error.message,
//     });
//   }
// };

export default {
  registerStore,
  updateStore,
  getAllStoreRaku,
  updateAccountHolder,
};
