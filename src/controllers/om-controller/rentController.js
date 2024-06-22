import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { categorySchema } from "../../models/categoryModel.js";
import { positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";

const getRentedRacksByUser = async (req, res) => {
  const params = req?.params;

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
    let rent;
    let due_date = req?.query?.due_date ?? null;
    if (due_date === "true") {
      const endDate = new Date();
      var yesterday = endDate - 1000 * 60 * 60 * 24 * 2; // dua hari jatuh tempo;
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

    return sendResponse(res, 200, "Get all rent successfully", rent);
  } catch (error) {
    console.error("Error getting Get all rent:", error);
	storeDatabase.close();
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
  storeDatabase.close();
};

export default {
  getRentedRacksByUser,
};
