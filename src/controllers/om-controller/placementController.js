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
  const { rent_id, list_product } = req?.body;
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
    }).populate(["rak", "position", "list_product.product"]);

    if (!rentExist) {
      return sendResponse(res, 400, "Rent not found", null);
    }
    // console.log({ filter: rentExist.list_product[0] });
    let messageProduct = null;
    for (const list of list_product) {
      const productCheck = await ProductModel.findOne({
        _id: list.product,
      }).populate(["category_ref"]);

      if (
        rentExist.position.filter.includes(
          productCheck.category_ref.id.toString()
        )
      ) {
        messageProduct = `Category ${productCheck.category_ref.category} product ${productCheck.name} cannot to place!`;
      }
    }

    if (messageProduct) {
      return sendResponse(res, 400, messageProduct, null);
    }

    // const placement = await PlacementModel.create({
    //   rent: rent_id,
    //   create_by: create_by,
    //   product: product_id,
    // });

    rentExist.list_product = list_product;

    await rentExist.save();

    const rent = await RentModelStore.findOne({
      _id: rent_id,
    }).populate(["rak", "position", "list_product.product"]);

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
    if (!params.db_user) {
      return sendResponse(res, 400, "Params db_user not found", null);
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

    const rent = await RentModelStore.find({
      db_user: params.db_user,
      // product: { $ne: null },
    }).populate(["rak", "position", "list_product.product"]);

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
