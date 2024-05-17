import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTransactionSchema } from "../../models/rakTransactionModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";
import { saveBase64ImageWithAsync } from "../../utils/base64ToImage.js";

const createRak = async (req, res) => {
  const {
    name,
    sku,
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
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const rakModelStore = storeDatabase.model("rak", rakSchema);

    const checkIfSkuDuplicated = await rakModelStore.findOne({ sku });

    if (checkIfSkuDuplicated) {
      return apiResponse(
        res,
        400,
        "Sku duplicated, please create another sku",
        {}
      );
    }

    let imagePath = "";
    if (image) {
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
      category_id,
      type_id,
      positions,
    });
    return apiResponse(res, 200, "Create rak successfully", rak);
  } catch (error) {
    console.error("Error getting create rak:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
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
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);

    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    // const rakModelStore = storeDatabase.model("rak", rakSchema);

    // Ambil semua rak
    const allRaks = await rakModelStore.find();

    // Iterating through each rack
    for (const rak of allRaks) {
      // Find all positions associated with this rack

      // Iterating through each position
      for (const position of rak.positions) {
        // Find active transaction associated with this position
        const activeTransaction = await RakTransactionModelStore.findOne({
          "list_rak.rak_id": rak._id,
          "list_rak.position_id": position._id,
          "list_rak.end_date": { $gte: new Date() },
        });

        // Determine position status based on the presence of active transaction
        const status = activeTransaction ? "sedang disewa" : "tersedia";

        // Add status field to position
        position["status"] = status;
      }
    }
    if (!allRaks) {
      return apiResponse(res, 400, "Rak not found", {});
    }

    return apiResponse(res, 200, "Get all rak successfully", {
      allRaks,
    });
  } catch (error) {
    console.error("Error getting Get all rak:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { createRak, getAllRak };
