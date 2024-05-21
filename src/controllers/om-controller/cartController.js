import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { cartRakSchema } from "../../models/cartRakModel.js";
import { categorySchema } from "../../models/categoryModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";

const addCart = async (req, res) => {
  const { user_id, rak_id, position_id, start_date, end_date } = req?.body;

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

    const rak = await rakModelStore.findOne({
      _id: rak_id,
    });

    if (!rak) {
      return sendResponse(res, 400, `Rak not found `, null);
    }

    const position = await positionModelStore.findOne({
      _id: position_id,
      rak_id: rak_id,
    });

    if (!position) {
      return sendResponse(res, 400, `Position not found `, null);
    }

    let cart = await CartRakModel.findOne({ user_id: user_id });

    if (!cart) {
      cart = new CartRakModel({
        user_id: user_id,
        list_rak: [
          {
            rak_id,
            position_id,
            start_date,
            end_date,
          },
        ],
      });
    } else {
      if (cart.list_rak.length > 0) {
        for (const rak of cart.list_rak) {
          const isDuplicate =
            rak.rak_id.toString() === rak_id &&
            rak.position_id.toString() === position_id
              ? true
              : false;
          console.log({ rak_id_t: rak.rak_id, rak_id });
          if (isDuplicate) {
            return sendResponse(res, 400, `Rak & position duplicated `, null);
          }
        }
      }

      cart.list_rak.push({
        rak_id,
        position_id,
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

const getRak = async (req, res) => {
  const { user_id, rak_id, position_id, start_date, end_date } = req?.body;

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

    const rak = await rakModelStore.findOne({
      _id: rak_id,
    });

    if (!rak) {
      return sendResponse(res, 400, `Rak not found `, null);
    }

    const position = await positionModelStore.findOne({
      _id: position_id,
      rak_id: rak_id,
    });

    if (!position) {
      return sendResponse(res, 400, `Position not found `, null);
    }

    let cart = await CartRakModel.findOne({ user_id: user_id });

    if (!cart) {
      cart = new CartRakModel({
        user_id: user_id,
        list_rak: [
          {
            rak_id,
            position_id,
            start_date,
            end_date,
          },
        ],
      });
    } else {
      if (cart.list_rak.length > 0) {
        for (const rak of cart.list_rak) {
          const isDuplicate =
            rak.rak_id.toString() === rak_id &&
            rak.position_id.toString() === position_id
              ? true
              : false;
          console.log({ rak_id_t: rak.rak_id, rak_id });
          if (isDuplicate) {
            return sendResponse(res, 400, `Rak & position duplicated `, null);
          }
        }
      }

      cart.list_rak.push({
        rak_id,
        position_id,
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

export default { addCart };
