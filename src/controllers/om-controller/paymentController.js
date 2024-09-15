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
import { configAppForPOSSchema } from "../../models/configAppModel.js";
import timetools from "../../utils/timetools.js";
import {
  TransactionModel,
  transactionSchema,
} from "../../models/transactionModel.js";
import { ProductModel, productSchema } from "../../models/productModel.js";
import { Xendit, Invoice as InvoiceClient } from "xendit-node";

const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN;
const timezones = Intl.DateTimeFormat().resolvedOptions().timeZone;
const xenditInvoiceClient = new InvoiceClient({
  secretKey: process.env.XENDIT_API_KEY,
});

const XENDIT_ACCOUNT_GARAPIN = process.env.XENDIT_ACCOUNT_GARAPIN;

const invoiceCallback = async (req, res) => {
  const callback = req?.body;
  const headerCallback = req?.headers;

  // console.log(headerCallback["x-callback-token"]);

  if (headerCallback["x-callback-token"] !== XENDIT_WEBHOOK_TOKEN) {
    console.log("CALLBACK TOKEN INVALID");
    return sendResponse(res, 400, "CALLBACK TOKEN INVALID", {});
  }

  console.log("====================================");
  console.log(callback);
  console.log("====================================");

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

  if (type === "RAKU") {
    callbackRaku(targetDatabase, callback);
  } else if (type === "POS") {
    console.log("====================================");
    console.log(pos);
    console.log("====================================");
  } else if (type === "RAK") {
    callbackRak(targetDatabase, callback);
  }

  try {
    // const targetDatabase = req.get("target-database");
  } catch (error) {
    console.error("Error getting Create position:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

async function callbackRaku(targetDatabase, callback) {
  const storeDatabase = await connectTargetDatabase(targetDatabase);
  const TransactionModelStore = storeDatabase.model(
    "Transaction",
    transactionSchema
  );

  // console.log(targetDatabase);
  // console.log(invoice);
  // const idXenplatform = await getForUserId(targetDatabase);
  // if (!idXenplatform) {
  //   return sendResponse(res, 400, "for-user-id kosong");
  // }
  // console.log(invoicelable);

  const transaction = await TransactionModelStore.findOne({
    invoice: callback.external_id,
  });

  if (!transaction) {
    return false;
  }
  // console.log(transaction.webhook.id);

  // const invoices = await xenditInvoiceClient.getInvoices({
  //   externalId: invoice,
  //   forUserId: XENDIT_ACCOUNT_GARAPIN,
  // });
  // // console.log(invoices);

  // const invoice = await xenditInvoiceClient.getInvoices({
  //   invoiceId: transaction.webhook.id,
  //   forUserId: idXenplatform.account_holder.id,
  // });

  // console.log(invoices);

  transaction.status = callback.status;
  transaction.payment_method = callback.payment_method;
  transaction.payment_date = callback.paid_at;
  transaction.save();

  if (transaction.status == "PAID" || transaction.status == "SETTLED") {
    for (const item of transaction.product.items) {
      const productModelStore = storeDatabase.model("Product", productSchema);
      const product = await productModelStore.findOne({
        _id: item.product,
      });
      product.subtractStock(
        item.quantity,
        targetDatabase,
        "Raku Out" + item.product
      );

      const supDb = product.db_user;
      const supStoreDb = await connectTargetDatabase(supDb);
      const productModelStoresup = supStoreDb.model("Product", productSchema);
      const productOnSupplier = await productModelStoresup.findOne({
        _id: product.inventory_id,
      });

      // console.log(productOnSupplier);

      productOnSupplier.subtractStock(
        item.quantity,
        supDb,
        "Raku Out" + item.referenceId
      );

      // console.log(item.referenceId);
    }
  }
  // transaction.webhook = invoice;

  // return sendResponse(res, 200, "Sukses", {
  //   invoice: invoices[0],
  // });
}

async function callbackRak(targetDatabase, callback) {
  const today = moment().tz("GMT").format();
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  const ConfigAppModel = storeDatabase.model(
    "config_app",
    configAppForPOSSchema
  );

  const configApp = await ConfigAppModel.findOne();

  const RakTransactionModelStore = storeDatabase.model(
    "rakTransaction",
    rakTransactionSchema
  );
  const rakModelStore = storeDatabase.model("rak", rakSchema);
  const RentModelStore = storeDatabase.model("rent", rentSchema);
  const PositionModel = storeDatabase.model("position", positionSchema);

  const rakTransaction = await RakTransactionModelStore.findOne({
    invoice: callback.external_id,
  });

  if (!rakTransaction) {
    false;
  }

  if (rakTransaction.payment_status !== "PENDING") {
    false;
  }

  // xxx;
  if (rakTransaction) {
    for (const element of rakTransaction.list_rak) {
      if (callback.status === "EXPIRED") {
        const position = await PositionModel.findById(element.position);
        if (position.status === STATUS_POSITION.UNPAID) {
          if (position.end_date) {
            position.status = timetools.isIncoming(position, configApp.due_date)
              ? STATUS_POSITION.INCOMING
              : STATUS_POSITION.RENTED;
          } else {
            position.status = STATUS_POSITION.AVAILABLE;
            position.available_date = today;
            position.start_date = null;
            position.end_date = null;
          }
          position.save();
        }
      } else if (callback.status === "PAID") {
        const position = await PositionModel.findById(element.position);

        const available_date = moment(element.end_date)
          .tz(timezones)
          .add(1, "second")
          .toDate();

        if (position.status === STATUS_POSITION.UNPAID) {
          if (timetools.isIncoming(element, configApp.due_date)) {
            position.status = STATUS_POSITION.INCOMING;
          } else {
            position.status = STATUS_POSITION.RENTED;
          }

          position.start_date = element.start_date;
          position.end_date = element.end_date;
          position.available_date = available_date;

          await position.save();
          console.log(position);
        }

        // position["start_date"] = element.start_date;
        // position["end_date"] = element.end_date;
        // position["available_date"] = available_date;
        // position["status"] = STATUS_POSITION.RENTED;

        const rentsss = await RentModelStore.create({
          rak: element.rak,
          position: element.position,
          start_date: element.start_date,
          end_date: element.end_date,
          db_user: rakTransaction.db_user,
        });

        console.log(rentsss);

        await position.save();
      }
    }
  }

  rakTransaction.payment_status = callback.status;
  rakTransaction.payment_method = callback.payment_method;
  rakTransaction.payment_channel = callback.payment_channel;
  rakTransaction.payment_date = callback.paid_at;

  await rakTransaction.save();
}

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

function parseString(input) {
  const parts = input.split("&&");

  if (parts.length !== 3) {
    throw new Error(
      "Input string does not contain exactly three parts separated by '&&'"
    );
  }

  const [invoices, lokasi, source] = parts;
  return { invoices, lokasi, source };
}

// Example usage:
const input = "INV-1726396594276&&mr-fran_puri_e51cf5fa-0b3&&RAKU";
const { invoices, lokasi, source } = parseString(input);

console.log("Invoices:", invoices); // Output: INV-1726396594276
console.log("Lokasi:", lokasi); // Output: mr-fran_puri_e51cf5fa-0b3
console.log("Source:", source); // Output: RAKU

export default {
  invoiceCallback,
};
