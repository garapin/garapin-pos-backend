import mongoose from "mongoose";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { rakTransactionSchema } from "../../models/rakTransactionModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";

const createTransaction = async (req, res) => {
  const { create_by, list_rak } = req?.body;

  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    let total_harga = 0;
    if (list_rak.length > 0) {
      list_rak.forEach((element) => {
        total_harga += element.number_of_days * element.rak_detail.price_perday;
      });
    }

    const rakTransaction = await RakTransactionModelStore.create({
      create_by,
      list_rak,
      total_harga: total_harga,
    });

    return apiResponse(res, 200, "Create rak transaction successfully", {
      rakTransaction,
    });
  } catch (error) {
    console.error("Error getting Create rak transaction:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllTransactionByUser = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TypeModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );

    const user_id = "6640ba57699f69a7df1bf80c";

    var transaksi_detail = await TypeModelStore.aggregate([
      { $match: { create_by: mongoose.Types.ObjectId(user_id) } },
      {
        $lookup: {
          from: "raks",
          localField: "list_rak.rak_id",
          foreignField: "_id",
          as: "rak_detail",
        },
      },
      {
        $lookup: {
          from: "positions",
          localField: "list_rak.position_id",
          foreignField: "_id",
          as: "position_detail",
        },
      },
      {
        $project: {
          user_id: 1,
          start_date: 1,
          end_date: 1,
          total_harga: 1,
          list_barang: 1,
          rak_detail: 1,
          position_detail: 1,
        },
      },
    ]).exec();

    if (!transaksi_detail || transaksi_detail.length === 0) {
      return apiResponse(res, 400, "Transaction not found", {});
    }

    return apiResponse(res, 200, "Get all transaction successfully", {
      transaksi_detail,
    });
  } catch (error) {
    console.error("Error getting Get transaction:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default { createTransaction, getAllTransactionByUser };
