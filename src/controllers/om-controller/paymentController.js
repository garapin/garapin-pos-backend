import moment from "moment";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { STATUS_POSITION, positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import {
  PAYMENT_STATUS_RAK,
  rakTransactionSchema,
} from "../../models/rakTransactionModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { UserModel } from "../../models/userModel.js";
const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN;
const timezones = Intl.DateTimeFormat().resolvedOptions().timeZone;

const invoiceCallback = async (req, res) => {
  const callback = req?.body;
  const headerCallback = req?.headers;

  // console.log(headerCallback["x-callback-token"]);
  

  if (headerCallback["x-callback-token"] !== XENDIT_WEBHOOK_TOKEN) {
    console.log("CALLBACK TOKEN INVALID");
    return sendResponse(res, 400, "CALLBACK TOKEN INVALID", {});
  }

  const str = callback.external_id;
  const parts = str.split("&&");
  const invoice = parts[0];
  // const targetDatabase = "Test_store_keempat_eb77c7d1-4a8";
  const targetDatabase = parts[1];
  const type = parts[2];

  // console.log({ parts });
  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", {});
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const PositionModel = storeDatabase.model("position", positionSchema);

    const rakTransaction = await RakTransactionModelStore.findOne({
      invoice: str,
    });

    if (!rakTransaction) {
      return sendResponse(res, 404, "Transaction not found");
    }

    if (rakTransaction.payment_status !== "PENDING") {
      return sendResponse(
        res,
        404,
        "Something wrong, your have payment successfully or expired"
      );
    }

    const statusPosition =
      callback.status === PAYMENT_STATUS_RAK.EXPIRED ||
      callback.status === PAYMENT_STATUS_RAK.STOPPED
        ? STATUS_POSITION.AVAILABLE
        : STATUS_POSITION.RENTED;

    for (const element of rakTransaction.list_rak) {
      const position = await PositionModel.findById(element.position);

      const available_date = moment(element.end_date)
        .tz(timezones)
        .add(1, "second")
        .toDate();

      position["status"] = statusPosition;
      position["start_date"] = element.start_date;
      position["end_date"] = element.end_date;
      position["available_date"] = available_date;
      const rent = await RentModelStore.create({
        rak: element.rak,
        position: element.position,
        start_date: element.start_date,
        end_date: element.end_date,
        db_user: rakTransaction.db_user,
      });

      await addRentToStoreName(targetDatabase, rent);

      await position.save();
    }

    rakTransaction.payment_status = callback.status;
    rakTransaction.payment_method = callback.payment_method;
    rakTransaction.payment_channel = callback.payment_channel;
    rakTransaction.payment_date = callback.paid_at;

    await rakTransaction.save();

    return sendResponse(res, 200, "Thanks for paid transaction RAKU", {
      rakTransaction,
    });
    // const targetDatabase = req.get("target-database");
  } catch (error) {
    console.error("Error getting Create position:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

async function addRentToStoreName(storeName, newRent) {
  try {
    const result = await UserModel.findOneAndUpdate(
      { "store_database_name.name": storeName },
      {
        $push: {
          "store_database_name.$[elem].rent": newRent,
        },
      },
      {
        arrayFilters: [{ "elem.name": storeName }],
        new: true, // Mengembalikan dokumen yang telah diperbarui
      }
    );

    return {
      error: false,
      data: result,
    };
  } catch (error) {
    console.error("Error updating rent:", error);
    return {
      error: true,
      message: error,
    };
  }
}

export default {
  invoiceCallback,
};
