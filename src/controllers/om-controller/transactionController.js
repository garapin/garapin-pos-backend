import mongoose from "mongoose";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import {
  PAYMENT_STATUS_RAK,
  rakTransactionSchema,
} from "../../models/rakTransactionModel.js";
import { rakTypeSchema } from "../../models/rakTypeModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";
import { STATUS_POSITION } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";

const createTransaction = async (req, res, next) => {
  try {
    const { create_by, list_rak } = req?.body;

    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );
    const rakModelStore = storeDatabase.model("rak", rakSchema);

    let total_harga = 0;

    // Use a for loop to handle asynchronous operations sequentially
    for (const element of list_rak) {
      const isRakHavePosition = await rakModelStore.findOne({
        "positions._id": element.position_id,
      });

      if (!isRakHavePosition) {
        throw new Error(
          `The storage position of this item is not found in the ${element.rak_detail.rak_name}`
        );
      }

      const activeTransaction = await RakTransactionModelStore.findOne({
        "list_rak.rak_id": element.rak_id,
        "list_rak.position_id": element.position_id,
        "list_rak.end_date": { $gte: new Date() },
      });

      // Determine position status based on the presence of active transaction
      const status = activeTransaction
        ? STATUS_POSITION.RENTED
        : STATUS_POSITION.AVAILABLE;

      if (status === STATUS_POSITION.RENTED) {
        throw new Error(
          `Rak at position ${element.position_id} is already rented`
        );
      }

      total_harga += element.number_of_days * element.rak_detail.price_perday;
    }

    const rakTransaction = await RakTransactionModelStore.create({
      create_by,
      list_rak,
      total_harga: total_harga,
    });

    // if (rakTransaction) {
    //   for (const element of list_rak) {
    //     const updateRak = await rakModelStore.findOne({
    //       _id: element.rak_id,
    //     });

    //     for (const position of updateRak.positions) {
    //       if (position.id === element.position_id) {
    //         position["status"] = STATUS_POSITION.RENTED;
    //       }
    //     }

    //     await updateRak.save();
    //   }
    // }

    return apiResponse(res, 200, "Create rak transaction successfully", {
      rakTransaction,
    });
  } catch (error) {
    console.error("Error creating rak transaction:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const updateAlreadyPaidDTransaction = async (req, res, next) => {
  try {
    const { transaction_id } = req?.body;

    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const RakTransactionModelStore = storeDatabase.model(
      "rakTransaction",
      rakTransactionSchema
    );
    const rakModelStore = storeDatabase.model("rak", rakSchema);

    const rakTransaction = await RakTransactionModelStore.findById({
      _id: transaction_id,
    });

    if (!rakTransaction) {
      throw new Error(`Transaction not found`);
    }

    if (rakTransaction) {
      for (const element of rakTransaction.list_rak) {
        const updateRak = await rakModelStore.findById(element.rak_id);
        console.log({ element, updateRak: updateRak.positions });
        for (const position of updateRak.positions) {
          if (position._id.toString() === element.position_id.toString()) {
            position["status"] = STATUS_POSITION.RENTED;
            position["start_date"] = element.start_date;
            position["end_date"] = element.end_date;
          }
        }
        // console.log({ element, updateRak: updateRak.positions });
        await updateRak.save();
      }
    }

    rakTransaction.payment_status = PAYMENT_STATUS_RAK.PAID;

    await rakTransaction.save();

    return apiResponse(res, 200, "Create rak transaction successfully", {
      rakTransaction,
    });
  } catch (error) {
    console.error("Error creating rak transaction:", error);
    return apiResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

const getAllTransactionByUser = async (req, res) => {
  const params = req?.query;
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

    if (!params?.user_id) {
      throw new Error(`Please provided user id`);
    }

    const user_id = params?.user_id;

    var transaksi_detail = await TypeModelStore.find({
      create_by: user_id,
    }).sort({ createdAt: -1 });

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

export default {
  createTransaction,
  getAllTransactionByUser,
  updateAlreadyPaidDTransaction,
};
