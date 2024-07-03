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

const getRentedRacksByUser = async (req, res) => {
  const params = req?.params;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    if (!params?.user_id) {
      return sendResponse(res, 400, "Params user id is required");
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

    const configApps = await ConfigAppModel.find({});
    const rent_due_date = configApps[0]["rent_due_date"];
    let rent;
    let due_date = req?.query?.due_date ?? null;
    if (due_date === "true") {
      const endDate = new Date();
      var yesterday = endDate - 1000 * 60 * 60 * 24 * rent_due_date; // dua hari jatuh tempo;
      const startDate = new Date(yesterday);

      rent = await RentModelStore.find({
        db_user: params?.user_id,
        end_date: { $gte: startDate.toString(), $lt: endDate.toString() },
      }).populate(["rak", "position"]);
    } else {
      rent = await RentModelStore.find({
        db_user: params?.user_id,
      }).populate(["rak", "position"]);
    }

    // Query untuk mendapatkan semua transaksi yang dibuat oleh user tertentu dan mengumpulkan rak_id dan position_id

    if (!rent || rent.length < 1) {
      return sendResponse(res, 400, "Rak not found", null);
    }

    return sendResponse(res, 200, "Get all rent successfully", rent, {
      rent_due_date,
    });
  } catch (error) {
    console.error("Error getting Get all rent:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const engineResetStatus = async (req, res) => {
  try {
    const allStore = await DatabaseModel.find({});

    if (!allStore || allStore.length === 0) {
      return sendResponse(res, 400, `Store not found`, null);
    }

    const today = moment(new Date()).format();
    const allPositionUpdate = [];
    const batchSize = 100; // Sesuaikan ukuran batch sesuai kebutuhan
    const parallelLimit = 5; // Batasan jumlah paralelisme

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
              await new Promise((resolve) => setTimeout(resolve, 1000));
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
    }

    return sendResponse(
      res,
      200,
      "Engine reset status successfully",
      allPositionUpdate
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
