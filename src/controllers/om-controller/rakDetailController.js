import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { rakPositionSchema } from "../../models/rakDetailModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";

const createRakDetail = async (req, res) => {
  const { rak_id, position_id } = req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RakDetailModelStore = storeDatabase.model(
      "rakDetail",
      rakPositionSchema
    );

    const rakDetail = await RakDetailModelStore.create({
      rak_id,
      position_id,
    });

    return apiResponse(res, 200, "Create rak detail successfully", {
      rakDetail,
    });
  } catch (error) {
    console.error("Error getting Create rak detail:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllType = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TypeModelStore = storeDatabase.model("rakType", rakTypeSchema);

    const type = await TypeModelStore.find({}).sort({
      name_type: 1,
    });

    if (!type) {
      return apiResponse(res, 400, "rak detail not found", {});
    }

    return apiResponse(res, 200, "Get all rak detail successfully", { type });
  } catch (error) {
    console.error("Error getting Get all rak detail:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { createRakDetail, getAllType };
