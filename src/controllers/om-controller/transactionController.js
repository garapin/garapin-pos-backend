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

// const xenditClient = new Xendit({ secretKey: process.env.XENDIT_API_KEY });

const xenditInvoiceClient = new InvoiceClient({
  secretKey: process.env.XENDIT_API_KEY,
});

const createTransaction = async (req, res, next) => {
  try {
    const { create_by, list_rak, payer_email } = req?.body;

    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const CategoryModel = storeDatabase.model("Category", categorySchema);
    const PositionModel = storeDatabase.model("position", positionSchema);

    let total_harga = 0;

    const items = [];
    // Use a for loop to handle asynchronous operations sequentially
    for (const element of list_rak) {
      const rak = await rakModelStore
        .findOne({
          _id: element.rak_id,
          // "positions._id": element.position_id,
        })
        .populate("category");

      if (!rak) {
        return sendResponse(res, 400, `Rak not found `, null);
      }

      const position = await PositionModel.findOne({
        _id: element.position_id,
        rak_id: element.rak_id,
      });

      console.log({ position });

      if (!position) {
        return sendResponse(res, 400, `Position not found `, null);
      }

      const isRent = position.status === STATUS_POSITION.RENTED;

      if (isRent) {
        return sendResponse(
          res,
          400,
          `Rak at position ${position.name_position} is already rented`,
          null
        );
      }

      const number_of_days = await getNumberOfDays(
        element.start_date,
        element.end_date
      );

      const price = rak.price_perday * number_of_days;
      console.log({ price, number_of_days });
      items.push({
        name: position.name_position,
        quantity: 1,
        price: price,
        category: rak.category.category,
      });

      total_harga += price;
    }

    const idXenplatform = await getForUserId(targetDatabase);
    if (!idXenplatform) {
      return sendResponse(res, 400, "for-user-id kosong");
    }

    // console.log({ idXenplatform });
    const timestamp = new Date().getTime();
    const generateInvoice = `INV-${timestamp}`;
    const data = {
      payerEmail: payer_email,
      amount: total_harga,
      invoiceDuration: 172800,
      invoiceLabel: generateInvoice,
      externalId: `${generateInvoice}&&${targetDatabase}&&RAKU`,
      description: `Membuat invoice ${generateInvoice}`,
      currency: "IDR",
      reminderTime: 1,
      items: items,
      customer: {
        given_names: idXenplatform.pic_name,
        surname: idXenplatform.store_name,
      },
    };

    const invoice = await xenditInvoiceClient.createInvoice({
      data,
      forUserId: idXenplatform.account_holder.id,
    });

    const rakTransaction = await RakTransactionModelStore.create({
      create_by,
      list_rak,
      total_harga: total_harga,
      invoice: invoice.externalId,
      payment_status: invoice.status,
      xendit_info: {
        invoiceUrl: invoice.invoiceUrl,
        expiryDate: convertToISODateString(invoice.expiryDate),
      },
    });

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
  }
};

const updateAlreadyPaidDTransaction = async (req, res, next) => {
  try {
    const { transaction_id } = req?.body;

    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", {});
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );
    const rakModelStore = storeDatabase.model("rak", rakSchema);
    const RentModelStore = storeDatabase.model("rent", rentSchema);
    const PositionModel = storeDatabase.model("position", positionSchema);

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
          create_by: rakTransaction.create_by,
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
  }
};

const getAllTransactionByUser = async (req, res) => {
  const params = req?.query;
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return sendResponse(res, 400, "Target database is not specified", null);
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TypeModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    if (!params?.user_id) {
      throw new Error(`Please provided user id`);
    }

    const user_id = params?.user_id;

    var transaksi_detail = await TypeModelStore.find({
      create_by: user_id,
    }).sort({ createdAt: -1 });

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

async function sewaRak(userId, rakId, positionId) {
  try {
    // Ambil rak yang ingin disewa
    const rak = await RakModel.findById(rakId);

    // Ambil posisi yang ingin disewa
    const position = await PositionModel.findById(positionId);

    // Periksa apakah rak dan posisi tersedia
    if (!rak || !position) {
      throw new Error("Rak atau posisi tidak ditemukan");
    }

    // Periksa apakah posisi tersedia untuk disewa
    if (position.status !== STATUS_POSITION.AVAILABLE) {
      throw new Error("Posisi sudah disewa");
    }

    // Simpan informasi sewa di posisi
    position.status = STATUS_POSITION.RENTED;
    position.start_date = new Date();
    // Anda dapat menambahkan end_date sesuai kebutuhan

    await position.save();

    // Anda bisa memilih salah satu dari dua opsi berikut:
    // 1. Menyimpan referensi posisi yang disewa di rak
    rak.positions.push(positionId);
    await rak.save();

    // 2. Atau cukup memperbarui status rak menjadi "RENTED"
    // rak.status = "RENTED";
    // await rak.save();

    // Di sini Anda juga bisa melakukan pembayaran dan langkah-langkah lain yang diperlukan

    return "Rak berhasil disewa";
  } catch (error) {
    throw error;
  }
}

export default {
  createTransaction,
  getAllTransactionByUser,
  updateAlreadyPaidDTransaction,
};
