import moment from "moment";
import {
  connectTargetDatabase,
  connectTargetDatabaseForEngine,
} from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import { configAppForPOSSchema } from "../../models/configAppModel.js";
import { DatabaseModel } from "../../models/databaseModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { storeSchema } from "../../models/storeModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { productSchema } from "../../models/productModel.js";
import { stockHistorySchema } from "../../models/stockHistoryModel.js";
import { query } from "express";
const timezones = Intl.DateTimeFormat().resolvedOptions().timeZone;
import { STATUS_POSITION } from "../../models/positionModel.js";

const getRentedRacksByUser = async (req, res) => {
  const params = req?.params;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  console.log(req.query);

  try {
    if (!params?.user_id) {
      return sendResponse(res, 400, "Params user id is required");
    }

    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const categoryModelStore = storeDatabase.model("Category", categorySchema);
    const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
    const positionModelStore = storeDatabase.model("position", positionSchema);
    const stockHistoryModelStore = storeDatabase.model(
      "stockHistory",
      stockHistorySchema
    );
    const productModelStore = storeDatabase.model("Product", productSchema);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const ConfigAppModel = storeDatabase.model(
      "config_app",
      configAppForPOSSchema
    );

    const configApps = await ConfigAppModel.find({});
    const rent_due_date = configApps[0]?.rent_due_date;

    const today = moment().tz(timezones).toDate();
    let rent;
    let due_date = req?.query?.due_date ?? null;

    const endDate = moment.tz(timezones).toDate();
    const yesterday = moment
      .tz(timezones)
      .subtract(rent_due_date, "days")
      .toDate();
    const startDate = moment.tz(yesterday, timezones).toDate();

    if (due_date === "true") {
      rent = await RentModelStore.find({
        db_user: params?.user_id,
        end_date: { $gte: startDate, $lt: endDate },
      }).populate(["rak", "position"]);
    } else {
      rent = await RentModelStore.find({
        db_user: params?.user_id,
      }).populate(["rak", "position"]);
    }
    const filterRent = rent.filter((r) =>
      moment.tz(r.end_date, timezones).isAfter(today)
    );
    // console.log(params?.user_id);
    if (req.query.position) {
      const filterIncoming = filterRent.filter(
        (r) => r.position.status === req?.query?.position
      );

      let listfilterIncomingRentwithProduct = [];
      for (const element of filterIncoming) {
        if (element.position._id) {
          const product = await productModelStore.findOne({
            position_id: element.position._id,
          });
          console.log("product" + product);

          // console.log("element.position" + element.position);

          if (product !== null) {
            const stock = await stockHistoryModelStore.find({
              product: product._id,
            });
            // console.log(stock);
            product._doc.stockhistory = stock;
            element._doc.position._doc.product = product;
          }
        }

        listfilterIncomingRentwithProduct.push({
          ...element._doc,
        });
      }

      return sendResponse(
        res,
        200,
        "Get all incoming rent successfully",
        listfilterIncomingRentwithProduct,
        {
          rent_due_date,
        }
      );
    }
    let listfilterRentwithProduct = [];
    for (const element of filterRent) {
      if (element.position._id) {
        const product = await productModelStore.findOne({
          position_id: element.position._id,
        });
        console.log("product" + product);

        // console.log("element.position" + element.position);

        if (product !== null) {
          const stock = await stockHistoryModelStore.find({
            product: product._id,
          });
          // console.log(stock);
          product._doc.stockhistory = stock;
          element._doc.position._doc.product = product;
        }
      }

      if (
        element.position.status === STATUS_POSITION.RENTED ||
        element.position.status === STATUS_POSITION.INCOMING
      ) {
        listfilterRentwithProduct.push({
          ...element._doc,
        });
      }
    }

    if (!filterRent || filterRent.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }

    return sendResponse(
      res,
      200,
      "Get all rent successfully",
      listfilterRentwithProduct,
      {
        rent_due_date,
      }
    );
  } catch (error) {
    console.error("Error getting all rents:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

// const getRentedRacksByUser = async (req, res) => {
//   const params = req?.params;
//   const targetDatabase = req.get("target-database");

//   if (!targetDatabase) {
//     return sendResponse(res, 400, "Target database is not specified", null);
//   }

//   const storeDatabase = await connectTargetDatabase(targetDatabase);

//   try {
//     if (!params?.user_id) {
//       return sendResponse(res, 400, "Params user id is required");
//     }

//     const rakModelStore = storeDatabase.model("rak", rakSchema);
//     const categoryModelStore = storeDatabase.model("Category", categorySchema);
//     const typeModelStore = storeDatabase.model("rakType", rakTypeSchema);
//     const positionModelStore = storeDatabase.model("position", positionSchema);
//     const RentModelStore = storeDatabase.model("rent", rentSchema);
//     const ConfigAppModel = storeDatabase.model(
//       "config_app",
//       configAppForPOSSchema
//     );

//     const configApps = await ConfigAppModel.find({});
//     const rent_due_date = configApps[0]["rent_due_date"];

//     const today = new Date();
//     let rent;
//     let due_date = req?.query?.due_date ?? null;

//     if (due_date === "true") {
//       const endDate = new Date();
//       var yesterday = endDate - 1000 * 60 * 60 * 24 * rent_due_date; // dua hari jatuh tempo;
//       const startDate = new Date(yesterday);

//       rent = await RentModelStore.find({
//         db_user: params?.user_id,
//         end_date: { $gte: startDate.toString(), $lt: endDate.toString() },
//       }).populate(["rak", "position"]);
//     } else {
//       rent = await RentModelStore.find({
//         db_user: params?.user_id,
//       }).populate(["rak", "position"]);
//     }
//     const filterRent = rent.filter(
//       (r) => new Date(r.position.end_date).getTime() > today.getTime()
//     );

//     // Query untuk mendapatkan semua transaksi yang dibuat oleh user tertentu dan mengumpulkan rak_id dan position_id
//     if (!filterRent || filterRent.length < 1) {
//       return sendResponse(res, 400, "Rak not found", null);
//     }

//     return sendResponse(res, 200, "Get all rent successfully", filterRent, {
//       rent_due_date,
//     });
//   } catch (error) {
//     console.error("Error getting Get all rent:", error);
//     return sendResponse(res, 500, "Internal Server Error", {
//       error: error.message,
//     });
//   }
// };

const engineResetStatus = async (req, res) => {
  try {
    const allStore = await DatabaseModel.find({});

    if (!allStore || allStore.length === 0) {
      return sendResponse(res, 400, `Store not found`, null);
    }

    const today = moment(new Date()).format();
    const allPositionUpdate = [];
    const batchSize = 10; // Sesuaikan ukuran batch sesuai kebutuhan
    const parallelLimit = 5; // Batasan jumlah paralelisme
    let totalDatabase = 0;
    for (const item of allStore) {
      let database;
      try {
        database = await connectTargetDatabaseForEngine(item.db_name);
        const PositionModel = database.model("position", positionSchema);

        let skip = 0;
        let hasMore = true;

        while (hasMore) {
          const existingPositions = await PositionModel.find({
            status: "RENT",
            end_date: { $lt: today },
          })
            .limit(batchSize)
            .skip(skip);

          if (existingPositions.length === 0) {
            hasMore = false;
          } else {
            const updatePromises = existingPositions.map((position) =>
              PositionModel.findOneAndUpdate(
                { _id: position._id },
                {
                  $set: {
                    status: "AVAILABLE",
                    start_date: null,
                    end_date: null,
                    available_date: null,
                  },
                },
                { new: true }
              )
            );

            const positionUpdates = await Promise.all(updatePromises);
            allPositionUpdate.push(...positionUpdates);

            skip += batchSize;

            // Menunggu sebelum melanjutkan ke batch berikutnya
            if (skip % (batchSize * parallelLimit) === 0) {
              console.error(`waiting batch ${batchSize}`);
              await new Promise((resolve) => setTimeout(resolve, 3000));
            }
          }
        }
      } catch (error) {
        console.error(`Error processing store ${item._id}: ${error.message}`);
      } finally {
        if (database) {
          database.close();
          console.error(`close database ${item.db_name}`);
        }
      }
      totalDatabase += 1;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    return sendResponse(
      res,
      200,
      "Engine reset status successfully",
      allPositionUpdate,
      {
        totalDatabase,
      }
    );
  } catch (error) {
    console.error("Error Engine reset status:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default {
  getRentedRacksByUser,
  engineResetStatus,
};
