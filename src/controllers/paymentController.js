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
import {
  ConfigTransactionModel,
  configTransactionSchema,
} from "../models/configTransaction.js";
import { TemplateModel, templateSchema } from "../models/templateModel.js";
const XENDIT_API_KEY = process.env.XENDIT_API_KEY;
const XENDIT_WEBHOOK_URL = process.env.XENDIT_WEBHOOK_URL;
const XENDIT_URL = "https://api.xendit.co";

import moment from "moment";
import Logger from "../utils/logger.js";
import { boolean } from "zod";

const createInvoice = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const timestamp = new Date().getTime();
    const generateInvoice = `INV-${timestamp}`;
    const data = {
      external_id: `${generateInvoice}&&${targetDatabase}&&POS`,
      amount: req.body.amount,
      invoice_label: generateInvoice,
      payer_email: req.body.payer_email,
      description: `Membuat invoice INV-${timestamp}`,
    };
    const response = await saveTransaction(req, req.body.cart_id, data);
    return apiResponse(res, 200, "Sukses membuat invoice", response);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error", response.data);
  }
};

const createInvoiceTopUp = async (req, res) => {
  try {
    console.log("INI TARGET DB");
    console.log(req.body);
    const targetDatabase = req.body.target_database;
    const timestamp = new Date().getTime();
    const generateInvoice = `INV-${timestamp}`;
    const data = {
      external_id: req.body.is_quick_release
        ? `${generateInvoice}&&${targetDatabase}&&POS&&QUICK_RELEASE`
        : `${generateInvoice}&&${targetDatabase}&&POS&&TOP_UP`,
      amount: req.body.amount,
      invoice_label: generateInvoice,
      payer_email: req.body.payer_email,
      description: `Membuat invoice INV-${timestamp}`,
    };
    const response = await saveTransactionTopUp(req, data);
    return apiResponse(res, 200, "Sukses membuat invoice", response);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error", response.data);
  }
};

const saveTransaction = async (req, cartId, data) => {
  const targetDatabase = req.get("target-database");
  const storeDatabase = await connectTargetDatabase(targetDatabase);
  const productModelStore = storeDatabase.model("Product", productSchema);
  const cartModelStore = storeDatabase.model("Cart", cartSchema);
  const StoreModelData = storeDatabase.model("Store", storeSchema);
  const storeModelData = await StoreModelData.findOne();
  const cart = await cartModelStore.findById(cartId).populate("items.product");
  let totalPrice = 0;

  for (const item of cart.items) {
    const product = await productModelStore.findById(item.product);
    const itemPrice = product.price - product.discount;
    totalPrice += itemPrice * item.quantity;
  }
  const feePos = await getFeePos(
    totalPrice,
    storeModelData.id_parent,
    targetDatabase
  );
  cart.total_price = totalPrice;
  const totalWithFee = totalPrice + feePos;

  const TransactionModelStore = storeDatabase.model(
    "Transaction",
    transactionSchema
  );
  const addTransaction = new TransactionModelStore({
    product: cart.toObject(),
    invoice: data.external_id,
    invoice_label: data.invoice_label,
    status: "PENDING",
    fee_garapin: feePos,
    total_with_fee: totalWithFee,
    settlement_status: "NOT_SETTLED",
  });
  return await addTransaction.save();
};

const saveTransactionTopUp = async (req, data) => {
  const targetDatabase = req.body.target_database;
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  const totalWithFee = data.amount;

  const TransactionModelStore = storeDatabase.model(
    "Transaction",
    transactionSchema
  );
  const addTransaction = new TransactionModelStore({
    product: {},
    invoice: data.external_id,
    invoice_label: data.invoice_label,
    status: "PENDING_TOPUP",
    total_with_fee: totalWithFee,
  });
  return await addTransaction.save();
};

const getFeePos = async (totalAmount, idParent, targetDatabase) => {
  if (idParent === null) {
    const myDb = await connectTargetDatabase(targetDatabase);
    const ConfigCost = myDb.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();
    let garapinCost = 200;
    for (const cost of configCost) {
      if (totalAmount >= cost.start && totalAmount <= cost.end) {
        garapinCost = cost.cost;
        break;
      }
    }
    return garapinCost;
  } else {
    console.log("disini jalan");
    console.log(idParent);
    const db = await connectTargetDatabase(idParent);
    const ConfigCost = db.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();
    let garapinCost = 200;
    for (const cost of configCost) {
      if (totalAmount >= cost.start && totalAmount <= cost.end) {
        garapinCost = cost.cost;
        break;
      }
    }
    const Template = db.model("Template", templateSchema);
    const template = await Template.findOne({ db_trx: targetDatabase });
    console.log(template);
    const amountToSubtract = (template.fee_cust / 100) * garapinCost;
    return amountToSubtract;
  }
};

const getInvoices = async (req, res) => {
  let storeDatabase = null;
  try {
    const inv = req.params.id;
    if (inv) {
      console.log(inv);
      const targetDatabase = req.get("target-database");
      if (!targetDatabase) {
        return apiResponse(res, 400, "Target database is not specified");
      }
      storeDatabase = await connectTargetDatabase(targetDatabase);
      const TransactionModelStore = storeDatabase.model(
        "Transaction",
        transactionSchema
      );
      console.log(inv);
      const invoices = await TransactionModelStore.findOne({ invoice: inv });
      return apiResponse(res, 200, "Ambil invoices", invoices);
    } else {
      return apiResponse(res, 400, "Invoices tidak ditemukan");
    }
  } catch (error) {
    console.error("Error:", error.message);
    return apiResponse(res, 400, "Invoices tidak ditemukan");
  }
};
const cancelInvoices = async (req, res) => {
  try {
    const inv = req.params.id;

    // Jika invoice_number diberikan, lakukan pencarian berdasarkan itu
    if (inv) {
      console.log(inv);
      const targetDatabase = req.get("target-database");
      if (!targetDatabase) {
        return apiResponse(res, 400, "Target database is not specified");
      }
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const TransactionModelStore = storeDatabase.model(
        "Transaction",
        transactionSchema
      );

      console.log(inv);
      const invoices = await TransactionModelStore.findOne({ invoice: inv });

      if (invoices) {
        if (invoices.status === "SUCCEEDED") {
        } else {
          invoices.status = "CANCELLED";
          await invoices.save();
        }

        return apiResponse(res, 200, "Order Dibatalkan", invoices);
      } else {
        return apiResponse(res, 404, "Invoices tidak ditemukan");
      }
    } else {
      return apiResponse(res, 400, "Invoice tidak ditemukan");
    }
  } catch (error) {
    console.error("Error:", error.message);
    return apiResponse(res, 500, "Terjadi kesalahan dalam mengambil faktur");
  }
};

const createVirtualAccountPaymentLockedAccount = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const apiKey = XENDIT_API_KEY;

    const database = await connectTargetDatabase(targetDatabase);
    const garapinDB = await connectTargetDatabase("garapin_pos");

    const configTransaction = await ConfigTransactionModel.findOne({
      type: "VA",
    });

    const ConfigCost = garapinDB.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();

    const feeBank = configTransaction.fee_flat;
    const vat = Math.floor(feeBank * (configTransaction.vat_percent / 100));

    const storeModel = await database.model("Store", storeSchema).findOne();
    const transactionModel = database.model("Transaction", transactionSchema);
    const invoces = await transactionModel.findOneAndUpdate(
      { invoice: req.body.external_id },
      { payment_method: "VA", vat: vat, fee_bank: feeBank }
    );

    var totalAmountWithFee = invoces.total_with_fee;

    if (req.body.is_quick_release) {
      totalAmountWithFee =
        invoces.total_with_fee +
        configCost[0].cost_quick_release +
        vat +
        feeBank;
    }

    if (invoces.total_with_fee <= feeBank) {
      return apiResponse(res, 400, "tidak memenuhi minium transaksi");
    }
    if (invoces == null) {
      return apiResponse(res, 400, "invoices tidak ditemukan");
    }
    const bankAvailable = await PaymentMethodModel.findOne();
    if (!bankAvailable) {
      return apiResponse(res, 400, "Tidak ada bank yang tersedia");
    }

    const bankCodes = bankAvailable.available_bank.map((bank) => bank.bank);
    if (!bankCodes.includes(req.body.bank_code)) {
      return apiResponse(res, 400, "Bank tidak terdaftar");
    }
    const expiredDate = moment().add(15, "minutes").toISOString();
    const data = {
      external_id: req.body.external_id,
      bank_code: req.body.bank_code,
      is_closed: true,
      expected_amount: totalAmountWithFee,
      name: storeModel.store_name.substring(0, 12),
      expiration_date: expiredDate,
    };

    /// TODO: Change to Garapin xenPlatform
    let idXenplatform = "";
    if (req.body.is_quick_release) {
      idXenplatform = process.env.XENDIT_ACCOUNT_GARAPIN;
    } else {
      idXenplatform = await getForUserId(targetDatabase);
    }

    if (!idXenplatform) {
      return apiResponse(res, 400, "for-user-id kosong");
    }
    const endpoint = "https://api.xendit.co/callback_virtual_accounts";

    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
    };

    invoces.save();

    const response = await axios.post(endpoint, data, { headers });
    console.log(response.data);
    return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error");
  }
};

const createQrCodePaymentLockedAccount = async (req, res) => {
  try {
    const targetDatabase = req.body.target_database;
    const database = await connectTargetDatabase(targetDatabase);
    const garapinDB = await connectTargetDatabase("garapin_pos");

    const apiKey = XENDIT_API_KEY;
    const expiredDate = moment().add(15, "minutes").toISOString();
    const configTransaction = await ConfigTransactionModel.findOne({
      type: "QRIS",
    });

    const ConfigCost = garapinDB.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();

    const feeBank = Math.round(
      req.body.amount * (configTransaction.fee_percent / 100)
    );

    const vat = Math.round(feeBank * (configTransaction.vat_percent / 100));

    var totalAmountWithFee = req.body.amount;

    const TransactionModel = database.model("Transaction", transactionSchema);
    const invoces = await TransactionModel.findOneAndUpdate(
      { invoice: req.body.reference_id },
      { payment_method: "QRIS", vat: vat, fee_bank: feeBank }
    );

    if (req.body.is_quick_release) {
      totalAmountWithFee =
        invoces.total_with_fee +
        configCost[0].cost_quick_release +
        vat +
        feeBank;
    }

    const data = {
      reference_id: req.body.reference_id,
      type: "DYNAMIC",
      currency: "IDR",
      amount: totalAmountWithFee,
      expires_at: expiredDate,
    };

    if (invoces == null) {
      return apiResponse(res, 400, "invoices tidak ditemukan");
    }

    let idXenplatform = "";
    if (req.body.is_quick_release) {
      idXenplatform = process.env.XENDIT_ACCOUNT_GARAPIN;
    } else {
      idXenplatform = await getForUserId(targetDatabase);
    }

    if (!idXenplatform) {
      return apiResponse(res, 400, "for-user-id kosong");
    }

    const endpoint = "https://api.xendit.co/qr_codes";
    if (!idXenplatform) {
      return apiResponse(res, 400, "for-user-id kosong");
    }

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database tidak ada");
    }

    const headers = {
      "api-version": "2022-07-31",
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
      "webhook-url": `${XENDIT_WEBHOOK_URL}/webhook/${targetDatabase}`,
    };

    invoces.save();

    const response = await axios.post(endpoint, data, { headers });
    console.log("QR ID");
    console.log(response.data);
    return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
  } catch (error) {
    console.log("KENA ERROR");
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error");
  }
};

const createQrCode = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const database = await connectTargetDatabase(targetDatabase);
    const apiKey = XENDIT_API_KEY;
    const expiredDate = moment().add(15, "minutes").toISOString();
    const configTransaction = await ConfigTransactionModel.findOne({
      type: "QRIS",
    });
    console.log(configTransaction);

    const TransactionModel = database.model("Transaction", transactionSchema);
    let invoces = await TransactionModel.findOne({
      invoice: req.body.reference_id,
    });

    const feeBank = Math.floor(
      invoces.total_with_fee * (configTransaction.fee_percent / 100)
    );
    const vat = Math.floor(feeBank * (configTransaction.vat_percent / 100));

    invoces = await TransactionModel.findOneAndUpdate(
      { invoice: req.body.reference_id },
      { payment_method: "QRIS", vat: vat, fee_bank: feeBank }
    );
    const data = {
      reference_id: req.body.reference_id,
      type: "DYNAMIC",
      currency: "IDR",
      amount: invoces.total_with_fee,
      expires_at: expiredDate,
    };
    if (invoces == null) {
      return apiResponse(res, 400, "invoices tidak ditemukan");
    }
    // const idXenplatform = await getForUserId(targetDatabase);
    // TODO: Change to Garapin xenPlatform
    const idXenplatform = process.env.XENDIT_ACCOUNT_GARAPIN;
    if (!idXenplatform) {
      return apiResponse(res, 400, "for-user-id kosong");
    }
    const endpoint = "https://api.xendit.co/qr_codes";
    if (!idXenplatform) {
      return apiResponse(res, 400, "for-user-id kosong");
    }
    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database tidak ada");
    }
    const withSplitRule = await createSplitRuleForNewEngine(
      req,
      invoces.total_with_fee - invoces.fee_garapin,
      feeBank + vat,
      invoces.invoice
    );
    const headers = {
      "api-version": "2022-07-31",
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
      // 'with-split-rule': withSplitRule,
      // 'webhook-url' : `${XENDIT_WEBHOOK_URL}/webhook/${req.body.reference_id}/${targetDatabase}`
      "webhook-url": `${XENDIT_WEBHOOK_URL}/webhook/${targetDatabase}`,
    };

    // if (withSplitRule !== null) {
    //   headers["with-split-rule"] = withSplitRule.id;
    //   invoces.id_split_rule = withSplitRule.id;
    //   invoces.save();
    // }

    // Save Invoice Transaction
    headers["with-split-rule"] = "";
    invoces.id_split_rule = "";
    invoces.save();

    const response = await axios.post(endpoint, data, { headers });
    console.log("QR ID");
    console.log(response.data);
    return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
  } catch (error) {
    console.log("KENA ERROR");
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error");
  }
};

const createVirtualAccount = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const apiKey = XENDIT_API_KEY;

    const database = await connectTargetDatabase(targetDatabase);
    const configTransaction = await ConfigTransactionModel.findOne({
      type: "VA",
    });
    console.log(configTransaction);
    const feeBank = configTransaction.fee_flat;
    const vat = Math.floor(feeBank * (configTransaction.vat_percent / 100));
    const storeModel = await database.model("Store", storeSchema).findOne();
    const transactionModel = database.model("Transaction", transactionSchema);
    const invoces = await transactionModel.findOneAndUpdate(
      { invoice: req.body.external_id },
      { payment_method: "VA", vat: vat, fee_bank: feeBank }
    );
    if (invoces.product.total_price <= feeBank) {
      return apiResponse(res, 400, "tidak memenuhi minium transaksi");
    }
    if (invoces == null) {
      return apiResponse(res, 400, "invoices tidak ditemukan");
    }
    const bankAvailable = await PaymentMethodModel.findOne();
    if (!bankAvailable) {
      return apiResponse(res, 400, "Tidak ada bank yang tersedia");
    }

    const bankCodes = bankAvailable.available_bank.map((bank) => bank.bank);
    if (!bankCodes.includes(req.body.bank_code)) {
      return apiResponse(res, 400, "Bank tidak terdaftar");
    }
    const expiredDate = moment().add(15, "minutes").toISOString();
    const data = {
      external_id: req.body.external_id,
      bank_code: req.body.bank_code,
      is_closed: true,
      expected_amount: invoces.total_with_fee,
      name: storeModel.store_name.substring(0, 12),
      expiration_date: expiredDate,
    };

    // const idXenplatform = req.get('for-user-id');
    // const withSplitRule = req.get('with-split-rule');

    /// TODO: Change to Garapin xenPlatform
    // const idXenplatform = await getForUserId(targetDatabase);
    const idXenplatform = process.env.XENDIT_ACCOUNT_GARAPIN;
    if (!idXenplatform) {
      return apiResponse(res, 400, "for-user-id kosong");
    }
    const endpoint = "https://api.xendit.co/callback_virtual_accounts";

    const withSplitRule = await createSplitRuleForNewEngine(
      req,
      invoces.total_with_fee - invoces.fee_garapin,
      feeBank + vat,
      invoces.invoice
    );

    console.log(withSplitRule);
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
      "webhook-url": `${XENDIT_WEBHOOK_URL}/webhook/${targetDatabase}`,
    };
    // if (withSplitRule !== null) {
    //   headers["with-split-rule"] = withSplitRule.id;
    //   invoces.id_split_rule = withSplitRule.id;
    //   invoces.save();
    // }

    // Save Invoice Transaction
    headers["with-split-rule"] = "";
    invoces.id_split_rule = "";
    invoces.save();

    const response = await axios.post(endpoint, data, { headers });
    console.log(response.data);
    return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error");
  }
};

const getQrCode = async (req, res) => {
  try {
    const apiKey = XENDIT_API_KEY;
    const id = req.params.id;

    const idXenplatform = req.get("for-user-id");
    const endpoint = `https://api.xendit.co/qr_codes/${id}`;

    const headers = {
      "api-version": "2022-07-31",
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
    };

    const response = await axios.get(endpoint, { headers });
    console.log(response);
    return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error", response.data);
  }
};

//not use
const createEwallet = async (req, res) => {
  try {
    const apiKey = XENDIT_API_KEY;
    const targetDatabase = req.get("target-database");
    const idXenplatform = req.get("for-user-id");

    const results = await setWebhookXenplatform(req);

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );
    const invoces = await TransactionModelStore.findOne({
      invoice: req.body.reference_id,
    });
    console.log(invoces);
    console.log(invoces.product.total_price);
    const data = {
      reference_id: req.body.reference_id,
      currency: "IDR",
      amount: invoces.product.total_price,
      checkout_method: "ONE_TIME_PAYMENT",
      channel_code: req.body.channel_code,
      channel_properties: {
        mobile_number: req.body.mobile_phone_customer,
      },
    };
    const endpoint = "https://api.xendit.co/ewallets/charges";

    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
      //webhook set from api call set callback url xenplatform
    };

    const response = await axios.post(endpoint, data, { headers });
    return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error");
  }
};

///not use
const setWebhookXenplatform = async (req) => {
  try {
    const apiKey = XENDIT_API_KEY;
    const targetDatabase = req.get("target-database");
    const idXenplatform = req.get("for-user-id");
    const data = { url: `${XENDIT_WEBHOOK_URL}/webhook/${targetDatabase}` };

    const endpoint = "https://api.xendit.co/callback_urls/ewallet";

    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
      //webhook set from api call set callback url xenplatform
    };
    const response = await axios.post(endpoint, data, { headers });
    console.log("ini true");
    console.log("ini true");
    return true;
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return false;
  }
};

const xenditWebhook = async (req, res) => {
  try {
    const eventData = req.body;
    console.log("Received Xendit webhook:", eventData);
    // const inv = req.params.id
    const db = req.params.db;
    const storeDatabase = await connectTargetDatabase(db);
    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );
    const StoreModel = storeDatabase.model("Store", storeSchema);

    console.log("EVENT DATA WEBHOOK");
    console.log(eventData);

    if (eventData.event === "qr.payment") {
      /// Split for get DBname

      const paymentData = eventData.data;
      const store = await StoreModel.findOne({
        merchant_role: ["TRX", "NOT_MERCHANT"],
      });
      const referenceId = paymentData.reference_id;
      const paymentAmount = paymentData.amount;
      const currency = paymentData.currency;
      const paymentStatus = paymentData.status;

      const str = referenceId;
      const parts = str.split("&&");
      const topUpType = parts[3];

      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: referenceId },
        {
          $set: {
            status: paymentStatus,
            webhook: eventData,
            payment_method: "QR_QODE",
            payment_date: eventData.created,
          },
        },
        { new: true }
      );

      if (store.store_status === "LOCKED") {
        console.log("===============================");
        console.log("store status locked");
        console.log("===============================");
        const updateStoreStatus = await StoreModel.findOneAndUpdate(
          { merchant_role: ["TRX", "NOT_MERCHANT"] },
          {
            $set: {
              store_status: "PENDING_ACTIVE",
            },
          }
        );
      }

      if (topUpType !== null) {
        console.log(`TOP UP TYPE: ${topUpType}`);
        if (topUpType === "QUICK_RELEASE") {
          console.log("QUICK RELEASE");

          const Transaction = await TransactionModelStore.findOne({
            invoice: referenceId,
          });

          const amount = Transaction.total_with_fee;
          await xenditTransferQuickRelease(
            amount,
            referenceId,
            store.account_holder.id
          );
        }
      }
    }

    res.status(200).end();
  } catch (error) {
    console.error("Error handling Xendit webhook:", error);
    res.status(500).end();
  }
};

const xenditTransferQuickRelease = async (amount, invoice, source_user_id) => {
  const transferBody = {
    amount: amount,
    source_user_id: process.env.XENDIT_ACCOUNT_GARAPIN,
    destination_user_id: source_user_id,
    reference: invoice + "&&" + "TOPUP",
  };

  console.log(transferBody);

  try {
    const postTransfer = await axios.post(
      `${XENDIT_URL}/transfers`,
      transferBody,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(XENDIT_API_KEY + ":").toString(
            "base64"
          )}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (postTransfer.status === 200) {
      Logger.log(`Transaction ${invoice} successfully TOPUP`);
    } else if (postTransfer.status === 403) {
      Logger.log(`Garapin POS has not have balance to TOPUP ${invoice}`);

      // Create TOPUP Transaction for Garapin POS
      const targetDatabase = "garapin_pos";
      const timestamp = new Date().getTime();
      const generateInvoice = `INV-${timestamp}`;
      const data = {
        external_id: `${generateInvoice}&&${targetDatabase}&&POS&&TOP_UP`,
        amount: amount,
        invoice_label: generateInvoice,
        payer_email: "garapin",
        description: `Membuat invoice INV-${timestamp}`,
      };

      const storeDatabase = await connectTargetDatabase(targetDatabase);

      const totalWithFee = data.amount;

      const TransactionModelStore = storeDatabase.model(
        "Transaction",
        transactionSchema
      );
      const addTransaction = new TransactionModelStore({
        product: {},
        invoice: data.external_id,
        invoice_label: data.invoice_label,
        status: "PENDING_TRANSFER",
        payment_method: "CASH",
        total_with_fee: totalWithFee,
      });

      return await addTransaction.save();
    } else {
      Logger.log(`Failed to TOPUP ${invoice}`);
    }
  } catch (error) {
    const { response } = error;
    const { request, ...errorObject } = response;

    Logger.errorLog("Error during TOPUP", errorObject.data.message);

    if (errorObject.data.error_code === "INSUFFICIENT_BALANCE") {
      Logger.log(`Garapin POS has not have balance to TOPUP ${invoice}`);

      // Create TOPUP Transaction for Garapin POS
      const targetDatabase = "garapin_pos";
      const timestamp = new Date().getTime();
      const generateInvoice = `INV-${timestamp}`;
      const data = {
        external_id: `${generateInvoice}&&${targetDatabase}&&POS&&TOP_UP`,
        amount: amount,
        invoice_label: generateInvoice,
        payer_email: "garapin",
        description: `Membuat invoice INV-${timestamp}`,
      };

      const storeDatabase = await connectTargetDatabase(targetDatabase);

      const totalWithFee = data.amount;

      const TransactionModelStore = storeDatabase.model(
        "Transaction",
        transactionSchema
      );
      const addTransaction = new TransactionModelStore({
        product: {},
        invoice: data.external_id,
        invoice_label: data.invoice_label,
        status: "PENDING_TRANSFER",
        payment_method: "CASH",
        total_with_fee: totalWithFee,
      });

      return await addTransaction.save();
    }
  }
};

const webhookPaymentOneMart = async (req, res) => {
  return req.body;
};

const webhookVirtualAccount = async (req, res) => {
  try {
    const eventData = req.body;
    const { headers } = req;
    console.log("body:", eventData);
    console.log("header:", headers);
    const { type } = req.params;
    const str = eventData.external_id;
    const parts = str.split("&&");
    const invoice = parts[0];
    const targetDatabase = parts[1];
    const POS = parts[2];
    const topUpType = parts[3];

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );

    const StoreModel = storeDatabase.model("Store", storeSchema);
    const store = await StoreModel.findOne({
      merchant_role: ["TRX", "NOT_MERCHANT"],
    });

    console.log(type);
    console.log(eventData.status);
    if (type === "CREATED") {
      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: eventData.external_id },
        {
          $set: {
            status: eventData.status,
            webhook: eventData,
            payment_method: "VIRTUAL_ACCOUNT",
            payment_date: eventData.created,
          },
        },
        { new: true }
      );
    } else if (type === "PAID") {
      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: eventData.external_id },
        {
          $set: {
            status: "SUCCEEDED",
            webhook: eventData,
            payment_method: "VIRTUAL_ACCOUNT",
            payment_date: eventData.created,
          },
        },
        { new: true }
      );

      if (store.store_status === "LOCKED") {
        console.log("===============================");
        console.log("store status locked");
        console.log("===============================");
        const updateStoreStatus = await StoreModel.findOneAndUpdate(
          { merchant_role: ["TRX", "NOT_MERCHANT"] },
          {
            $set: {
              store_status: "PENDING_ACTIVE",
            },
          }
        );
      }

      if (topUpType !== null) {
        console.log(`TOP UP TYPE: ${topUpType}`);
        if (topUpType === "QUICK_RELEASE") {
          console.log("QUICK RELEASE");

          const Transaction = await TransactionModelStore.findOne({
            invoice: eventData.external_id,
          });

          const amount = Transaction.total_with_fee;
          await xenditTransferQuickRelease(
            amount,
            eventData.external_id,
            store.account_holder.id
          );
        }
      }
    }
    res.status(200).end();
  } catch (error) {
    console.error("Error handling Xendit webhook:", error);
    res.status(500).end();
  }
};

//NOT USE
const xenPlatformWebhook = async (req, res) => {
  try {
    const eventData = req.body;
    console.log("Received Xendit webhook:", eventData);
    // const inv = req.params.id
    const { db } = req.params;
    const storeDatabase = await connectTargetDatabase(db);
    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );
    const paymentData = eventData.data;
    const referenceId = paymentData.reference_id;
    // const paymentAmount = paymentData.amount;
    // const currency = paymentData.currency;
    const paymentStatus = paymentData.status;
    if (eventData.event === "qr.payment") {
      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: referenceId },
        {
          $set: {
            status: paymentStatus,
            webhook: eventData,
            payment_method: "QR",
            payment_date: eventData.created,
          },
        },
        { new: true }
      );
    } else if (eventData.event === "ewallet.capture") {
      const updateResult = await TransactionModelStore.findOneAndUpdate(
        { invoice: referenceId },
        {
          $set: {
            status: paymentStatus,
            webhook: eventData,
            payment_method: "EWALLET",
            payment_date: eventData.created,
          },
        },
        { new: true }
      );
    }
    res.status(200).end();
  } catch (error) {
    console.error("Error handling Xendit webhook:", error);
    res.status(500).end();
  }
};

const paymentAvailable = async (req, res) => {
  const { type } = req.query; // Destructure `type` from `req.query`
  console.log("Type:", type); // Log the type for debugging
  let bankAvailable;

  try {
    // Fetch the document containing the available banks
    bankAvailable = await PaymentMethodModel.findOne();
    console.log("Bank Available:", bankAvailable); // Log the fetched data for debugging

    if (!bankAvailable) {
      return apiResponse(res, 404, "No bank available for the provided type");
    }

    // Filter the banks based on the type
    let filteredBanks;
    if (type === "payment") {
      filteredBanks = bankAvailable.available_bank.filter(
        (bank) => bank.payment_bank === true
      );
    } else if (type === "withdraw") {
      filteredBanks = bankAvailable.available_bank.filter(
        (bank) => bank.withdrawl === true
      );
    } else {
      filteredBanks = bankAvailable.available_bank.filter((bank) => bank);
    }

    console.log("Filtered Banks:", filteredBanks); // Log the filtered data for debugging

    return apiResponse(res, 200, "Bank available", filteredBanks);
  } catch (error) {
    console.error("Server Error:", error); // Log the error for debugging
    return apiResponse(res, 500, "Server error", error.message);
  }
};

const paymentCash = async (req, res) => {
  let storeDatabase = null;
  try {
    const targetDatabase = req.get("target-database");
    const amountPaid = parseInt(req.body.amount);

    storeDatabase = await connectTargetDatabase(targetDatabase);
    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );

    const transaction = await TransactionModelStore.findOne({
      invoice: req.body.reference_id,
    });
    if (!transaction) {
      return apiResponse(res, 404, "Transaksi tidak ditemukan");
    }

    const totalPrice = transaction.product.total_price;

    if (isNaN(amountPaid)) {
      return apiResponse(
        res,
        400,
        "Jumlah uang yang dibayarkan harus berupa angka"
      );
    } else if (amountPaid < totalPrice) {
      return apiResponse(res, 400, "Jumlah uang yang dibayarkan kurang");
    }

    await createSplitRuleForNewEngine(
      req,
      transaction.total_with_fee - transaction.fee_garapin,
      0,
      transaction.invoice,
      "CASH"
    );

    const StoreModelInStoreDatabase = storeDatabase.model("Store", storeSchema);
    const storeData = await StoreModelInStoreDatabase.findOne({
      merchant_role: ["TRX", "NOT_MERCHANT"],
    });

    console.log("INI BALANCE XENDIT");
    const balanceXendit = await getXenditBalanceById(
      storeData.account_holder.id
    );

    console.log(balanceXendit);

    const updateResult = await TransactionModelStore.findOneAndUpdate(
      { invoice: req.body.reference_id },
      {
        $set: {
          id_split_rule: "",
          status: "PENDING_TRANSFER",
          payment_method: "CASH",
          payment_date: new Date(),
          webhook: {
            amount_paid: amountPaid,
            total_price: transaction.total_with_fee,
            refund: transaction.total_with_fee - amountPaid,
          },
        },
      },
      { new: true }
    );

    /// Create Invoice Inventory

    return apiResponse(res, 200, "Transaksi berhasil diperbarui", {
      invoice: updateResult,
      refund: transaction.total_with_fee - amountPaid,
    });
  } catch (error) {
    Logger.errorLog("Gagal menghubungkan ke database", error);
  }
};

const transferToXendit = async (db, transaction, source_user_id, balance) => {
  const TemplateModel = db.model(
    "Split_Payment_Rule_Id",
    splitPaymentRuleIdScheme
  );
  const template = await TemplateModel.findOne({
    invoice: transaction.invoice,
  });

  for (const route of template.routes) {
    if (route.destination_account_id !== source_user_id) {
      Logger.log(
        `Routing to ${route.destination_account_id} for transaction ${transaction.invoice}`
      );

      if (balance.data.balance >= route.flat_amount) {
        Logger.log(
          `Store ${source_user_id} has enough balance Rp ${balance.data.balance}`
        );
        await splitTransaction(route, transaction, source_user_id);
      } else {
        Logger.log(`Store ${source_user_id} has no balance`);
      }
    }

    if (route.role === "TRX" || route.role === "SUPP") {
      console.log("ROLE TRX OR SUPP");
      await transferToXenditChild(transaction, route);
    }
  }
};

const transferToXenditChild = async (transaction, routeX) => {
  console.log("Ini Reference untuk child");
  console.log(routeX.reference_id);
  const db = await connectTargetDatabase(routeX.reference_id);

  const Template = db.model("Template", templateSchema);
  const template = await Template.findOne({});

  if (template !== null && template.status_template === "ACTIVE") {
    for (const route of template.routes) {
      if (route.type === "SUPP") {
        const dbSplit = await connectTargetDatabase(route.reference_id);
        const SplitModel = dbSplit.model(
          "Split_Payment_Rule_Id",
          splitPaymentRuleIdScheme
        );
        const splitData = await SplitModel.findOne({
          invoice: transaction.invoice,
        });

        if (splitData) {
          Logger.log(
            `Routing to SUPP ${route.destination_account_id} for transaction ${transaction.invoice}`
          );
          for (const route of splitData.routes) {
            if (route.role === "SUPP" || route.role === "FEE") {
              Logger.log(
                `Routing to Child SUPP ${route.destination_account_id} for transaction ${transaction.invoice}`
              );
              await splitTransaction(
                route,
                transaction,
                route.source_account_id
              );

              if (route.role === "SUPP") {
                await transferToXenditChild(transaction, route);
              }
            }
          }
        }
      }
    }
  }
};

const splitTransaction = async (route, transaction, source_user_id) => {
  const transferBody = {
    amount: route.flat_amount,
    source_user_id: source_user_id,
    destination_user_id: route.destination_account_id,
    reference: transaction.invoice + "&&" + route.reference_id,
  };

  try {
    const postTransfer = await axios.post(
      `${XENDIT_URL}/transfers`,
      transferBody,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(XENDIT_API_KEY + ":").toString(
            "base64"
          )}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (postTransfer.status === 200) {
      Logger.log(
        `Transaction ${
          transaction.invoice + "&&" + route.reference_id
        } successfully split`
      );
    } else {
      Logger.log(
        `Failed to split transaction ${
          transaction.invoice + "&&" + route.reference_id
        }`
      );
    }
  } catch (error) {
    Logger.errorLog("Error during transaction split", error);
  }
};

const getXenditBalanceById = async (id) => {
  const url = `${XENDIT_URL}/balance`;
  return axios.get(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(XENDIT_API_KEY + ":").toString(
        "base64"
      )}`,
      "for-user-id": id,
    },
  });
};

const getSplitRuleTRXID = async (db) => {
  const splitPaymentRuleId = await connectTargetDatabase(db);
  const SplitPaymentRuleIdStore = splitPaymentRuleId.model(
    "Split_Payment_Rule_Id",
    splitPaymentRuleIdScheme
  );
  const existRuleTRX = await SplitPaymentRuleIdStore.findOne();
  if (!existRuleTRX) {
    return null;
  }
  return existRuleTRX.id;
};

const getForUserId = async (db) => {
  const database = await connectTargetDatabase(db);
  const storeModel = await database.model("Store", StoreModel.schema).findOne();
  if (!storeModel) {
    return null;
  }
  return storeModel.account_holder.id;
};

const createSplitRuleForNewEngine = async (
  req,
  totalAmount,
  totalFee,
  reference_id,
  type = null
) => {
  try {
    const accountXenGarapin = process.env.XENDIT_ACCOUNT_GARAPIN;
    const targetDatabase = req.get("target-database");
    if (!targetDatabase) {
      return null;
    }
    const db = await connectTargetDatabase(targetDatabase);

    var isStandAlone = false;

    // Get Parent DB
    const StoreModelDB = db.model("Store", storeSchema);
    const storeDB = await StoreModelDB.findOne();
    if (!storeDB) {
      return null;
    }
    var idDBParent = storeDB.id_parent;

    // If parent DB is null, then create split rule for Standalone
    if (idDBParent === null) {
      console.log("Create split untuk standalone");
      isStandAlone = true;
      idDBParent = targetDatabase;
    }

    const dbParents = await connectTargetDatabase(idDBParent);
    const TemplateModel = dbParents.model("Template", templateSchema);
    const template = await TemplateModel.findOne({ db_trx: targetDatabase });
    if (!template || template.status_template !== "ACTIVE") {
      return null;
    }

    const totalPercentAmount = template.routes.reduce(
      (acc, route) => acc + route.percent_amount,
      0
    );

    if (totalPercentAmount !== 100) {
      return null;
    }

    const totalPercentFeePos = template.routes.reduce(
      (acc, route) => acc + route.fee_pos,
      0
    );

    const feePos = totalPercentFeePos + template.fee_cust;
    if (feePos !== 100) {
      return null;
    }

    const validTemplateName = template.name.replace(/[^a-zA-Z0-9\s]/g, "");
    const data = {
      name: validTemplateName,
      description: `Pembayaran sebesar ${totalAmount}`,
      amount: totalAmount,
      routes: [],
    };

    const ConfigCost = dbParents.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();
    let garapinCost = 200; // Default COST Garapin

    for (const cost of configCost) {
      if (totalAmount >= cost.start && totalAmount <= cost.end) {
        garapinCost = cost.cost;
        break;
      }
    }
    // totalAmount -= garapinCost * (template.fee_cust / 100);

    var totalRemainingAmount = 0;
    const routesValidate = template.routes.map((route) => {
      const cost = (route.fee_pos / 100) * garapinCost;

      const calculatedFlatamount =
        Math.round(((route.percent_amount / 100) * totalAmount - cost) * 100) /
        100;

      const integerPart = Math.floor(calculatedFlatamount);
      const decimalPart = calculatedFlatamount - integerPart;
      totalRemainingAmount += decimalPart;

      return {
        percent_amount: route.percent_amount,
        fee_pos: route.fee_pos,
        flat_amount: integerPart,
        currency: route.currency,
        source_account_id:
          type === "CASH" ? storeDB.account_holder.id : accountXenGarapin,
        destination_account_id: route.destination_account_id,
        reference_id: route.reference_id,
        role: route.type,
        target: route.target,
        taxes:
          isStandAlone && route.type === "ADMIN"
            ? true
            : !isStandAlone && route.type === "TRX"
              ? true
              : false,
        totalFee:
          isStandAlone && route.type === "ADMIN"
            ? totalFee
            : !isStandAlone && route.type === "TRX"
              ? totalFee
              : 0,
        fee: cost,
      };
    });

    data.routes = routesValidate;
    const costGarapin = garapinCost + totalRemainingAmount;

    data.routes.push({
      flat_amount: Math.floor(costGarapin),
      currency: "IDR",
      source_account_id:
        type === "CASH" ? storeDB.account_holder.id : accountXenGarapin,
      destination_account_id: accountXenGarapin,
      reference_id: "garapin_pos",
      role: "FEE",
      target: "garapin",
      taxes: false,
      totalFee: 0,
      fee: 0,
    });

    const routeReponse = data.routes;

    const routeToSend = data.routes.map((route) => {
      return {
        flat_amount: route.flat_amount,
        currency: route.currency,
        destination_account_id: route.destination_account_id,
        reference_id: route.reference_id,
        role: route.role,
        taxes: route.taxes,
        totalFee: route.totalFee,
      };
    });

    for (const route of routeToSend) {
      console.log(route);

      // SAVE SPLIT RULE TO DATABASE
      const splitPaymentRuleId = await connectTargetDatabase(
        route.reference_id
      );

      if (isStandAlone) {
        if (route.role === "ADMIN") {
          const SplitPaymentRuleIdStore = splitPaymentRuleId.model(
            "Split_Payment_Rule_Id",
            splitPaymentRuleIdScheme
          );

          const splitExist = await SplitPaymentRuleIdStore.findOne({
            invoice: reference_id,
          });

          console.log(reference_id);
          if (!splitExist) {
            console.log("SAVE SPLIT RULE");
            const create = new SplitPaymentRuleIdStore({
              id: "",
              name: data.name,
              description: data.description,
              created_at: new Date(),
              updated_at: new Date(),
              id_template: template._id, // Isi dengan nilai id_template yang sesuai
              invoice: reference_id,
              amount: data.amount,
              routes: routeReponse,
            });

            const saveData = await create.save();
          }

          console.log("SPLIT RULE IS EXIST");

          if (route.role !== "ADMIN" && route.role !== "FEE") {
            if (route.role === "SUPP") {
              console.log("ADMIN STANDALONE ROUTE");
              console.log(route.flat_amount);
              console.log(totalFee);
              console.log(route.flat_amount - totalFee);
              route.flat_amount = route.flat_amount - totalFee;
            }

            /// Check if the route has a child template
            await splitRuleForChildTemplate(reference_id, route);
          }
        }
      } else {
        const SplitPaymentRuleIdStore = splitPaymentRuleId.model(
          "Split_Payment_Rule_Id",
          splitPaymentRuleIdScheme
        );

        const splitExist = await SplitPaymentRuleIdStore.findOne({
          invoice: reference_id,
        });

        console.log(reference_id);
        if (!splitExist) {
          console.log("SAVE SPLIT RULE");
          const create = new SplitPaymentRuleIdStore({
            id: "",
            name: data.name,
            description: data.description,
            created_at: new Date(),
            updated_at: new Date(),
            id_template: template._id, // Isi dengan nilai id_template yang sesuai
            invoice: reference_id,
            amount: data.amount,
            routes: routeReponse,
          });

          const saveData = await create.save();
        }

        console.log("SPLIT RULE IS EXIST");

        // Check for child template and do recursive split payment if applicable
        if (route.role !== "ADMIN" && route.role !== "FEE") {
          if (route.role === "TRX") {
            console.log("TRX ROUTE");
            console.log(route.flat_amount);
            console.log(totalFee);
            console.log(route.flat_amount - totalFee);
            route.flat_amount = route.flat_amount - totalFee;
          }

          /// Check if the route has a child template
          await splitRuleForChildTemplate(reference_id, route);
        }
      }
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "Terjadi kesalahan");
  }
};

const splitRuleForChildTemplate = async (reference_id, route) => {
  console.log("ROUTE AWAL");
  console.log(route);
  const accountXenGarapin = process.env.XENDIT_ACCOUNT_GARAPIN;
  const db = await connectTargetDatabase(route.reference_id);
  const TemplateModel = db.model("Template", templateSchema);
  const childTemplate = await TemplateModel.findOne({
    db_trx: route.reference_id,
  });
  if (childTemplate && childTemplate.status_template === "ACTIVE") {
    const validTemplateName = childTemplate.name.replace(/[^a-zA-Z0-9\s]/g, "");
    console.log("CHILD TEMPLATE FOUND");
    console.log(childTemplate);

    // Config Cost
    const ConfigCost = db.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();
    let garapinCost = 200; // Default COST Garapin

    for (const cost of configCost) {
      if (route.flat_amount >= cost.start && route.flat_amount <= cost.end) {
        garapinCost = cost.cost;
        break;
      }
    }

    const data = {
      name: validTemplateName,
      description: `Pembayaran sebesar ${route.flat_amount}`,
      amount: route.flat_amount,
      routes: [],
    };

    // Calculate for Routes
    var totalRemainingAmount = 0;
    const routesValidate = childTemplate.routes.map((routeX) => {
      console.log("PERCENT AMOUNT", routeX.percent_amount);
      console.log("FLAT AMOUNT", routeX.flat_amount);
      const cost = (routeX.fee_pos / 100) * garapinCost;

      console.log("INI ROUTE X");
      console.log(routeX);
      console.log("FLAT AMOUNT", route.flat_amount);

      const calculatedFlatamount =
        Math.round(
          ((routeX.percent_amount / 100) * route.flat_amount - cost) * 100
        ) / 100;

      const integerPart = Math.floor(calculatedFlatamount);
      const decimalPart = calculatedFlatamount - integerPart;
      totalRemainingAmount += decimalPart;

      return {
        percent_amount: routeX.percent_amount,
        fee_pos: routeX.fee_pos,
        flat_amount: integerPart,
        currency: routeX.currency,
        source_account_id: route.destination_account_id,
        destination_account_id: routeX.destination_account_id,
        reference_id: routeX.reference_id,
        role: routeX.type,
        target: routeX.target,
        fee: cost,
        taxes: false,
        totalFee: 0,
      };
    });

    data.routes = routesValidate;
    const costGarapin = garapinCost;
    data.routes.push({
      flat_amount: Math.floor(costGarapin),
      currency: "IDR",
      source_account_id: route.destination_account_id,
      destination_account_id: accountXenGarapin,
      reference_id: `garapin_pos&&${route.reference_id}`,
      role: "FEE",
      target: "garapin",
      fee: 0,
      taxes: false,
      totalFee: 0,
    });

    const routeReponse = data.routes;

    const routeToSend = data.routes.map((route) => {
      return {
        percent_amount: route.percent_amount,
        fee_pos: route.fee_pos,
        flat_amount: route.flat_amount,
        currency: route.currency,
        destination_account_id: route.destination_account_id,
        reference_id: route.reference_id,
        role: route.role,
        taxes: route.taxes,
        totalFee: route.totalFee,
      };
    });

    for (const childRoute of routeToSend) {
      if (
        childRoute.role !== "ADMIN" &&
        childRoute.role !== "FEE" &&
        childRoute.role !== "TRX"
      ) {
        const dbRoute = await connectTargetDatabase(childRoute.reference_id);
        const SplitPaymentRuleIdStore = dbRoute.model(
          "Split_Payment_Rule_Id",
          splitPaymentRuleIdScheme
        );

        const splitExist = await SplitPaymentRuleIdStore.findOne({
          invoice: reference_id,
        });

        if (!splitExist) {
          console.log("SAVE SPLIT RULE");
          const create = new SplitPaymentRuleIdStore({
            id: "",
            name: data.name,
            description: data.description,
            created_at: new Date(),
            updated_at: new Date(),
            id_template: childTemplate._id, // Isi dengan nilai id_template yang sesuai
            invoice: reference_id,
            amount: data.amount,
            routes: data.routes,
          });

          await create.save();
        } else {
          console.log("UPDATE SPLIT CHILD");
          const update = {
            id: "",
            name: data.name,
            description: data.description,
            created_at: new Date(),
            updated_at: new Date(),
            id_template: childTemplate._id, // Isi dengan nilai id_template yang sesuai
            invoice: reference_id,
            amount: data.amount,
            routes: routeReponse,
          };

          await SplitPaymentRuleIdStore.findOneAndUpdate(
            { invoice: reference_id },
            update,
            { new: true }
          );
        }

        // Check for child template and do recursive split payment if applicable
        await splitRuleForChildTemplate(reference_id, childRoute);
        // if (routeToSend.role === "SUPP") {
        //   /// Check if the route has a child template
        //   console.log("INI CHILD ROUTE");
        //   console.log(routeToSend);
        //   console.log(reference_id);
        //   await splitRuleForChildTemplate(reference_id, childRoute);
        // }
      }
    }
  }
  return null;
};

//test hitung garapin
const testGarapinCost = async (req, res) => {
  const dbParents = await connectTargetDatabase("bs-partnet_38155ef8-1ed");
  const ConfigCost = dbParents.model("config_cost", configCostSchema);
  const configCost = await ConfigCost.find();
  const totalAmount = 1000;
  let garapinCost = 200; //default
  for (const cost of configCost) {
    if (totalAmount >= cost.start && totalAmount <= cost.end) {
      garapinCost = cost.cost;
      break;
    }
  }

  return apiResponse(res, 200, "nilai cost", garapinCost);
};

const getAmountFromPendingTransaction = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const garapinDB = await connectTargetDatabase("garapin_pos");

    const TransactionModel = storeDatabase.model(
      "Transaction",
      transactionSchema
    );

    const ConfigCost = garapinDB.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();

    const configTransaction = await ConfigTransactionModel.findOne({
      type: "QRIS",
    });

    const pendingTransactions = await TransactionModel.find({
      status: "PENDING_TRANSFER",
      payment_method: "CASH",
    });

    var totalPendingAmount = 0;
    for (const pendingTransaction of pendingTransactions) {
      totalPendingAmount += pendingTransaction.total_with_fee;
    }

    const feeBank = Math.round(
      totalPendingAmount * (configTransaction.fee_percent / 100)
    );

    const vat = Math.round(feeBank * (configTransaction.vat_percent / 100));

    return apiResponse(res, 200, "Success", {
      amount: totalPendingAmount,
      quickReleaseCost: configCost[0].cost_quick_release,
      feeUsingQR: feeBank + vat,
      feeUsingVA: 4440,
      totalPaymentUsingQR:
        totalPendingAmount + configCost[0].cost_quick_release + feeBank + vat,
      totalPaymentUsingVA:
        totalPendingAmount + configCost[0].cost_quick_release + 4440,
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "Terjadi kesalahan");
  }
};

export default {
  createInvoice,
  createInvoiceTopUp,
  createQrCode,
  createQrCodePaymentLockedAccount,
  createVirtualAccountPaymentLockedAccount,
  getQrCode,
  xenditWebhook,
  getInvoices,
  cancelInvoices,
  xenPlatformWebhook,
  createEwallet,
  createVirtualAccount,
  webhookVirtualAccount,
  paymentAvailable,
  paymentCash,
  testGarapinCost,
  createSplitRuleForNewEngine,
  getXenditBalanceById,
  getAmountFromPendingTransaction,
};
