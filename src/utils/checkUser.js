import { connectTargetDatabase } from "../config/targetDatabase.js";
import { storeSchema } from "../models/storeModel.js";
import { sendResponse } from "./apiResponseFormat.js";

export const isRaku = async (targetDatabase) => {
  try {
    const database = await connectTargetDatabase(targetDatabase);
    const StoreModel = database.model("Store", storeSchema);

    const isRakuExist = await StoreModel.findOne();

    if (!isRakuExist) {
      return false;
    }

    if (isRakuExist.store_type !== "SUPPLIER") {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};
