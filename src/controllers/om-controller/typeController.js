import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";

const createType = async (req, res) => {
  const { name_type, create_by } = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified");
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const TypeModelStore = storeDatabase.model("rakType", rakTypeSchema);

    const type = await TypeModelStore.create({
      name_type,
      create_by,
      description: req?.body?.description,
    });

    return sendResponse(res, 200, "Create type successfully", type);
  } catch (error) {
    console.error("Error getting Create type:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllType = async (req, res) => {
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified");
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const TypeModelStore = storeDatabase.model("rakType", rakTypeSchema);

    const type = await TypeModelStore.find({}).sort({
      name_type: 1,
    });

    if (!type) {
      return sendResponse(res, 400, "type not found");
    }

    return sendResponse(res, 200, "Get all type successfully", type);
  } catch (error) {
    console.error("Error getting Get all type:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { createType, getAllType };
