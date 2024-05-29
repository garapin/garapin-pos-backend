import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import {
  PositionModel,
  STATUS_POSITION,
  positionSchema,
} from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTransactionSchema } from "../../models/rakTransactionModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { saveBase64ImageWithAsync } from "../../utils/base64ToImage.js";
import { generateRandomSku } from "../../utils/generateSku.js";

const createRak = async (req, res) => {
  const {
    name,
    image,
    discount,
    price_perday,
    stok,
    create_by,
    category_id,
    type_id,
    positions,
  } = req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified");
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const PositionModel = storeDatabase.model("position", positionSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const RakTypeModel = storeDatabase.model("rakType", rakTypeSchema);

    // const checkIfSkuDuplicated = await rakModelStore.findOne({ sku });

    // if (checkIfSkuDuplicated) {
    //   return apiResponse(
    //     res,
    //     400,
    //     "Sku duplicated, please create another sku",
    //     {}
    //   );
    // }

    let imagePath = "";
    if (image) {
      if (!image.startsWith("data:image")) {
        return sendResponse(
          res,
          400,
          "Image format must be start with data:image ",
          null
        );
      }

      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (image.startsWith("data:image")) {
        const targetDirectory = "rak_image";
        imagePath = await saveBase64ImageWithAsync(
          image,
          targetDirectory,
          targetDatabase
        );
      }
    }

    let iconPath = "";
    if (req?.body?.icon) {
      if (!req?.body?.icon.startsWith("data:image")) {
        return sendResponse(
          res,
          400,
          "Icon format must be start with data:image ",
          null
        );
      }

      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (req?.body?.icon.startsWith("data:image")) {
        const targetDirectory = "rak_icon";
        iconPath = await saveBase64ImageWithAsync(
          req?.body?.icon,
          targetDirectory,
          targetDatabase
        );
      }
    }

    const sku = await generateRandomSku("RAK", rakModelStore);

    const rak = await rakModelStore.create({
      name,
      sku,
      image: imagePath,
      icon: iconPath,
      discount,
      price_perday,
      description: req?.body?.description,
      stok,
      create_by,
      category: category_id,
      type: type_id,
      height: req?.body?.height,
      long_size: req?.body?.long_size,
    });

    if (rak) {
      for (const position of positions) {
        position["rak_id"] = rak.id;
      }
      await positionModelStore.insertMany(positions);
    }

    const rakDetail = await rakModelStore
      .findById(rak.id)
      .populate(["category", "type", "positions"]);

    return sendResponse(res, 200, "Create rak successfully", rakDetail);
  } catch (error) {
    console.error("Error getting create rak:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllRak = async (req, res) => {
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

    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    // const rakModelStore = storeDatabase.model("rak", rakSchema);

    // Ambil semua rak
    const allRaks = await rakModelStore
      .find()
      .populate(["category", "type", "positions"])
      .sort({ createdAt: -1 });
    // console.log({ position: allRaks[0].positions.start_date });

    if (!allRaks || allRaks.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }

    return sendResponse(res, 200, "Get all rak successfully", allRaks);
  } catch (error) {
    console.error("Error getting Get all rak:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getSingleRak = async (req, res) => {
  const params = req?.query;
  try {
    if (!params?.rak_id) {
      return sendResponse(res, 400, "rak id param not filled", null);
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

    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    // const rakModelStore = storeDatabase.model("rak", rakSchema);

    // Ambil semua rak
    const singleRak = await rakModelStore
      .findById(params?.rak_id)
      .populate(["category", "type", "positions"])
      .sort({ createdAt: -1 });
    // console.log({ position: allRaks[0].positions.start_date });

    if (!singleRak || singleRak.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }

    return sendResponse(res, 200, "Get rak detail successfully", singleRak);
  } catch (error) {
    console.error("Error getting Get rak detail:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const updateRak = async (req, res) => {
  const body = req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified");
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const PositionModel = storeDatabase.model("position", positionSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const RakTypeModel = storeDatabase.model("rakType", rakTypeSchema);

    const rak = await rakModelStore.findById(body?.rak_id);

    if (!rak) {
      return sendResponse(res, 404, "Rak not found", null);
    }

    const image = body?.image;

    let imagePath = "";
    if (image) {
      if (!image.startsWith("data:image")) {
        return sendResponse(
          res,
          400,
          "Image format must be start with data:image ",
          null
        );
      }
      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (image.startsWith("data:image")) {
        const targetDirectory = "rak_image";
        imagePath = await saveBase64ImageWithAsync(
          image,
          targetDirectory,
          targetDatabase,
          rak?.image !== "" ? rak?.image.split("\\")[3] : null
        );
      }
    }
    const icon = body?.icon;

    let iconPath = "";
    if (icon) {
      if (!icon.startsWith("data:image")) {
        return sendResponse(
          res,
          400,
          "Icon format must be start with data:image ",
          null
        );
      }

      // Jika store_image dikirim dan tidak kosong, simpan gambar
      if (icon.startsWith("data:image")) {
        const targetDirectory = "rak_icon";
        iconPath = await saveBase64ImageWithAsync(
          icon,
          targetDirectory,
          targetDatabase,
          rak?.icon !== "" ? rak?.icon.split("\\")[3] : null
        );
      }
    }

    rak.image = imagePath;
    rak.icon = iconPath;
    rak.category = body?.category_id;
    rak.type = body?.type_id;
    rak.name = body?.name;
    rak.discount = body?.discount;
    rak.price_perday = body?.price_perday;
    rak.height = body?.height;
    rak.long_size = body?.long_size;

    const positionOld = await positionModelStore.find({
      rak_id: rak.id,
    });
    if (positionOld.length > 0) {
      await positionModelStore.deleteMany({
        rak_id: rak.id,
      });
    }

    for (const position of body?.positions) {
      position["rak_id"] = rak.id;
    }
    await positionModelStore.insertMany(body?.positions);

    await rak.save();

    const rakUpdate = await rakModelStore
      .findById(body?.rak_id)
      .populate(["category", "type", "positions"])
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, "Update rak successfully", {
      rak: rakUpdate,
    });
  } catch (error) {
    console.error("Error getting create rak:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getRentedRacksByUser = async (req, res) => {
  const params = req?.query;

  try {
    if (!params?.user_id) {
      return sendResponse(res, 400, "Params user id is required");
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
    const RentModelStore = storeDatabase.model("rent", rentSchema);

    // Query untuk mendapatkan semua transaksi yang dibuat oleh user tertentu dan mengumpulkan rak_id dan position_id
    const rent = await RentModelStore.find({
      create_by: params?.user_id,
    }).populate(["rak", "type", "positions"]);

    if (!rent || rent.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }

    return sendResponse(res, 200, "Get all rent successfully", rent);
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

// const getAllRak = async (req, res) => {
//   try {
//     const targetDatabase = req.get("target-database");

//     if (!targetDatabase) {
//       return apiResponse(res, 400, "Target database is not specified", {});
//     }
//     const storeDatabase = await connectTargetDatabase(targetDatabase);
//     const rakModelStore = storeDatabase.model("rak", rakSchema);
//     const categoryModelStore = storeDatabase.model("Category", categorySchema);
//     const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
//     const positionModelStore = storeDatabase.model("position", positionSchema);

//     const RakTransactionModelStore = storeDatabase.model(
//       "rakTransaction",
//       rakTransactionSchema
//     );

//     // const rakModelStore = storeDatabase.model("rak", rakSchema);

//     // Ambil semua rak
//     const allRaks = await rakModelStore.find();

//     // Iterating through each rack
//     for (const rak of allRaks) {
//       // Find all positions associated with this rack

//       // Iterating through each position
//       for (const position of rak.positions) {
//         // Find active transaction associated with this position
//         const activeTransaction = await RakTransactionModelStore.findOne({
//           "list_rak.rak_id": rak._id,
//           "list_rak.position_id": position._id,
//           "list_rak.end_date": { $gte: new Date() },
//         });

//         // Determine position status based on the presence of active transaction
//         const status = activeTransaction
//           ? STATUS_POSITION.RENTED
//           : STATUS_POSITION.AVAILABLE;

//         // Add status field to position
//         position["status"] = status;
//       }
//     }
//     if (!allRaks) {
//       return apiResponse(res, 400, "Rak not found", {});
//     }

//     return apiResponse(res, 200, "Get all rak successfully", {
//       allRaks,
//     });
//   } catch (error) {
//     console.error("Error getting Get all rak:", error);
//     return apiResponse(res, 500, "Internal Server Error", {
//       error: error.message,
//     });
//   }
// };

export default {
  createRak,
  getAllRak,
  getRentedRacksByUser,
  getSingleRak,
  updateRak,
};
