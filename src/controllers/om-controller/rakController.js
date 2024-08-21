import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import { configAppForPOSSchema } from "../../models/configAppModel.js";
import { PositionModel, positionSchema } from "../../models/positionModel.js";
import { RakModel, rakSchema } from "../../models/rakModel.js";
import { rakTransactionSchema } from "../../models/rakTransactionModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { saveBase64ImageWithAsync } from "../../utils/base64ToImage.js";
import { generateRandomSku } from "../../utils/generateSku.js";
import { showImage } from "../../utils/handleShowImage.js";
import { UserModel } from "../../models/userModel.js";

import isExpired from "../../utils/timetools.js";





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
    const confModel = storeDatabase.model("config_app", configAppForPOSSchema);
    const configApp = await confModel.findOne();

    const { search, category } = req.query;
    const filter = { status: { $ne: "DELETED" } };

    if (search) {
      filter.$or = [{ name: { $regex: new RegExp(search, "i") } }];

      const searchNumber = Number(search);
      if (!isNaN(searchNumber)) {
        filter.$or.push({ price_perday: searchNumber });
      }
    }

    if (category !== "Semua" && category) {
      filter["category"] = category;
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
          populate: { path: "filter", model: "Category" },
        },
      ])
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    if (!allRaks || allRaks.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }

    const updatedRaks = await Promise.all(
      allRaks.map(async (rak) => {
        rak.image = await showImage(req, rak.image);
              return rak;
      })
    );

    const result = [];
    for (let item of allRaks) {
      const xs = item.positions.filter((x) => x.status === "AVAILABLE");
      item.status = xs.length > 0 ? "AVAILABLE" : "NOT AVAILABLE";

      const rakItem = {
        id: item._id,
        name: item.name,
        image: item.image,
        status: item.status,
        price: item.price_perday,
        discount: item.discount,
        long_size: item.long_size,
        height: item.height,
        category_name: item.category.category,
        type_name: item.type.name_type,
      };
      result.push(rakItem);
    }

    return sendResponse(res, 200, "Get all rak successfully", allRaks, {
      minimum_rent_date: configApp?.minimum_rent_date,
    });
  } catch (error) {
    console.error("Error getting Get all rak:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllPendingRakTransaction = async (req, res) => {
  const targetDatabase = req.get("target-database");
  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);


  const rakTransactionModelStore = storeDatabase.model(
    "rakTransaction",
    rakTransactionSchema
  );
  const rakModelStore = storeDatabase.model("rak", rakSchema);
  const positionModelStore = storeDatabase.model("position", positionSchema);


  const pending_transactions = await rakTransactionModelStore.find({ payment_status: "PENDING" }).populate({ path: "list_rak" });
  console.log("checking database: ", targetDatabase);
  pending_transactions.forEach(element => {
    // console.log(element.xendit_info.expiryDate);
    const expiryDate = element.xendit_info.expiryDate
    console.log(isExpired(expiryDate));
    
    if (isExpired(expiryDate)) {
      element.payment_status = "EXPIRED";
      element.save();
     element.list_rak.forEach(async (colrak) => {
        const rak = await rakModelStore.findById(colrak.rak);
        const position = await positionModelStore.findById(colrak.position);
        if (rak) {          
          rak.status = "AVAILABLE";
          rak.save();
          position.status ="AVAILABLE";
          position.save();
        }
      });
    }





     });



  return sendResponse(res, 200, "Get all pending rak transaction successfully", pending_transactions);


}

const getSingleRak = async (req, res) => {

  const token = req.headers.authorization || req.headers["x-access-token"];
  const { rak_id } = req.query;

  const targetDatabase = req.get("target-database");

  // Find user by token
  const user = await UserModel.findOne({ token: token });

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    if (!rak_id) {
      return sendResponse(res, 400, "rak id param not filled", null);
    }

    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const confModel = storeDatabase.model("config_app", configAppForPOSSchema);
    const configApp = await confModel.findOne();

    const rentByTb = RakModel({
      db_user: targetDatabase,
      rak: rak_id,
    });

    // Ambil semua rak
    const singleRak = await rakModelStore
      .findById(rak_id)
      .populate([
        { path: "category" },
        { path: "type" },
        // { path: "rent" },
        {
          path: "positions",
          populate: { path: "filter", model: "Category" },
        },
      ])
      .sort({ createdAt: -1 });

    if (!singleRak || singleRak.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }
    // singleRak.positions.forEach((position) => {

    //   const today = new Date();
    //   const endDate = new Date(position.end_date);
    //   const startDate = new Date(position.start_date);
    //   const dueDateInDays = configApp.due_date; //2
    //   const payDuration = configApp.payment_duration ; //1200

    //   if (position?.end_date) {
    //     if (position.status === "RENT") {
    //       const endDateWithDueDate = new Date(endDate);
    //       endDateWithDueDate.setDate(endDate.getDate() + dueDateInDays);
    //       position.available_date = today;
    //       if (
    //         today.getDate() > endDate.getDate() &&
    //         today.getDate() <= endDateWithDueDate.getDate()
    //       ) {
    //         position.status = "IN_COMING";
    //         position.available_date = endDateWithDueDate;
    //       } else if (today.getDate() > endDateWithDueDate.getDate()) {
    //         position.status = "AVAILABLE";
    //         position.available_date = today;
    //       }
    //     } else if (position.status === "UNPAID") {


    //       const nowNPayDuration = new Date(startDate.getTime() + payDuration);
    //       if (today.getTime() < nowNPayDuration.getTime()) {
    //         position.available_date = today;
    //         position.status = "AVAILABLE";
    //       }
    //     } else {
    //       position.available_date = today;
    //     }
    //   }
    //   // if (position.status === "UNPAID" && !position?.end_date) {
    //   //   position.status = "UNPAID";
    //   //   position.available_date = today;
    //   // }
    //   // if (position.status === "AVAILABLE" && !position?.end_date) {
    //   //   position.status = "AVAILABLE";
    //   //   position.available_date = today;
    //   // }
    // });
    const xs = singleRak.positions.filter((x) => x.status === "AVAILABLE");
    singleRak.status = xs.length > 0 ? "AVAILABLE" : "NOT AVAILABLE";

    return sendResponse(res, 200, "Get rak detail successfully", singleRak, {
      minimum_rent_date: configApp?.minimum_rent_date,
    });
  } catch (error) {
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
  getAllPendingRakTransaction,
};
