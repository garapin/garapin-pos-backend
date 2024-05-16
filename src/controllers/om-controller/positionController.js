import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { positionSchema } from "../../models/positionModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";

const createPosition = async (req, res) => {
  const { name_position, row, column, create_by } = req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const PositionModelStore = storeDatabase.model("position", positionSchema);

    const position = await PositionModelStore.create({
      name_position,
      row,
      column,
      create_by,
      description: req?.body?.description,
    });

    return apiResponse(res, 200, "Create position successfully", { position });
  } catch (error) {
    console.error("Error getting Create position:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllPosition = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const PositionModelStore = storeDatabase.model("position", positionSchema);

    const position = await PositionModelStore.find({}).sort({
      name_position: 1,
    });

    if (!position) {
      return apiResponse(res, 400, "position not found", {});
    }

    return apiResponse(res, 200, "Get all position successfully", { position });
  } catch (error) {
    console.error("Error getting Get all position:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { createPosition, getAllPosition };
