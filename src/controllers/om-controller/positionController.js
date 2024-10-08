import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";
import { productSchema } from "../../models/productModel.js";
import { transactionSchema } from "../../models/transactionModel.js";
import { stockHistorySchema } from "../../models/stockHistoryModel.js";

const createPosition = async (req, res) => {
  const { name_position, row, column, create_by } = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified", {});
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
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
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified", {});
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const PositionModelStore = storeDatabase.model("position", positionSchema);
    const rakModelStore = storeDatabase.model("rak", rakSchema);

    const position = await PositionModelStore.find({})
      .sort({
        name_position: 1,
      })
      .populate(["rak_id"]);

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

const getPositionDetails = async (req, res) => {
  const targetDatabase = req.get("target-database");
  if (!targetDatabase) {
    return apiResponse(res, 400, "Target database is not specified", {});
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);
  try {
    const PositionModelStore = storeDatabase.model("position", positionSchema);
    // const rakModelStore = storeDatabase.model("rak", rakSchema);
    const productModelStore = storeDatabase.model("product", productSchema);
    const position = await PositionModelStore.findById(req.params.id);
    const StockHistoryModel = storeDatabase.model(
      "StockHistory",
      stockHistorySchema
    ); // const rak = await rakModelStore.findById(position?.rak_id);
    // console.log(position);

    const product = await productModelStore.findOne({
      position_id: position._id,
    });
    const stockHistory = await StockHistoryModel.find({
      product: product._id,
    });
    console.log(stockHistory);

    if (!position) {
      return apiResponse(res, 400, "position not found", {});
    }

    return apiResponse(res, 200, "Get position details successfully", {
      position,
      product,
      stockHistory,
    });
  } catch (error) {
    console.error("Error getting Get position details:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const testpost = async (req, res) => {
  return apiResponse(res, 200, "test", {});
};
export default {
  createPosition,
  getAllPosition,
  getPositionDetails,
  testpost,
};
