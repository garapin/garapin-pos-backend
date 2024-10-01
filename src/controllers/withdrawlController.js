import axios from "axios";
import { apiResponseList, apiResponse } from "../utils/apiResponseFormat.js";
import { StoreModel, storeSchema } from "../models/storeModel.js";
import { WithdrawModel, withdrawSchema } from "../models/withdrawModel.js";
import {
  ConfigWithdrawModel,
  configWithdrawSchema,
} from "../models/configWithdraw.js";
import { connectTargetDatabase } from "../config/targetDatabase.js";
import { hashPin, verifyPin } from "../utils/hashPin.js";
import getForUserId from "../utils/getForUserIdXenplatform.js";
const MONGODB_URI = process.env.MONGODB_URI;
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
import {
  PaymentMethodModel,
  paymentMethodScheme,
} from "../models/paymentMethodModel.js";
import { transactionSchema } from "../models/transactionModel.js";
import { splitPaymentRuleIdScheme } from "../models/splitPaymentRuleIdModel.js";
import { configTransactionSchema } from "../models/configTransaction.js";
const shippingInfo = [
  {
    destinasi: "BCA",
    nominal: "Semua",
    waktuWithdrawal: "05:00 - 21:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "BCA",
    nominal: "Semua",
    waktuWithdrawal: "22:00 - 04:59",
    estimasiWaktu: "Setelah 05:00",
  },
  {
    destinasi: "Mandiri",
    nominal: "Semua",
    waktuWithdrawal: "04:00 - 22:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "Mandiri",
    nominal: "Semua",
    waktuWithdrawal: "23:00 - 03:59",
    estimasiWaktu: "Setelah 04:00",
  },
  {
    destinasi: "BRI",
    nominal: "Semua",
    waktuWithdrawal: "04:00 - 23:44",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "BRI",
    nominal: "Semua",
    waktuWithdrawal: "23:45 - 03:59",
    estimasiWaktu: "Setelah 04:00",
  },
  {
    destinasi: "BNI",
    nominal: "Semua",
    waktuWithdrawal: "03:00 - 22:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "BNI",
    nominal: "Semua",
    waktuWithdrawal: "23:00 - 02:59",
    estimasiWaktu: "Setelah 03:00",
  },
  {
    destinasi: "Sahabat Sampoerna",
    nominal: "<1,000,000,000",
    waktuWithdrawal: "03:00 - 22:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "Sahabat Sampoerna",
    nominal: "<1,000,000,000",
    waktuWithdrawal: "23:00 - 02:59",
    estimasiWaktu: "Setelah 03:00",
  },
  {
    destinasi: "Permata",
    nominal: "Semua",
    waktuWithdrawal: "01:00 - 22:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "Permata",
    nominal: "Semua",
    waktuWithdrawal: "23:00 - 00:59",
    estimasiWaktu: "Setelah 01:00",
  },
  {
    destinasi: "CIMB",
    nominal: ">100,000,000",
    waktuWithdrawal: "09:00 - 20:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "CIMB",
    nominal: ">100,000,000",
    waktuWithdrawal: "21:00 - 08:59",
    estimasiWaktu: "Setelah 09:00",
  },
  {
    destinasi: "SINARMAS",
    nominal: ">100,000,000",
    waktuWithdrawal: "09:00 - 13:59",
    estimasiWaktu: "2 jam",
  },
  {
    destinasi: "SINARMAS",
    nominal: ">100,000,000",
    waktuWithdrawal: "14:00 - 08:59",
    estimasiWaktu: "Setelah 09:00",
  },
  {
    destinasi: "CIMB, Sinarmas",
    nominal: "≥10,000 or ≤100,000,000",
    waktuWithdrawal: "05:00 - 22:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "CIMB, Sinarmas",
    nominal: "≥10,000 or ≤100,000,000",
    waktuWithdrawal: "23:00 - 04:59",
    estimasiWaktu: "Setelah 05:00",
  },
  {
    destinasi: "Bank Lainnya dan ewallet",
    nominal: "≤100,000,000",
    waktuWithdrawal: "05:00 - 22:59",
    estimasiWaktu: "15 menit",
  },
  {
    destinasi: "Bank Lainnya dan ewallet",
    nominal: "≤100,000,000",
    waktuWithdrawal: "23:00 - 04:59",
    estimasiWaktu: "Setelah 05:00",
  },
];

const getListNotSettledTransaction = async (req, res) => {
  try {
    const trxDatabase = req.get("trx-database");
    const businessDatabase = req.get("business-database");
    const targetDatabase = req.get("target-database");

    const database = await connectTargetDatabase(trxDatabase);
    const bpDatabase = await connectTargetDatabase(businessDatabase);
    const garapinPosDatabase = await connectTargetDatabase("garapin_pos");

    const listData = [];
    const TransactionData = database.model("Transaction", transactionSchema);
    const listTransactionNotSettled = await TransactionData.find({
      settlement_status: "NOT_SETTLED",
    });

    /// GET SPLIT TRANSACTION FROM SPLIT TRANSACTION MODEL
    const SplitTransactionData = bpDatabase.model(
      "Split_Payment_Rule_Id",
      splitPaymentRuleIdScheme
    );
    const listSplitTransaction = await SplitTransactionData.find({
      invoice: {
        $in: listTransactionNotSettled.map(
          (transaction) => transaction.invoice
        ),
      },
    });

    // GET QUICK RELEASE PERCENT FROM CONFIG WITHDRAWS
    const ConfigWithdraw = garapinPosDatabase.model(
      "config_withdraw",
      configWithdrawSchema
    );
    const configWithdraw = await ConfigWithdraw.findOne({ type: "BANK" });
    const quickReleasePercent = configWithdraw.quick_release_percent;

    // GET BANK FEES FROM CONFIG TRANSACTION
    const ConfigTransaction = garapinPosDatabase.model(
      "config_transaction",
      configTransactionSchema
    );
    const configTransactionList = await ConfigTransaction.find({});

    listTransactionNotSettled.forEach((transaction) => {
      const splitTransaction = listSplitTransaction.find(
        (split) => split.invoice === transaction.invoice
      );

      const flat_amount = splitTransaction
        ? splitTransaction.routes.find(
            (route) => route.reference_id === targetDatabase
          )?.flat_amount
        : null;

      const totalFee = splitTransaction
        ? splitTransaction.routes.find(
            (route) => route.reference_id === targetDatabase
          )?.totalFee
        : null;

      const quickReleaseFee =
        transaction.total_with_fee * (quickReleasePercent / 100);

      // Kalkulasi biaya bank berdasarkan jenis pembayaran
      let vaFee = 0;
      let qrFee = 0;
      let vaVat = 0;
      let qrVat = 0;
      const vaConfig = configTransactionList.find(
        (config) => config.type === "VA"
      );
      const qrConfig = configTransactionList.find(
        (config) => config.type === "QRIS"
      );
      if (vaConfig) {
        vaFee = vaConfig.fee_flat;
        vaVat = vaFee * (vaConfig.vat_percent / 100);
      }
      if (qrConfig) {
        qrFee = transaction.total_with_fee * (qrConfig.fee_percent / 100);
        qrVat = qrFee * (qrConfig.vat_percent / 100);
      }

      const nettAfterShare = flat_amount - totalFee;
      const readyToProcess = nettAfterShare > quickReleaseFee;

      const data = {
        ready_to_process: readyToProcess,
        settlement_status: transaction.settlement_status,
        transaction: {
          invoice: transaction.invoice,
          invoice_label: transaction.invoice_label,
          amount: transaction.amount,
          total_transaction: transaction.total_with_fee,
        },
        routes: {
          flat_amount: flat_amount,
          nett_after_share: nettAfterShare,
        },
        quick_release_info: {
          quick_release_fee: quickReleaseFee,
          quick_release_percent: quickReleasePercent,
        },
        bank_fee: {
          va: {
            fee: vaFee,
            vat: vaVat
          },
          qr: {
            fee: qrFee,
            vat: qrVat
          }
        }
      };

      listData.push(data);
    });

    return apiResponse(res, 200, "Sukses", listData);
  } catch (error) {
    console.log(error);
    return apiResponse(res, 400, "error");
  }
};
const getBalance = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model("Store", storeSchema).findOne();
    const endpoint = "https://api.xendit.co/balance";
    // console.log(storeModel.account_holder.id);
    const headers = {
      Authorization: `Basic ${Buffer.from(XENDIT_API_KEY + ":").toString("base64")}`,
      "for-user-id": storeModel.account_holder.id,
    };
    const response = await axios.get(endpoint, { headers });
    const responseData = {
      balance: response.data.balance,
      bank: storeModel.bank_account,
    };
    return apiResponse(res, 200, "Sukses ambil balance", responseData);
  } catch (error) {
    return apiResponse(res, 400, "error");
  }
};

const verifyPinWIthdrawl = async (req, res) => {
  try {
    const { pin } = req.body;
    const targetDatabase = req.get("target-database");
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model("Store", storeSchema).findOne();
    const isPinValid = verifyPin(pin, storeModel.bank_account.pin);
    if (isPinValid) {
      return apiResponse(res, 200, "pin match");
    } else {
      return apiResponse(res, 400, "missmatch");
    }
  } catch (error) {
    return apiResponse(res, 400, "terjadi kesalahan");
  }
};

const withdrawl = async (req, res) => {
  try {
    const timestamp = new Date().getTime();
    const generateDisb = `DISB-${timestamp}`;
    const targetDatabase = req.get("target-database");
    const database = await connectTargetDatabase(targetDatabase);
    const storeModel = await database.model("Store", storeSchema).findOne();
    const amount = await amountWithReducedfee(req.body.amount);
    if (amount === null) {
      return apiResponse(res, 400, "terjadi kesalahan");
    }
    // console.log("ini amount");
    // console.log(amount);
    const dataPayout = {
      reference_id: `${generateDisb}&&${targetDatabase}&&POS`,
      channel_code: req.body.channel_code,
      channel_properties: {
        account_holder_name: storeModel.bank_account.holder_name,
        account_number: storeModel.bank_account.account_number.toString(),
      },
      amount: amount,
      description: req.body.berita,
      currency: "IDR",
      receipt_notification: {
        email_to: [storeModel.account_holder.email],
        email_cc: [],
      },
    };
    //    const data = {
    //         'external_id': `${generateDisb}&&${targetDatabase}&&POS`,
    //         'amount': req.body.amount,
    //         'bank_code':  storeModel.bank_account.bank_name,
    //         'account_holder_name': storeModel.bank_account.holder_name,
    //         'account_number': storeModel.bank_account.account_number.toString(),
    //         'description':'Withdraw from BagiBagiPos',
    //         'email_to':[storeModel.account_holder.email]
    //      };

    const endpoint = "https://api.xendit.co/v2/payouts";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(XENDIT_API_KEY + ":").toString("base64")}`,
      "for-user-id": storeModel.account_holder.id,
      "Idempotency-key": `${generateDisb}&&${targetDatabase}&&POS`,
    };
    const response = await axios.post(endpoint, dataPayout, { headers });
    // console.log(response.status);
    console.log(response.data);
    if (response.status === 200) {
      const withdrawData = database.model("Withdraw", withdrawSchema);
      const addWithdraw = new withdrawData(response.data);
      addWithdraw.fee_bank = req.body.amount - amount;
      const save = await addWithdraw.save();
      return apiResponse(res, 200, "Sukses", response.data);
    } else {
      return apiResponse(res, 400, "error", response);
    }
  } catch (error) {
    return apiResponse(res, 400, "error", error);
  }
};

const withdrawCheckAmount = async (req, res) => {
  try {
    const { amount } = req.body;
    const data = await ConfigWithdrawModel.findOne({ type: "BANK" });
    // console.log(data);
    const vat = (data.fee * data.vat_percent) / 100;
    const totalFee = data.fee + vat;
    // console.log(totalFee);
    const count = amount - totalFee;
    return apiResponse(res, 200, "ok", {
      amount: amount,
      total_fee: totalFee,
      amount_to_bank: count,
    });
  } catch (error) {
    return apiResponse(res, 200, "ok", error);
  }
};

const amountWithReducedfee = async (amount) => {
  try {
    const data = await ConfigWithdrawModel.findOne({ type: "BANK" });
    // console.log(data);
    const vat = (data.fee * data.vat_percent) / 100;
    const totalFee = data.fee + vat;
    // console.log(totalFee);
    const count = amount - totalFee;
    return count;
  } catch (error) {
    return null;
  }
};

const webhookWithdraw = async (req, res) => {
  try {
    const eventData = req.body;
    const { headers } = req;
    // console.log("body:", eventData);
    // console.log("header:", headers);
    const str = eventData.data.reference_id;
    const parts = str.split("&&");
    const invoice = parts[0];
    const targetDatabase = parts[1];
    const POS = parts[2];
    const withDrawDatabase = await connectTargetDatabase(targetDatabase);
    const Withdraw = withDrawDatabase.model("Withdraw", withdrawSchema);
    // console.log(eventData.status);
    let eventStatus;
    if (eventData.event === "payout.succeeded") {
      eventStatus = "SUCCEEDED";
    } else if (eventData.event === "payout.failed") {
      eventStatus = "FAILED";
    } else if (eventData.event === "payout.expired") {
      eventStatus = "EXPIRED";
    } else if (eventData.event === "payout.refunded") {
      eventStatus = "REFUNDED";
    }
    const updateResult = await Withdraw.findOneAndUpdate(
      { reference_id: eventData.data.reference_id },
      { $set: { status: eventStatus, webhook: eventData } },
      { new: true }
    );
    res.status(200).end();
  } catch (error) {
    console.error("Error handling Xendit webhook:", error);
    res.status(500).end();
  }
};
const getWithdrawHistory = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const db = await connectTargetDatabase(targetDatabase);
    const Withdraw = db.model("Withdraw", withdrawSchema);
    // const bankAvailable = await PaymentMethodModel.findOne();
    // console.log(bankAvailable);

    // const page = parseInt(req.query.page, 10) || 1;
    // const limit = 10;
    // const skip = (page - 1) * limit;

    // Mendapatkan parameter query untuk rentang tanggal
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    // Membuat filter rentang tanggal
    let dateFilter = {};
    if (startDate && endDate) {
      const adjustedEndDate = new Date(endDate);
      adjustedEndDate.setHours(23, 59, 59, 999);
      dateFilter.$and = [
        {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(adjustedEndDate),
          },
        },
      ];
    }

    // const data = await ConfigWithdrawModel.findOne({ type: "BANK" });
    // // console.log(data);
    // const vat = (data.fee * data.vat_percent) / 100;
    // const totalFee = data.fee + vat;
    // // console.log(totalFee);
    // const count = amount - totalFee;

    const response = await Withdraw.find(dateFilter)
      .sort({ createdAt: -1 })
      .lean();

    const bankAvailable = await PaymentMethodModel.findOne().lean();
    response.forEach((withdraw) => {
      if (withdraw.channel_code) {
        // Tambahkan payment_method ke objek withdraw
        withdraw.payment_method = bankAvailable.available_bank.find(
          (bank) => bank.code === withdraw.channel_code
        )["bank"];
      } else {
        // Jika tidak ada kecocokan, tambahkan default value
        withdraw.payment_method = {
          name: "Unknown Bank",
          logo: "assets/payment-logo/default.png",
        };
      }
    });

    console.log("====================================");
    console.log(response);
    console.log("====================================");
    return apiResponseList(
      res,
      200,
      "Sukses",
      response
      //   totalData,
      //    limit, page
    );
  } catch (err) {
    return apiResponseList(res, 500, "Error", { error: err.message });
  }
};

const getShippingInfo = async (req, res) => {
  try {
    return apiResponse(
      res,
      200,
      "Informasi pengiriman berhasil diambil",
      shippingInfo
    );
  } catch (error) {
    // console.log(error);
    return apiResponse(res, 500, "Kesalahan server internal", error.message);
  }
};

export default {
  getBalance,
  verifyPinWIthdrawl,
  withdrawl,
  getWithdrawHistory,
  webhookWithdraw,
  withdrawCheckAmount,
  getShippingInfo,
  getListNotSettledTransaction,
};
