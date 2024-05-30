import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { cartRakSchema } from "../../models/cartRakModel.js";
import { categorySchema } from "../../models/categoryModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";

const addCart = async (req, res) => {
  const { user_id, rak, position, start_date, end_date } = req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const CartRakModel = storeDatabase.model("CartRak", cartRakSchema);

    const rakExist = await rakModelStore.findOne({
      _id: rak,
    });

    if (!rakExist) {
      return sendResponse(res, 400, `Rak not found `, null);
    }

    const positionExist = await positionModelStore.findOne({
      _id: position,
      rak_id: rak,
    });

    if (!positionExist) {
      return sendResponse(res, 400, `Position not found `, null);
    }

    let cart = await CartRakModel.findOne({ user_id: user_id });

    if (!cart) {
      cart = new CartRakModel({
        user_id: user_id,
        list_rak: [
          {
            rak: rak,
            position: position,
            start_date,
            end_date,
          },
        ],
      });
    } else {
      if (cart.list_rak.length > 0) {
        for (const cartRak of cart.list_rak) {
          const isDuplicate =
            cartRak.rak.toString() === rak &&
            cartRak.position.toString() === position
              ? true
              : false;

          if (isDuplicate) {
            return sendResponse(res, 400, `Rak & position duplicated `, null);
          }
        }
      }

      cart.list_rak.push({
        rak: rak,
        position: position,
        start_date,
        end_date,
      });
    }

    await cart.save();

    return sendResponse(res, 200, "add cart successfully", cart);
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getCartByUserId = async (req, res) => {
  const params = req?.query;

  try {
    if (!params?.user_id) {
      return sendResponse(res, 400, "User id Not Found", null);
    }

    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const CartRakModel = storeDatabase.model("CartRak", cartRakSchema);

    const cart = await CartRakModel.findOne({
      user_id: params?.user_id,
    }).populate(["list_rak.position", "list_rak.rak"]);

    if (!cart) {
      return sendResponse(res, 400, `cart not found `, null);
    }

    return sendResponse(res, 200, "get cart successfully", cart);
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { addCart, getCartByUserId };