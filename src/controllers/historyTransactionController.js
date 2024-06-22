import axios from "axios";
import { validationResult } from "express-validator";
import { apiResponseList, apiResponse } from "../utils/apiResponseFormat.js";
import { connectTargetDatabase } from "../config/targetDatabase.js";
import { ProductModel, productSchema } from "../models/productModel.js";
import {
  TransactionModel,
  transactionSchema,
} from "../models/transactionModel.js";
import { CartModel, cartSchema } from "../models/cartModel.js";
import { StoreModel, storeSchema } from "../models/storeModel.js";
import {
  PaymentMethodModel,
  paymentMethodScheme,
} from "../models/paymentMethodModel.js";
import {
  SplitPaymentRuleIdModel,
  splitPaymentRuleIdScheme,
} from "../models/splitPaymentRuleIdModel.js";
import { ConfigCostModel, configCostSchema } from "../models/configCost.js";
import { DatabaseModel, databaseScheme } from "../models/databaseModel.js";
import { TemplateModel, templateSchema } from "../models/templateModel.js";
import "dotenv/config";

const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
const XENDIT_WEBHOOK_URL = process.env.XENDIT_WEBHOOK_URL;

import moment from "moment";
import getForUserIdXenplatform from "../utils/getForUserIdXenplatform.js";

const historyTransaction = async (req, res) => {
  try {
    const { database, param } = req.body;
    const apiKey = XENDIT_API_KEY;
    const forUserId = await getForUserIdXenplatform(database);
    const endpoint = `https://api.xendit.co//transactions?${param}`;
    console.log(param);
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": forUserId,
    };
    const response = await axios.get(endpoint, { headers });
    const totalAmount = response.data.data.reduce((sum, transaction) => {
      return sum + transaction.amount;
    }, 0);

    // console.log(response.data);

    const db = await connectTargetDatabase(database);
    const SplitData = db.model(
      "Split_Payment_Rule_Id",
      splitPaymentRuleIdScheme
    );
    const splitExist = await SplitData.find();
    const TransactionData = db.model("Transaction", transactionSchema);
    const transactionFromDb = await TransactionData.find();

    const matchingTransactions = findMatchingTransactionsFromTrx(
      response.data,
      splitExist,
      transactionFromDb
    );

    return apiResponse(res, response.status, "Sukses membuat invoice", {
      has_more: response.data.has_more,
      data: matchingTransactions,
      links:
        response.data.links.length == 0
          ? ""
          : response.data.links[0].href.split("?")[1] ?? "",
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, error.message, 400);
  }
};

const findMatchingTransactionsFromTrx = (
  transactions,
  splitPayments,
  transactionFromDb
) => {
  const matchingTransactions = [];
  splitPayments.forEach((splitPayment) => {
    transactionFromDb.forEach((trans) => {
      if (
        trans.payment_method == "CASH" &&
        trans.status == "SUCCEEDED" &&
        trans.id_split_rule == splitPayment.id
      ) {
        console.log(trans.id_split_rule);
        console.log(splitPayment.id);
        const data = {
          id: "",
          product_id: "",
          type: "PAYMENT",
          status: "SUCCESS",
          channel_category: "CASH",
          channel_code: "CASH",
          reference_id: trans.invoice,
          account_identifier: "",
          currency: "IDR",
          amount: trans.product.total_price,
          net_amount: trans.total_with_fee,
          cashflow: "MONEY_IN",
          settlement_status: "SETTLED",
          estimated_settlement_time: trans.createdAt,
          business_id: "",
          created: trans.createdAt,
          updated: trans.updatedAt,
          fee: {
            xendit_fee: 0,
            value_added_tax: 0,
            xendit_withholding_tax: 0,
            third_party_withholding_tax: 0,
            status: "COMPLETED",
          },
        };

        matchingTransactions.push({
          transaction: data,
          splitPayment: splitPayment,
        });
      } else {
      }
    });
  });
  transactions.data.forEach((transaction) => {
    splitPayments.forEach((splitPayment) => {
      if (transaction.reference_id === splitPayment.invoice) {
        console.log({ transaction, splitPayment });
        matchingTransactions.push({ transaction, splitPayment }); // kalo mau gabungin dari xendit dan data split rule didalam satu list
      } else {
        //   matchingTransactions.push({ transaction, 'splitPayment': null });
      }
    });
  });

  return matchingTransactions;
};
const getTotalIncomeTransaction = async (req, res) => {
  try {
    const { database, param } = req.body;
    const apiKey = XENDIT_API_KEY;
    const forUserId = await getForUserIdXenplatform(database);
    const endpoint = `https://api.xendit.co//transactions?${param}&channel_categories=VIRTUAL_ACCOUNT&channel_categories=QR_CODE`;
    console.log(endpoint);
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": forUserId,
    };
    const db = await connectTargetDatabase(database);
    const TransactionData = db.model("Transaction", transactionSchema);
    const transactionCash = await TransactionData.find({
      payment_method: "CASH",
      status: "SUCCEEDED",
    });

    const totalNetAmountCash = transactionCash.reduce((sum, transaction) => {
      return sum + transaction.total_with_fee;
    }, 0);

    const response = await axios.get(endpoint, { headers });
    const totalAmount = response.data.data.reduce((sum, transaction) => {
      return sum + transaction.amount;
    }, 0);
    const totalNetAmount = response.data.data.reduce((sum, transaction) => {
      return sum + transaction.net_amount;
    }, 0);

    const totalXenditFee = response.data.data.reduce((sum, transaction) => {
      return sum + transaction.fee.xendit_fee;
    }, 0);
    const totalTax = response.data.data.reduce((sum, transaction) => {
      return sum + transaction.fee.value_added_tax;
    }, 0);
    return apiResponse(res, response.status, "Sukses membuat invoice", {
      total_amount: totalAmount + totalNetAmountCash,
      net_amount: totalNetAmount + totalNetAmountCash,
      fee: totalXenditFee,
      tax: totalTax,
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, error.message, 400);
  }
};

const getTotalIncomeBagi = async (req, res) => {
  try {
    const { database_trx, param, database_support, role } = req.body;
    const apiKey = XENDIT_API_KEY;
    const forUserId = await getForUserIdXenplatform(database_trx);
    const endpoint = `https://api.xendit.co//transactions?${param}`;
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": forUserId,
    };
    const response = await axios.get(endpoint, { headers });
    if (role === "SUPP") {
      const db = await connectTargetDatabase(database_support);
      const SplitData = db.model(
        "Split_Payment_Rule_Id",
        splitPaymentRuleIdScheme
      );
      const splitExist = await SplitData.find();
      const TransactionData = db.model("Transaction", transactionSchema);
      const transactionFromDb = await TransactionData.find();
      // const matchingTransactions = findMatchingTransactionsFromXendit(
      //   response.data,
      //   splitExist
      // );

      const matchingTransactions = findMatchingTransactionsFromTrx(
        response.data,
        splitExist,
        transactionFromDb
      );
      const targetReferenceId = database_support;
      let totalFlatAmount = 0;

      matchingTransactions.forEach((item) => {
        if (item.splitPayment && item.splitPayment.routes) {
          item.splitPayment.routes.forEach((route) => {
            if (route.reference_id === targetReferenceId) {
              totalFlatAmount += route.flat_amount;
            }
          });
        }
      });
      return apiResponse(res, response.status, "Sukses membuat invoice", {
        net_amount: totalFlatAmount,
      });
    } else {
      const db = await connectTargetDatabase(database_trx);
      const SplitData = db.model(
        "Split_Payment_Rule_Id",
        splitPaymentRuleIdScheme
      );
      const splitExist = await SplitData.find();
      // const matchingTransactions = findMatchingTransactionsFromXendit(
      //   response.data,
      //   splitExist
      // );
      const TransactionData = db.model("Transaction", transactionSchema);
      const transactionFromDb = await TransactionData.find();
      // const matchingTransactions = findMatchingTransactionsFromXendit(
      //   response.data,
      //   splitExist
      // );

      const matchingTransactions = findMatchingTransactionsFromTrx(
        response.data,
        splitExist,
        transactionFromDb
      );
      let totalFlatAmount = 0;
      matchingTransactions.forEach((item) => {
        if (item.splitPayment && item.splitPayment.routes) {
          item.splitPayment.routes.forEach((route) => {
            totalFlatAmount += route.flat_amount;
          });
        }
      });
      return apiResponse(res, response.status, "Sukses membuat invoice", {
        net_amount: totalFlatAmount,
      });
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, error.message, 400);
  }
};
const historyTransactionSupport = async (req, res) => {
  try {
    const { database, param, database_support } = req.body;
    const apiKey = XENDIT_API_KEY;
    const forUserId = await getForUserIdXenplatform(database);
    const endpoint = `https://api.xendit.co//transactions?${param}`;
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": forUserId,
    };
    const response = await axios.get(endpoint, { headers });
    const db = await connectTargetDatabase(database_support);
    const SplitData = db.model(
      "Split_Payment_Rule_Id",
      splitPaymentRuleIdScheme
    );
    const splitExist = await SplitData.find();

    const matchingTransactions = findMatchingTransactionsFromXendit(
      response.data,
      splitExist
    );

    return apiResponse(res, response.status, "Sukses membuat invoice", {
      has_more: response.data.has_more,
      data: matchingTransactions,
      links:
        response.data.links.length == 0
          ? ""
          : response.data.links[0].href.split("?")[1] ?? "",
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400);
  }
};
const historyTransactionReport = async (req, res) => {
  try {
    const { database, param } = req.body;
    const apiKey = XENDIT_API_KEY;
    const forUserId = await getForUserIdXenplatform(database);

    const endpoint = `https://api.xendit.co//transactions?${param}`;
    console.log(param);
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": forUserId,
    };
    const response = await axios.get(endpoint, { headers });
    const db = await connectTargetDatabase(database);
    const TransactionData = db.model("Transaction", transactionSchema);

    const transaction = await TransactionData.find();
    const matchingTransactions = findMatchingTransactionsReport(
      response.data,
      transaction
    );
    console.log("historyTransactionReport");
    return apiResponse(res, response.status, "Sukses membuat invoice", {
      has_more: response.data.has_more,
      data: matchingTransactions,
      links:
        response.data.links.length == 0
          ? ""
          : response.data.links[0].href.split("?")[1] ?? "",
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponseList(res, 400);
  }
};

const findMatchingTransactionsReport = (dataXendit, transaction) => {
  console.log("find match");
  const matchingTransactions = [];
  transaction.forEach((trans) => {
    if (trans.payment_method == "CASH" && trans.status == "SUCCEEDED") {
      const data = {
        id: "",
        product_id: "",
        type: "PAYMENT",
        status: "SUCCESS",
        channel_category: "CASH",
        channel_code: "CASH",
        reference_id: trans.invoice,
        account_identifier: "",
        currency: "IDR",
        amount: trans.product.total_price,
        net_amount: trans.total_with_fee,
        cashflow: "MONEY_IN",
        settlement_status: "SETTLED",
        estimated_settlement_time: trans.createdAt,
        business_id: "",
        created: trans.createdAt,
        updated: trans.updatedAt,
        fee: {
          xendit_fee: 0,
          value_added_tax: 0,
          xendit_withholding_tax: 0,
          third_party_withholding_tax: 0,
          status: "COMPLETED",
        },
      };
      matchingTransactions.push(data);
    }
    dataXendit.data.forEach((xendit) => {
      if (xendit.reference_id === trans.invoice) {
        matchingTransactions.push(xendit);
        // matchingTransactions.push({ transaction, splitPayment });// kalo mau gabungin dari xendit dan data split rule didalam satu list
      }
    });
  });
  matchingTransactions.sort(
    (a, b) => new Date(b.created) - new Date(a.created)
  );
  console.log(matchingTransactions);
  return matchingTransactions;
};
const historyTransactionToday = async (req, res) => {
  try {
    const { database } = req.body;
    const apiKey = XENDIT_API_KEY;
    const forUserId = await getForUserIdXenplatform(database);
    // for xendit
    const todayXen = new Date();
    todayXen.setHours(0, 0, 0, 0); // Set waktu ke tengah malam
    const startDate = todayXen.toISOString(); // Ubah ke format ISO string
    const endDate = new Date().toISOString(); // Untuk mencakup hari ini, gunakan tanggal dan waktu saat ini
    const query = `types=PAYMENT&created[gte]=${startDate}&created[lte]=${endDate}`;

    const endpoint = `https://api.xendit.co//transactions?${query}`;
    console.log(endpoint);
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": forUserId,
    };
    const response = await axios.get(endpoint, { headers });
    const db = await connectTargetDatabase(database);
    const TransactionData = db.model("Transaction", transactionSchema);
    //tanggal hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const transaction = await TransactionData.find({
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    const matchingTransactions = findMatchingTransactions(
      response.data,
      transaction
    );

    //gimana agar respond.data.refernce_id ada disalah satu splitExist maka datanya muncul
    return apiResponseList(
      res,
      response.status,
      "Sukses membuat invoice",
      matchingTransactions[0]
    );
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponseList(res, 400);
  }
};
const findMatchingTransactions = (transactions, splitPayments) => {
  const matchingTransactions = [];
  splitPayments.forEach((split) => {
    console.log(split);
    if (split.payment_method == "CASH" && split.status == "SUCCEEDED") {
      matchingTransactions.push(splitPayments);
    }
  });
  transactions.data.forEach((transaction) => {
    splitPayments.forEach((split) => {
      if (transaction.reference_id === split.invoice) {
        matchingTransactions.push(split);
        // matchingTransactions.push({ transaction, split });// kalo mau gabungin dari xendit dan data split rule didalam satu list
      }
    });
  });

  console.log(matchingTransactions);
  return matchingTransactions;
};
const findMatchingTransactionsV2 = (transactions, splitPayments) => {
  const matchingTransactions = [];
  transactions.data.forEach((transaction) => {
    splitPayments.forEach((splitPayment) => {
      console.log(splitPayment);
      if (transaction.reference_id === splitPayment.invoice) {
        matchingTransactions.push(splitPayments);
        // matchingTransactions.push({ transaction, splitPayment });// kalo mau gabungin dari xendit dan data split rule didalam satu list
      }
    });
  });
  console.log(matchingTransactions);
  return matchingTransactions;
};

const findMatchingTransactionsFromXendit = (transactions, splitPayments) => {
  const matchingTransactions = [];
  transactions.data.forEach((transaction) => {
    splitPayments.forEach((splitPayment) => {
      if (transaction.reference_id === splitPayment.invoice) {
        // matchingTransactions.push(transaction);
        matchingTransactions.push({ transaction, splitPayment }); // kalo mau gabungin dari xendit dan data split rule didalam satu list
      }
    });
  });
  return matchingTransactions;
};

const getFilterStore = async (req, res) => {
  try {
    // const targetDatabase = req.get('target-database');
    const { bs_database } = req.body;
    const role = req.params.role;

    if (!bs_database) {
      return apiResponse(res, 400, "database tidak ditemukan");
    }
    const databases = await DatabaseModel.find();
    const result = [];
    for (const dbInfo of databases) {
      const dbName = dbInfo.db_name;
      const emailOwner = dbInfo.email_owner;
      const database = await connectTargetDatabase(dbName);
      const StoreModelDatabase = database.model("Store", storeSchema);
      const data = await StoreModelDatabase.findOne({ id_parent: bs_database });
      console.log("ini target daata");
      console.log(bs_database);
      console.log(data);
      if (data != null) {
        if (data.merchant_role === role && data.store_status === "ACTIVE") {
          const db = await connectTargetDatabase(bs_database);
          const Template = db.model("Template", templateSchema);
          const template = await Template.findOne({ db_trx: dbName });
          result.push({
            db_name: dbName,
            email_owner: emailOwner ?? null,
            store_name: data.store_name,
            account_id: data.account_holder.id,
            template_id: template._id,
            template_name: template.name,
            template_status: template.status_template,
            created: data.createdAt,
            updated: data.updatedAt,
          });
        }
      }
    }
    console.log(result);
    return apiResponseList(res, 200, "success", result);
  } catch (err) {
    console.error(err);
    return apiResponseList(res, 400, "error");
  }
};

const transactionDetail = async (req, res) => {
  try {
    const { database, invoice } = req.body;
    const db = await connectTargetDatabase(database);
    const SplitData = db.model(
      "Split_Payment_Rule_Id",
      splitPaymentRuleIdScheme
    );
    console.log(invoice);
    const split = await SplitData.findOne({ invoice: invoice });
    if (!split) {
      return apiResponse(res, 400, "NON_SPLIT");
    }

    const StoreData = db.model("Store", storeSchema);
    const store = await StoreData.findOne();

    console.log(store);

    const dbParent = await connectTargetDatabase(store.id_parent);
    const Template = dbParent.model("Template", templateSchema);
    const template = await Template.findOne({ _id: split.id_template });

    const newRoute = {
      type: "FEE",
      target: "Garapin",
      fee_pos: 0,
      flat_amount: null,
      percent_amount: 0,
      currency: "IDR",
      destination_account_id: "",
      reference_id: "",
    };
    template.routes.push(newRoute);
    return apiResponse(res, 200, "Ambil history", { split, template });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400);
  }
};

const transactionDetailNonSplit = async (req, res) => {
  try {
    const { database, invoice } = req.body;
    const db = await connectTargetDatabase(database);
    const Transaction = db.model("Transaction", transactionSchema);
    const transaction = await Transaction.findOne({ invoice: invoice });
    return apiResponse(res, 200, "Detail Invoice", transaction);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400);
  }
};

const historyTransactionV2 = async (req, res) => {
  try {
    // const param = req.params.id;
    const { database, param } = req.body;
    console.log(database);
    console.log(param);
    const apiKey = XENDIT_API_KEY;
    const pairs = param.split("&");
    let createdGte = null;
    let createdLte = null;
    pairs.forEach((pair) => {
      const [key, value] = pair.split("=");
      if (key === "created[gte]") {
        createdGte = value;
      } else if (key === "created[lte]") {
        createdLte = value;
      }
    });
    const db = await connectTargetDatabase(database);
    const TransactionData = db.model("Transaction", transactionSchema);
    const transaction = await TransactionData.find({
      createdAt: {
        $gte: createdGte,
        $lt: createdLte,
      },
    });
    const forUserId = await getForUserIdXenplatform(database);
    const endpoint = `https://api.xendit.co//transactions?${param}`;
    console.log(endpoint);
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": forUserId,
    };
    const response = await axios.get(endpoint, { headers });
    const matchingTransactions = findMatchingTransactions(
      response.data,
      transaction
    );
    return apiResponse(
      res,
      response.status,
      "Sukses membuat invoice",
      matchingTransactions
    );
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, error.message, 400);
  }
};

export default {
  historyTransactionReport,
  historyTransaction,
  getTotalIncomeTransaction,
  getTotalIncomeBagi,
  getFilterStore,
  transactionDetail,
  historyTransactionSupport,
  transactionDetailNonSplit,
  historyTransactionToday,
  historyTransactionV2,
};
