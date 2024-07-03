import { connectTargetDatabase } from "../../config/targetDatabase.js";
import {
  ConfigAppModel,
  configAppForPOSSchema,
} from "../../models/configAppModel.js";
import { configSettingSchema } from "../../models/configSetting.js";
import { storeSchema } from "../../models/storeModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";

const addConfigSetting = async (req, res) => {
  const { category, name, configCode, value, type, description } = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const configSettingModel = storeDatabase.model(
      "configSetting",
      configSettingSchema
    );

    const existingConfigCode = await configSettingModel.findOne({ configCode });

    if (existingConfigCode) {
      return sendResponse(res, 400, "Config Code already exists");
    }

    const configSetting = await configSettingModel.create({
      category,
      name,
      configCode,
      value,
      type,
      description,
    });

    // if (!rakExist) {
    //   return sendResponse(res, 400, `Rak not found `, null);
    // }

    return sendResponse(
      res,
      200,
      "add config setting successfully",
      configSetting
    );
  } catch (error) {
    console.error("Error getting add config setting:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};
// const createConfigApp = async (data) => {
//   try {
//     const newConfigApp = new ConfigAppModel(data);
//     await newConfigApp.save();
//     console.log("New config app saved:", newConfigApp);
//   } catch (err) {
//     console.log("Error saving config app:", err);
//   }
// };

const getConfigSetting = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  // const newConfigAppData = {
  //   current_version: "1.0.0",
  //   link_playstore: "https://playstore.link",
  //   link_appstore: "https://appstore.link",
  //   test_login: "test_login_value",
  //   payment_duration: 30,
  //   minimum_rent_date: 7,
  //   rent_due_date: 15,
  // };

  // await createConfigApp(newConfigAppData);
  try {
    const ConfigAppModel = storeDatabase.model(
      "config_app",
      configAppForPOSSchema
    );

    const configApp = await ConfigAppModel.find();

    if (configApp < 1) {
      return sendResponse(res, 404, "Data not found");
    }

    return sendResponse(
      res,
      200,
      "get config setting successfully",
      configApp[0]
    );
  } catch (error) {
    console.error("Error getting Get config settings:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getMasterConfigSetting = async (req, res) => {
  try {
    const configApp = await ConfigAppModel.find();

    if (configApp < 1) {
      return sendResponse(res, 404, "Data not found");
    }

    return sendResponse(
      res,
      200,
      "get config setting successfully",
      configApp[0]
    );
  } catch (error) {
    console.error("Error getting Get config settings:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const updateConfigSetting = async (req, res) => {
  const { payment_duration, minimum_rent_date, rent_due_date } = req?.body;
  const params = req?.params;
  const targetDatabase = req.get("target-database");

  if (!params?.id) {
    return sendResponse(res, 400, "Id is not specified", null);
  }
  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const StoreModel = storeDatabase.model("Store", storeSchema);
    const store = await StoreModel.find();

    if (store[0].merchant_role !== "NOT_MERCHANT") {
      return sendResponse(
        res,
        400,
        "You do not have access to this action",
        null
      );
    }

    const ConfigAppModel = storeDatabase.model(
      "config_app",
      configAppForPOSSchema
    );

    const configApp = await ConfigAppModel.findById({
      _id: params?.id,
    });

    if (!configApp) {
      return sendResponse(res, 400, "Data not found", null);
    }

    configApp.payment_duration = payment_duration;
    configApp.minimum_rent_date = minimum_rent_date;
    configApp.rent_due_date = rent_due_date;
    await configApp.save();

    return sendResponse(
      res,
      200,
      "Update config setting successfully",
      configApp
    );
  } catch (error) {
    console.error("Error getting add config setting:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const updateMasterConfigSetting = async (req, res) => {
  const { payment_duration, minimum_rent_date, rent_due_date } = req?.body;
  const params = req?.params;

  if (!params?.id) {
    return sendResponse(res, 400, "Id is not specified", null);
  }

  try {
    const configApp = await ConfigAppModel.findById({
      _id: params?.id,
    });

    if (!configApp) {
      return sendResponse(res, 400, "Data not found", null);
    }

    configApp.payment_duration = payment_duration;
    configApp.minimum_rent_date = minimum_rent_date;
    configApp.rent_due_date = rent_due_date;
    await configApp.save();

    return sendResponse(
      res,
      200,
      "Update master config apps successfully",
      configApp
    );
  } catch (error) {
    console.error("Error getting add config setting:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default {
  addConfigSetting,
  getConfigSetting,
  getMasterConfigSetting,
  updateConfigSetting,
  updateMasterConfigSetting,
};
