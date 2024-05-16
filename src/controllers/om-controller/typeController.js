import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";

const createType = async (req, res) => {
  const { name_type, create_by } = req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TypeModelStore = storeDatabase.model("rakType", rakTypeSchema);

    const type = await TypeModelStore.create({
      name_type,
      create_by,
      description: req?.body?.description,
    });

    return apiResponse(res, 200, "Create type successfully", { type });
  } catch (error) {
    console.error("Error getting Create type:", error);
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
      return apiResponse(res, 400, "type not found", {});
    }

    return apiResponse(res, 200, "Get all type successfully", { type });
  } catch (error) {
    console.error("Error getting Get all type:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { createType, getAllType };
