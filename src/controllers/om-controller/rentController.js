import moment from "moment";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
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

    if (!allStore) {
      return sendResponse(res, 400, `Store not found `, null);
    }
    const today = moment(new Date()).format();
    const allPositionUpdate = [];
    for (const item of allStore) {
      const database = await connectTargetDatabase(item.db_name);
      const PositionModel = database.model("position", positionSchema);
      const existingPosition = await PositionModel.find();
      if (existingPosition.length > 0) {
        for (let position of existingPosition) {
          const end_date = moment(position.end_date).format("yyyy-MM-DD");
          if (position.status === "RENT" && end_date < today) {
            const positionUpdate = await PositionModel.findOne({
              _id: position._id,
            });
            positionUpdate.status = "AVAILABLE";
            positionUpdate.start_date = null;
            positionUpdate.end_date = null;
            positionUpdate.available_date = null;

            await positionUpdate.save();
            allPositionUpdate.push(positionUpdate);
          }
        }
      }
      database.close();
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
