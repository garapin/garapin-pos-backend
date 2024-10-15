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
    const targetDatabase = req.get("target-database");

    const {
      filter,
      startDate,
      endDate,
    } = req.query;

    const database = await connectTargetDatabase(trxDatabase);
    const garapinPosDatabase = await connectTargetDatabase("garapin_pos");

    if (!startDate || !endDate) {
      return apiResponse(res, 400, "startDate dan endDate diperlukan");
    }

    // Konversi tanggal ke format ISO 8601
    const startISO = new Date(startDate);
    const endISO = new Date(endDate);

    if (isNaN(startISO.getTime()) || isNaN(endISO.getTime())) {
      return apiResponse(res, 400, "Format tanggal tidak valid");
    }

    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalNetSales = 0;
    let totalFeePos = 0;
    let totalFeeBank = 0;
    let totalNetAfterShare = 0;

    const TransactionData = database.model("Transaction", transactionSchema);
    const listTransactionNotSettled = await TransactionData.find({
      createdAt: { $gte: startISO, $lte: endISO },
      $and: [
        { status: "SUCCEEDED" },
        {
          $or: [
            { settlement_status: "NOT_SETTLED" },
            { settlement_status: "PROCESS_SETTLE_BY_QUICK_RELEASE" }
          ]
        }
      ]
    });

    /// GET SPLIT TRANSACTION FROM SPLIT TRANSACTION MODEL
    const SplitTransactionData = database.model(
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

    const calculateTotalDiscount = (items) => {
      if (!Array.isArray(items)) {
        return 0; // Kembalikan 0 jika items bukan array
      }
      return items.reduce((total, item) => {
        const discount =
          item.product && item.product.discount ? item.product.discount : 0;
        const quantity = item.quantity || 1;
        return total + discount * quantity;
      }, 0);
    };

    const listData = listTransactionNotSettled.map((transaction) => {
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

      const feePos = splitTransaction
        ? splitTransaction.routes.find(
          (route) => route.reference_id === 'garapin_pos'
        )?.flat_amount
        : null;

      const quickReleaseFee =
        transaction.total_with_fee * (quickReleasePercent / 100);

      const nettAfterShare = flat_amount - totalFee;
      const readyToProcess = transaction.settlement_status === "PROCESS_SETTLE_BY_QUICK_RELEASE" ? false : nettAfterShare > quickReleaseFee;
      const status_process = transaction.settlement_status === "PROCESS_SETTLE_BY_QUICK_RELEASE" ? "waiting_to_process" : nettAfterShare < quickReleaseFee ? "cannot_process" : "ready_to_process";

      const discount =
        transaction.product && transaction.product.items
          ? calculateTotalDiscount(transaction.product.items)
          : 0;
      const grossSales =
        transaction.total_with_fee + discount;
      const netSales = grossSales - discount - feePos;

      return {
        id: transaction._id,
        ready_to_process: readyToProcess,
        status_process: status_process,
        transaction: {
          original_payment_date: transaction.payment_date,
          transaction_date: new Date(transaction.payment_date).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          }).split('/').join('/'),
          settlement_status: transaction.settlement_status,
          invoice: transaction.invoice,
          invoice_label: transaction.invoice_label,
          amount: transaction.amount,
          discount: discount,
          gross_sales: grossSales,
          net_sales: netSales,
          fee_pos: feePos,
          total_transaction: transaction.total_with_fee,
          fee_bank: transaction.fee_bank,
          vat: transaction.vat,
        },
        routes: {
          flat_amount: flat_amount,
          nett_after_share: nettAfterShare,
        },
        quick_release_info: {
          quick_release_fee: quickReleaseFee,
          quick_release_percent: quickReleasePercent,
        },
        total_income: transaction.total_with_fee - quickReleaseFee,
      };
    });

    // Urutkan listData berdasarkan original_payment_date
    listData.sort((a, b) => new Date(b.original_payment_date) - new Date(a.original_payment_date));

    // Hapus original_payment_date dari setiap item setelah pengurutan
    listData.forEach(item => delete item.original_payment_date);

    totalGrossSales = listData.reduce((sum, item) => sum + item.transaction.gross_sales, 0);
    totalDiscount = listData.reduce((sum, item) => sum + item.transaction.discount, 0);
    totalNetSales = listData.reduce((sum, item) => sum + item.transaction.net_sales, 0);
    totalFeePos = listData.reduce((sum, item) => sum + item.transaction.fee_pos, 0);
    totalFeeBank = listData.reduce((sum, item) => sum + (item.transaction.fee_bank || 0) + (item.transaction.vat || 0), 0);
    totalNetAfterShare = listData.reduce((sum, item) => sum + item.routes.flat_amount, 0);


    return apiResponse(res, 200, "Sukses", {
      transactions: listData,
      totalGrossSales: totalGrossSales,
      totalDiscount: totalDiscount,
      totalNetSales: totalNetSales,
      totalFeePos: totalFeePos,
      totalFeeBank: totalFeeBank,
      totalNetAfterShare: totalNetAfterShare,
      totalTransaction: listData.length,
    });
  } catch (error) {
    console.log(error);
    return apiResponse(res, 400, "error");
  }
};

const processWithdrwalQuickRelease = async (req, res) => {
  try {
    const trxDatabase = req.get("trx-database");
    const targetDatabase = req.get("target-database");

    const { data: transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return apiResponse(res, 400, "Data transaksi tidak valid atau kosong");
    }

    const trxDb = await connectTargetDatabase(trxDatabase);
    const targetDb = await connectTargetDatabase(targetDatabase);

    const TransactionData = trxDb.model("Transaction", transactionSchema);
    const SplitTransactionData = trxDb.model("Split_Payment_Rule_Id", splitPaymentRuleIdScheme);
    const TargetTransactionData = targetDb.model("Transaction", transactionSchema);
    const TargetSplitTransactionData = targetDb.model("Split_Payment_Rule_Id", splitPaymentRuleIdScheme);

    const results = [];

    for (const transaction of transactions) {
      const { invoice, nettAfterShare, totalTransaction, feeBank, vatBank, quickReleaseFee } = transaction;

      const timestamp = new Date().getTime();
      const generateInvoice = `INV-${timestamp}`;

      // Temukan transaksi asli
      const originalTransaction = await TransactionData.findOne({ invoice: invoice, settlement_status: "NOT_SETTLED" });

      if (!originalTransaction) {
        results.push({ invoice, status: "error", message: "Transaksi tidak ditemukan" });
        continue;
      }

      // Perbarui status transaksi asli
      originalTransaction.settlement_status = "PROCESS_SETTLE_BY_QUICK_RELEASE";
      await originalTransaction.save();

      // Buat transaksi baru dengan invoice baru
      const newInvoice = `${generateInvoice}&&${targetDatabase}&&POS&&QUICK_RELEASE_WITHDRAWL`;
      const newTransaction = new TargetTransactionData({
        ...originalTransaction.toObject(),
        _id: undefined,
        invoice: newInvoice,
        parent_invoice: invoice,
        settlement_status: "PENDING_WITHDRAWL",
        payment_method: "",
        status: "PENDING",
        total_with_fee: totalTransaction,
        fee_bank: 0,
        vat: 0,
        quick_release_fee: quickReleaseFee,
      });

      const savedNewTransaction = await newTransaction.save();

      // Temukan data split pembayaran asli
      const originalSplitTransaction = await SplitTransactionData.findOne({ invoice: invoice });

      if (!originalSplitTransaction) {
        results.push({ invoice, status: "error", message: "Data split pembayaran tidak ditemukan" });
        continue;
      }

      // Buat data split pembayaran baru
      const newSplitTransaction = new TargetSplitTransactionData({
        ...originalSplitTransaction.toObject(),
        _id: undefined,
        invoice: newInvoice,
        routes: originalSplitTransaction.routes.map(route =>
          route.reference_id === targetDatabase
            ? { ...route, flat_amount: nettAfterShare }
            : route
        )
      });

      await newSplitTransaction.save();

      results.push({ invoice: newInvoice, status: "success", message: "Quick release invoice berhasil dibuat" });
    }

    return apiResponse(res, 200, "Proses quick release selesai", { results });
  } catch (error) {
    console.error(error);
    return apiResponse(res, 400, "Terjadi kesalahan saat membuat quick release invoice");
  }
}

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

    console.log(startDate);
    console.log(endDate);

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

    console.log(dateFilter);

    const response = await Withdraw.find(dateFilter)
      .sort({ createdAt: -1 })
      .lean();

    const bankAvailable = await PaymentMethodModel.findOne().lean();
    response.forEach((withdraw) => {
      if (withdraw.channel_code) {
        // Cari bank yang sesuai
        const matchedBank = bankAvailable.available_bank.find(
          (bank) => bank.code === withdraw.channel_code
        );

        if (matchedBank && matchedBank.bank) {
          // Jika bank ditemukan dan memiliki properti 'bank'
          withdraw.payment_method = matchedBank.bank;
        } else {
          // Jika tidak ada kecocokan atau struktur data tidak sesuai
          withdraw.payment_method = {
            name: withdraw.channel_code || "Unknown Bank",
            logo: "assets/payment-logo/default.png",
          };
        }
      } else {
        // Jika channel_code tidak ada
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
  processWithdrwalQuickRelease,
};
