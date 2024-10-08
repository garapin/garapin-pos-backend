import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { cartRakSchema } from "../../models/cartRakModel.js";
import { categorySchema } from "../../models/categoryModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";

const addCart = async (req, res) => {
  const { db_user, rak, position, total_date } = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
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

    let cart = await CartRakModel.findOne({ db_user: db_user });

    if (!cart) {
      cart = new CartRakModel({
        db_user: db_user,
        list_rak: [
          {
            rak: rak,
            position: position,
            total_date,
            createdAt: new Date(),
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
        total_date,
        createdAt: new Date(),
      });
    }

    await cart.save();

    console.log("====================================");
    console.log(cart);
    console.log("====================================");

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
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    if (!params?.db_user) {
      return sendResponse(res, 400, "User id Not Found", null);
    }

    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const CartRakModel = storeDatabase.model("CartRak", cartRakSchema);

    const cart = await CartRakModel.findOne({
      db_user: params?.db_user,
    }).populate(["list_rak.position", "list_rak.rak"]);

    if (!cart) {
      return sendResponse(res, 400, `cart not found `, null);
    }

    for (const element of cart.list_rak) {
      // const end_date = new Date(element.position.available_date);
      // end_date.setDate(end_date.getDate() + element.total_date);

      element.start_date = element.position.available_date;
      if (element.position.available_date < new Date()) {
        element.start_date = new Date();
      }

      element.end_date = new Date(element.start_date).setDate(
        element.start_date.getDate() + element.total_date
      );
      // console.log("====================================");
      // console.log(element.start_date);
      // console.log(element.end_date);
      // console.log("====================================");
    }

    return sendResponse(res, 200, "get cart successfully", cart);
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const deleteItemCart = async (req, res) => {
  const { db_user, rak_id, position_id } = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const CartRakModel = storeDatabase.model("CartRak", cartRakSchema);

    const cart = await CartRakModel.findOne({
      db_user: db_user,
    });

    if (!cart) {
      return sendResponse(res, 400, `cart not found `, null);
    }

    // const filtered_list_rak = cart.list_rak.filter(
    //   (item) =>
    //     item.rak.toString() !== rak_id &&
    //     item.position.toString() !== position_id
    // );

    const cartUpdate = await CartRakModel.findByIdAndUpdate(
      {
        _id: cart.id,
      },
      {
        $pull: {
          list_rak: { position: position_id, rak: rak_id }, // Hapus item dari list_rak berdasarkan _id atau kondisi lain
        },
      },
      { new: true } // Mengembalikan dokumen yang sudah di-update
    ).populate(["list_rak.position", "list_rak.rak"]);

    return sendResponse(res, 200, "Delete cart successfully", cartUpdate);
  } catch (error) {
    console.error("Error getting Delete cart:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { addCart, getCartByUserId, deleteItemCart };
