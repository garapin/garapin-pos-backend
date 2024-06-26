import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { configSettingSchema } from "../../models/configSetting.js";
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
  } finally {
    storeDatabase.close();
  }
};

const getAllConfigSetting = async (req, res) => {
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

    const configSetting = await configSettingModel.find();

    if (configSetting < 1) {
      return sendResponse(res, 404, "Data not found");
    }

    return sendResponse(
      res,
      200,
      "get all config setting successfully",
      configSetting
    );
  } catch (error) {
    console.error("Error getting Get config settins:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  } finally {
    storeDatabase.close();
  }
};

const updateConfigSetting = async (req, res) => {
  const { name, value, description } = req?.body;
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
    const configSettingModel = storeDatabase.model(
      "configSetting",
      configSettingSchema
    );

    const existingConfigSetting = await configSettingModel.find();

    // existingConfigSetting.payment_duration = payment_duration ? payment_duration : existingConfigSetting.payment_duration;
    // existingConfigSetting.minimum_rent_date = minimum_rent_date ? minimum_rent_date : existingConfigSetting.minimum_rent_date;

    // const configSetting = await existingConfigSetting.save();

    return sendResponse(
      res,
      200,
      "Update config setting successfully",
      existingConfigSetting
    );
  } catch (error) {
    console.error("Error getting add config setting:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  } finally {
    storeDatabase.close();
  }
};

export default {
  addConfigSetting,
  getAllConfigSetting,
  updateConfigSetting,
};
