import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";
import { saveBase64ImageWithAsync } from "../../utils/base64ToImage.js";

const createRak = async (req, res) => {
  const { name, sku, image, discount, price_perday, stok, create_by } =
    req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const PositionModelStore = storeDatabase.model("position", positionSchema);

    return apiResponse(res, 200, "Create rak successfully", {});
  } catch (error) {
    console.error("Error getting create rak:", error);
    return apiResponse(res, 500, "Internal Server Error", { error });
  }
};

const getAllRak = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const rakModelStore = storeDatabase.model("rak", rakSchema);

    const rak = await rakModelStore.find({});

    if (!rak) {
      return apiResponse(res, 400, "Rak not found", {});
    }

    return apiResponse(res, 200, "Get all rak successfully", rak);
  } catch (error) {
    console.error("Error getting Get all rak:", error);
    return apiResponse(res, 500, "Internal Server Error", { error });
  }
};

export default { createRak, getAllRak };
