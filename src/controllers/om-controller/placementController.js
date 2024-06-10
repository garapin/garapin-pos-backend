import { exists } from "xendit-node";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import { placementSchema } from "../../models/placementModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { productSchema } from "../../models/productModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";

const addProductToRak = async (req, res) => {
  const { rent_id, create_by, product_id } = req?.body;
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const PlacementModel = storeDatabase.model("Placement", placementSchema);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const ProductModel = storeDatabase.model("Product", productSchema);

    // Query untuk mendapatkan semua transaksi yang dibuat oleh user tertentu dan mengumpulkan rak_id dan position_id
    const rentExist = await RentModelStore.findOne({
      _id: rent_id,
    });

    if (!rentExist) {
      return sendResponse(res, 400, "Rent not found", null);
    }

    // const placement = await PlacementModel.create({
    //   rent: rent_id,
    //   create_by: create_by,
    //   product: product_id,
    // });

    rentExist.product = product_id;

    await rentExist.save();

    const rent = await RentModelStore.findOne({
      _id: rent_id,
    }).populate(["rak", "position", "product"]);

    return sendResponse(res, 200, "Add product to rak successfully", rent);
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllPlacementByUser = async (req, res) => {
  const params = req?.query;
  try {
    if (!params.create_by) {
      return sendResponse(res, 400, "Params create_by not found", null);
    }
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const PlacementModel = storeDatabase.model("Placement", placementSchema);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const ProductModel = storeDatabase.model("Product", productSchema);

    const rent = await RentModelStore.findOne({
      create_by: params.create_by,
      // product: { $ne: null },
    }).populate(["rak", "position", "product"]);

    if (!rent) {
      return sendResponse(
        res,
        400,
        "List of products that have been placed not found",
        null
      );
    }

    return sendResponse(
      res,
      200,
      "List of products that have been placed successfully",
      rent
    );
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default {
  addProductToRak,
  getAllPlacementByUser,
};
