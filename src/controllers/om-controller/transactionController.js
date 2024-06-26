import mongoose from "mongoose";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import {
  PAYMENT_STATUS_RAK,
  rakTransactionSchema,
} from "../../models/rakTransactionModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { apiResponse, sendResponse } from "../../utils/apiResponseFormat.js";
import { STATUS_POSITION, positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { Xendit, Invoice as InvoiceClient } from "xendit-node";
import { StoreModel } from "../../models/storeModel.js";
import { convertToISODateString } from "../../utils/convertToISODateString.js";
import { categorySchema } from "../../models/categoryModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { object } from "zod";
import moment from "moment";
import { getNumberOfDays } from "../../utils/getNumberOfDays.js";
import { cartRakSchema } from "../../models/cartRakModel.js";

// const xenditClient = new Xendit({ secretKey: process.env.XENDIT_API_KEY });

const xenditInvoiceClient = new InvoiceClient({
  secretKey: process.env.XENDIT_API_KEY_DEV,
});

const createTransaction = async (req, res, next) => {
  const { db_user, list_rak, payer_email, payer_name } = req?.body;

  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const PositionModel = storeDatabase.model("position", positionSchema);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const CartRakModel = storeDatabase.model("CartRak", cartRakSchema);

    let total_harga = 0;

    const cart = await CartRakModel.findOne({
      db_user,
    });

    if (!cart) {
      return sendResponse(
        res,
        400,
        "Cart Not found, please add the item first to the cart"
      );
    }

    const items = [];
    // Use a for loop to handle asynchronous operations sequentially
    for (const element of list_rak) {
      const rak = await rakModelStore
        .findOne({
          _id: element.rak,
          // "positions._id": element.position_id,
        })
        .populate("category");

      if (!rak) {
        return sendResponse(res, 400, `Rak not found `, null);
      }

      const position = await PositionModel.findOne({
        _id: element.position,
        rak_id: element.rak,
      });

      if (!position) {
        return sendResponse(res, 400, `Position not found `, null);
      }

      const isRent = position.status === STATUS_POSITION.RENTED;
      const isunpaid = position.status === STATUS_POSITION.UNPAID;

      if (isRent || isunpaid) {
        return sendResponse(
          res,
          400,
          `Rak at position ${position.name_position} is already rented / unpaid`,
          null
        );
      }

      // const number_of_days = await getNumberOfDays(
      //   element.start_date,
      //   element.end_date
      // );
      const end_date = new Date(position.available_date);
      end_date.setDate(end_date.getDate() + element.total_date);

      element.start_date = position.available_date;
      element.end_date = end_date;

      const number_of_days = element.total_date;

      const price = rak.price_perday * number_of_days;
      console.log({ price, number_of_days });
      items.push({
        name: position.name_position,
        quantity: 1,
        price: price,
        category: rak.category.category,
      });

      total_harga += price;

      const filtered_list_rak = cart.list_rak.filter(
        (item) =>
          item.rak !== element.rak.toString() &&
          item.position.toString() !== element.position.toString()
      );

      await CartRakModel.findByIdAndUpdate(
        {
          _id: cart.id,
        },
        { list_rak: filtered_list_rak }
      );
    }

    const idXenplatform = await getForUserId(targetDatabase);
    if (!idXenplatform) {
      return sendResponse(res, 400, "for-user-id kosong");
    }

    // console.log({ idXenplatform });
    const timestamp = new Date().getTime();
    const generateInvoice = `INV-${timestamp}`;

    const customer = {
      email: payer_email,
      givenNames: payer_name,
    };

    const data = {
      payerEmail: payer_email,
      amount: total_harga,
      invoiceDuration: 1200,
      invoiceLabel: generateInvoice,
      externalId: `${generateInvoice}&&${targetDatabase}&&RAKU`,
      description: `Membuat invoice ${generateInvoice}`,
      currency: "IDR",
      reminderTime: 1,
      items: items,
      customer,
      successRedirectUrl: "https://garapin.cloud/success",
      failureRedirectUrl: "https://garapin.cloud/failure",
    };

    const invoice = await xenditInvoiceClient.createInvoice({
      data,
      forUserId: idXenplatform.account_holder.id,
    });

    const rakTransaction = await RakTransactionModelStore.create({
      db_user,
      list_rak,
      total_harga: total_harga,
      invoice: invoice.externalId,
      payment_status: invoice.status,
      xendit_info: {
        invoiceUrl: invoice.invoiceUrl,
        expiryDate: convertToISODateString(invoice.expiryDate),
      },
    });

    if (rakTransaction) {
      for (const element of rakTransaction.list_rak) {
        const position = await PositionModel.findById(element.position);

        position["status"] = STATUS_POSITION.UNPAID;

        // position["start_date"] = element.start_date;
        // position["end_date"] = element.end_date;

        await position.save();
      }
    }

    return sendResponse(
      res,
      200,
      "Create rak transaction successfully",
      rakTransaction
    );
  } catch (error) {
    console.error("Error creating rak transaction:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  } finally {
    storeDatabase.close();
  }
};

const updateAlreadyPaidDTransaction = async (req, res, next) => {
  const { transaction_id } = req?.body;

  const targetDatabase = req.get("target-database");

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
    const PositionModel = storeDatabase.model("position", positionSchema);
    const RentModelStore = storeDatabase.model("rent", rentSchema);

    const rakTransaction = await RakTransactionModelStore.findById({
      _id: transaction_id,
    });

    if (!rakTransaction) {
      return sendResponse(res, 404, "Transaction not found");
    }

    if (rakTransaction) {
      for (const element of rakTransaction.list_rak) {
        const position = await PositionModel.findById(element.position_id);

        position["status"] = STATUS_POSITION.RENTED;
        position["start_date"] = element.start_date;
        position["end_date"] = element.end_date;
        // console.log({ element, updateRak: updateRak.positions });
        await RentModelStore.create({
          rak_id: element.rak_id,
          position_id: element.position_id,
          start_date: element.start_date,
          end_date: element.end_date,
          db_user: rakTransaction.db_user,
        });

        await position.save();
      }
    }

    rakTransaction.payment_status = PAYMENT_STATUS_RAK.PAID;

    await rakTransaction.save();

    return sendResponse(res, 200, "Transaction already paid", rakTransaction);
  } catch (error) {
    console.error("Error creating rak transaction:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  } finally {
    storeDatabase.close();
  }
};

const getAllTransactionByUser = async (req, res) => {
  const params = req?.query;
  const targetDatabase = req.get("target-database");

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  try {
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const PositionModel = storeDatabase.model("position", positionSchema);

    if (!params?.db_user) {
      throw new Error(`Please provided user id`);
    }

    const db_user = params?.db_user;

    var transaksi_detail = await RakTransactionModelStore.find({
      db_user: db_user,
    })
      .populate("list_rak.rak")
      .populate("list_rak.position")
      .sort({ createdAt: -1 });

    if (!transaksi_detail || transaksi_detail.length === 0) {
      return sendResponse(res, 400, "Transaction not found", null);
    }

    return sendResponse(
      res,
      200,
      "Get all transaction successfully",
      transaksi_detail
    );
  } catch (error) {
    console.error("Error getting Get transaction:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  } finally {
    storeDatabase.close();
  }
};

const getForUserId = async (db) => {
  const database = await connectTargetDatabase(db);
  const storeModel = await database.model("Store", StoreModel.schema).findOne();
  if (!storeModel) {
    return null;
  }
  return storeModel;
};

export default {
  createTransaction,
  getAllTransactionByUser,
  updateAlreadyPaidDTransaction,
};
