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

import moment from "moment";

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
    const amountToSubtract = (template.fee_cust / 100) * garapinCost;
    console.log(amountToSubtract);
    return amountToSubtract;
  }
};

const getInvoices = async (req, res) => {
  try {
    const inv = req.params.id;
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
    const feeBank = Math.floor(
      req.body.amount * (configTransaction.fee_percent / 100)
    );
    const vat = Math.floor(feeBank * (configTransaction.vat_percent / 100));

    const TransactionModel = database.model("Transaction", transactionSchema);
    const invoces = await TransactionModel.findOneAndUpdate(
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
    const idXenplatform = await getForUserId(targetDatabase);
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
    const withSplitRule = await createSplitRule(
      req,
      data.amount,
      req.body.reference_id
    );
    const headers = {
      "api-version": "2022-07-31",
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
      // 'with-split-rule': withSplitRule,
      // 'webhook-url' : `${XENDIT_WEBHOOK_URL}/webhook/${req.body.reference_id}/${targetDatabase}`
      "webhook-url": `${XENDIT_WEBHOOK_URL}/webhook/${targetDatabase}`,
    };
    if (withSplitRule !== null) {
      headers["with-split-rule"] = withSplitRule.id;
      invoces.id_split_rule = withSplitRule.id;
      invoces.save();
    }
    const response = await axios.post(endpoint, data, { headers });
    return apiResponse(res, 200, "Sukses membuat qrcode", response.data);
  } catch (error) {
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

    const idXenplatform = await getForUserId(targetDatabase);
    if (!idXenplatform) {
      return apiResponse(res, 400, "for-user-id kosong");
    }
    const endpoint = "https://api.xendit.co/callback_virtual_accounts";

    const withSplitRule = await createSplitRule(
      req,
      invoces.total_with_fee,
      invoces.product.invoice
    );
    console.log(withSplitRule);
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      "for-user-id": idXenplatform,
    };
    if (withSplitRule !== null) {
      headers["with-split-rule"] = withSplitRule.id;
      invoces.id_split_rule = withSplitRule.id;
      invoces.save();
    }

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

    if (eventData.event === "qr.payment") {
      const paymentData = eventData.data;
      const referenceId = paymentData.reference_id;
      const paymentAmount = paymentData.amount;
      const currency = paymentData.currency;
      const paymentStatus = paymentData.status;
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
    }
    res.status(200).end();
  } catch (error) {
    console.error("Error handling Xendit webhook:", error);
    res.status(500).end();
  }
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

    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );
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
  const bankAvailable = await PaymentMethodModel.findOne();
  return apiResponse(res, 200, "bank available", bankAvailable.available_bank);
};
const paymentCash = async (req, res) => {
  const targetDatabase = req.get("target-database");
  const amountPaid = parseInt(req.body.amount);

  const storeDatabase = await connectTargetDatabase(targetDatabase);
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

  const updateResult = await TransactionModelStore.findOneAndUpdate(
    { invoice: req.body.reference_id },
    {
      $set: {
        status: "SUCCEEDED",
        payment_method: "CASH",
        payment_date: new Date(),
        webhook: {
          amount_paid: amountPaid,
          total_price: totalPrice,
          refund: totalPrice - amountPaid,
        },
      },
    },
    { new: true }
  );

  return apiResponse(res, 200, "Transaksi berhasil diperbarui", {
    invoice: updateResult,
    refund: totalPrice - amountPaid,
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

const createSplitRule = async (req, totalAmount, reference_id) => {
  try {
    const accountXenGarapin = process.env.XENDIT_ACCOUNT_GARAPIN;
    const apiKey = XENDIT_API_KEY;
    const targetDatabase = req.get("target-database");
    if (!targetDatabase) {
      return null;
    }
    const db = await connectTargetDatabase(targetDatabase);
    //get Parent DB
    const StoreModelDb = db.model("Store", storeSchema);
    const storeDb = await StoreModelDb.findOne();
    if (!storeDb) {
      return null;
    }
    const idDbParent = storeDb.id_parent;
    if (idDbParent === null) {
      const data = {
        name: `garapin ${reference_id}`,
        description: `Pembayaran sebesar ${totalAmount}`,
        routes: [],
      };
      const configCost = await ConfigCostModel.find();
      let garapinCost = 200; //default
      for (const cost of configCost) {
        if (totalAmount >= cost.start && totalAmount <= cost.end) {
          garapinCost = cost.cost;
          break;
        }
      }
      data.routes.push({
        flat_amount: Math.floor(totalAmount - garapinCost),
        currency: "IDR",
        destination_account_id: storeDb.account_holder.id,
        reference_id: targetDatabase,
        role: storeDb.merchant_role,
        target: storeDb.store_name,
        fee: 0,
      });
      const costGarapin = garapinCost;
      data.routes.push({
        flat_amount: Math.floor(costGarapin),
        currency: "IDR",
        destination_account_id: accountXenGarapin,
        reference_id: "garapin_pos",
        role: "FEE",
        target: "garapin",
        fee: 0,
      });
      const routeToSend = data.routes.map((route) => {
        return {
          flat_amount: route.flat_amount,
          currency: route.currency,
          destination_account_id: route.destination_account_id,
          reference_id: route.reference_id,
        };
      });
      const dataToSend = {
        name: data.name.replace(/[^a-zA-Z0-9\s]/g, ""),
        description: data.description,
        routes: routeToSend,
      };
      const endpoint = "https://api.xendit.co/split_rules";
      const headers = {
        Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
      };
      const response = await axios.post(endpoint, dataToSend, { headers });
      return response.data;
    }
    //template dari id parent
    const dbParents = await connectTargetDatabase(idDbParent);
    const TemplateModel = dbParents.model("Template", templateSchema);
    const template = await TemplateModel.findOne({ db_trx: targetDatabase });
    if (!template) {
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
    console.log("ini feee pos");
    console.log(feePos);
    if (feePos !== 100) {
      return null;
    }

    const validTemplateName = template.name.replace(/[^a-zA-Z0-9\s]/g, "");
    const data = {
      name: validTemplateName,
      description: `Pembayaran sebesar ${totalAmount}`,
      routes: [],
    };
    const ConfigCost = dbParents.model("config_cost", configCostSchema);
    const configCost = await ConfigCost.find();
    let garapinCost = 200; //default
    for (const cost of configCost) {
      if (totalAmount >= cost.start && totalAmount <= cost.end) {
        garapinCost = cost.cost;
        break;
      }
    }
    totalAmount -= garapinCost * (template.fee_cust / 100);

    var totalRemainingAmount = 0;
    const routesValidate = template.routes.map((route) => {
      const cost = (route.fee_pos / 100) * garapinCost;
      const calculatedFlatamount =
        (route.percent_amount / 100) * totalAmount - cost;
      console.log("total amount awal", calculatedFlatamount);
      const integerPart = Math.floor(calculatedFlatamount);
      console.log("total amount tanpa desimal", integerPart);
      const decimalPart = calculatedFlatamount - integerPart;
      console.log("bagian desimal", decimalPart);
      totalRemainingAmount += decimalPart;
      console.log("hasil dari semua desimal", totalRemainingAmount);
      return {
        flat_amount: integerPart,
        currency: route.currency,
        destination_account_id: route.destination_account_id,
        reference_id: route.reference_id,
        role: route.type,
        target: route.target,
        fee: cost,
      };
    });

    data.routes = routesValidate;
    const costGarapin = garapinCost + totalRemainingAmount;
    data.routes.push({
      // 'flat_amount': garapinCost + totalRemainingAmount,
      flat_amount: Math.floor(costGarapin),
      currency: "IDR",
      destination_account_id: accountXenGarapin,
      reference_id: "garapin_pos",
      role: "FEE",
      target: "garapin",
      fee: 0,
    });

    const routeReponse = data.routes;

    const routeToSend = data.routes.map((route) => {
      return {
        flat_amount: route.flat_amount,
        currency: route.currency,
        destination_account_id: route.destination_account_id,
        reference_id: route.reference_id,
      };
    });
    const dataToSend = {
      name: data.name,
      description: data.description,
      routes: routeToSend,
    };

    const endpoint = "https://api.xendit.co/split_rules";
    const headers = {
      Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
    };
    const response = await axios.post(endpoint, dataToSend, { headers });
    console.log(response.status);
    if (response.status === 200) {
      for (const route of response.data.routes) {
        const splitPaymentRuleId = await connectTargetDatabase(
          route.reference_id
        );

        const SplitPaymentRuleIdStore = splitPaymentRuleId.model(
          "Split_Payment_Rule_Id",
          splitPaymentRuleIdScheme
        );
        const splitExist = await SplitPaymentRuleIdStore.findOne({
          invoice: reference_id,
        });
        if (!splitExist) {
          console.log(response.status);
          console.log("belum ada split rule");
          const create = new SplitPaymentRuleIdStore({
            id: response.data.id,
            name: response.data.name,
            description: response.data.description,
            created_at: response.data.created_at,
            updated_at: response.data.updated_at,
            id_template: template._id, // Isi dengan nilai id_template yang sesuai
            invoice: reference_id,
            routes: routeReponse,
          });
          const saveData = await create.save();
        }
        console.log("sudah ada split rule");
      }

      return response.data;
    }
    return null;
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "Terjadi kesalahan");
  }
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

export default {
  createInvoice,
  createQrCode,
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
};
