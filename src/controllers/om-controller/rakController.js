import moment from "moment";
import {
  connectTargetDatabase,
} from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import { configAppForPOSSchema } from "../../models/configAppModel.js";
import { configSettingSchema } from "../../models/configSetting.js";
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
import { isRaku } from "../../utils/checkUser.js";
import { generateRandomSku } from "../../utils/generateSku.js";
import { formatDatetime } from "../../utils/getDatetimeOnly.js";
import { showImage } from "../../utils/handleShowImage.js";

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
    icon,
  } = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified");
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const PositionModel = storeDatabase.model("position", positionSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const RakTypeModel = storeDatabase.model("rakType", rakTypeSchema);
    const categoryExist = await CategoryModel.findOne({
      _id: category_id,
    });

    if (!categoryExist) {
      return sendResponse(res, 400, "Category not found", null);
    }

    const rakTypeExist = await RakTypeModel.findOne({
      _id: type_id,
    });

    if (!rakTypeExist) {
      return sendResponse(res, 400, "Type not found", null);
    }

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

    const sku = await generateRandomSku("RAK", rakModelStore);

    const rak = await rakModelStore.create({
      name,
      sku,
      image: imagePath,
      icon,
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
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const ConfigAppModel = storeDatabase.model(
      "config_app",
      configAppForPOSSchema
    );

    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    const { search, category } = req.query;
    const filter = { status: { $ne: "DELETED" } };

    if (search) {
      filter.$or = [{ name: { $regex: new RegExp(search, "i") } }];

      // Check if search is a valid number
      const searchNumber = Number(search);
      if (!isNaN(searchNumber)) {
        filter.$or.push({ price_perday: searchNumber });
      }
    }

    if (category != "Semua") {
      if (category) {
        filter["category"] = category; // Filter berdasarkan ID kategori
      }
    }

    // const rakModelStore = storeDatabase.model("rak", rakSchema);

    // Ambil semua rak
    const allRaks = await rakModelStore
      .find(filter)
      .populate([
        { path: "category" },
        { path: "type" },
        {
          path: "positions",
          populate: { path: "filter", model: "Category" }, // Populate filter within positions
        },
      ])
      .sort({ createdAt: -1 })
      .lean({ virtuals: true }); // Ensure virtuals are included in the query results
    // console.log({ position: allRaks[0].positions.start_date });

    if (!allRaks || allRaks.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }

    // for (let rak of allRaks) {
    //   rak.image = await showImage(req, rak.image);
    //   // const rent = await RentModelStore.find({
    //   //   rak: rak.id,
    //   // }).sort({ createdAt: -1 });
    //   // rak.rent = rent;
    // }

    // Log the positions with the dynamically calculated status
    allRaks.forEach(async (rak) => {
      rak.image = await showImage(req, rak.image);
      rak.positions.forEach((position) => {
        const today = new Date();
        const isRent = position.end_date < today;
        if (position.end_date && !isRent) {
          position.status = STATUS_POSITION.RENTED;
        } else {
          position.status = STATUS_POSITION.AVAILABLE;
        }
        console.log(
          `Position: ${position.name_position}, Status: ${position.status}`
        );
      });
    });

    const configApps = await ConfigAppModel.find({});
    return sendResponse(res, 200, "Get all rak successfully", allRaks, {
      minimum_rent_date: configApps[0]["minimum_rent_date"],
    });
  } catch (error) {
    console.error("Error getting Get all rak:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getSingleRak = async (req, res) => {
  const params = req?.query;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    if (!params?.rak_id) {
      return sendResponse(res, 400, "rak id param not filled", null);
    }

    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const ConfigAppModel = storeDatabase.model(
      "config_app",
      configAppForPOSSchema
    );

    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    // const rakModelStore = storeDatabase.model("rak", rakSchema);

    // Ambil semua rak
    const singleRak = await rakModelStore
      .findById(params?.rak_id)
      .populate([
        { path: "category" },
        { path: "type" },
        {
          path: "positions",
          populate: { path: "filter", model: "Category" }, // Populate filter within positions
        },
      ])
      .sort({ createdAt: -1 });
    // console.log({ position: allRaks[0].positions.start_date });

    if (!singleRak || singleRak.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }
    const today = moment(new Date()).format();
    const todayDatetime = moment(new Date()).format();
    for (let position of singleRak.positions) {
      if (position.start_date && position.end_date) {
        const endDate = new Date(position.end_date);
        endDate.setDate(endDate.getDate() - 2);

        let due_date = moment(endDate).format();

        const status = due_date < today ? "IN_COMING" : position.status;

        const isDate =
          moment(position.available_date).format("yyyy-MM-DD") < todayDatetime;
        if (isDate) {
          position.available_date = today;
        }
        position.status = status;
        position.due_date = endDate;
      }
    }
    const configApps = await ConfigAppModel.find({});
    return sendResponse(res, 200, "Get rak detail successfully", singleRak, {
      minimum_rent_date: configApps[0]["minimum_rent_date"],
    });
  } catch (error) {
    console.error("Error getting Get rak detail:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const updateRak = async (req, res) => {
  const body = req?.body;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified");
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
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
    // const icon = body?.icon;

    // let iconPath = "";
    // if (icon) {
    //   if (!icon.startsWith("data:image")) {
    //     return sendResponse(
    //       res,
    //       400,
    //       "Icon format must be start with data:image ",
    //       null
    //     );
    //   }

    //   // Jika store_image dikirim dan tidak kosong, simpan gambar
    //   if (icon.startsWith("data:image")) {
    //     const targetDirectory = "rak_icon";
    //     iconPath = await saveBase64ImageWithAsync(
    //       icon,
    //       targetDirectory,
    //       targetDatabase,
    //       rak?.icon !== "" ? rak?.icon.split("\\")[3] : null
    //     );
    //   }
    // }

    rak.image = imagePath === "" ? rak.image : imagePath;
    rak.icon = body?.icon;
    rak.category = body?.category_id;
    rak.type = body?.type_id;
    rak.name = body?.name;
    rak.discount = body?.discount;
    rak.price_perday = body?.price_perday;
    rak.height = body?.height;
    rak.long_size = body?.long_size;

    for (const position of body?.positions) {
      // if (position.status == STATUS_POSITION.AVAILABLE) {
      const result = await positionModelStore.updateOne(
        { _id: position.id }, // Use `_id` if `id` is the unique identifier
        {
          $set: {
            name_position: position.name_position,
            row: position.row,
            column: position.column,
            height: position.height,
            long_size: position.long_size,
            status: position.status,
            available_date: position.available_date,
          },
        }
      );

      console.log({ result });
      if (result.matchedCount === 0) {
        console.log(`No document found with id: ${position.id}`);
      } else {
        console.log(`Updated document with id: ${position.id}`);
      }
      // }
    }

    await rak.save();

    const rakUpdate = await rakModelStore
      .findById(body?.rak_id)
      .populate(["category", "type", "positions"])
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, "Update rak successfully", rakUpdate);
  } catch (error) {
    console.error("Error getting create rak:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default {
  createRak,
  getAllRak,
  getSingleRak,
  updateRak,
};
