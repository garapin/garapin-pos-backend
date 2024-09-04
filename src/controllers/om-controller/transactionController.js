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
// import moment from "moment";
import moment from "moment-timezone";
import { getNumberOfDays } from "../../utils/getNumberOfDays.js";
import { cartRakSchema } from "../../models/cartRakModel.js";
import { configSettingSchema } from "../../models/configSetting.js";
import { configAppForPOSSchema } from "../../models/configAppModel.js";
import { configAppSchema } from "../../models/configAppModel.js";
import timetools from "../../utils/timetools.js";
import { ProductModel, productSchema } from "../../models/productModel.js";
import {
  TransactionModel,
  transactionSchema,
} from "../../models/transactionModel.js";
import { storeSchema } from "../../models/storeModel.js";
import { ConfigCostModel, configCostSchema } from "../../models/configCost.js";
import { CartModel, cartSchema } from "../../models/cartModel.js";
// import { updateStockCard } from "../../models/stockCardModel.js";

// const xenditClient = new Xendit({ secretKey: process.env.XENDIT_API_KEY });
const timezones = Intl.DateTimeFormat().resolvedOptions().timeZone;
const clientUrl = process.env.CLIENT_URL;
const xenditInvoiceClient = new InvoiceClient({
  secretKey: process.env.XENDIT_API_KEY,
});
const createTransaction = async (req, res, next) => {
  const { db_user, list_rak, payer_email, payer_name } = req?.body;

  // console.log(list_rak);

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
    const ConfigAppModel = storeDatabase.model(
      "config_app",
      configAppForPOSSchema
    );

    const configApp = await ConfigAppModel.findOne();
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

      // console.log(position.name_position,);

      if (!position) {
        return sendResponse(res, 400, `Position not found `, null);
      }

      if (position.status === STATUS_POSITION.RENTED) {
        return sendResponse(
          res,
          400,
          `Rak at position ${position.name_position} is already rented `,
          null
        );
      }

      if (position.status === STATUS_POSITION.UNPAID) {
        return sendResponse(
          res,
          400,
          `Rak at position ${position.name_position} is unpaid`,
          null
        );
      }

      const minimum_rent_date = configApp.minimum_rent_date;
      const number_of_days = element.total_date;
      const price = rak.price_perday * number_of_days;

      if (number_of_days < minimum_rent_date) {
        return sendResponse(
          res,
          400,
          `Sewa Rak Minimum ${minimum_rent_date} days`,
          null
        );
      }

      const now = moment().tz("GMT");

      const _available = moment(position.available_date).tz("GMT");
      const start_date =
        position.available_date >= now ? position.available_date : now;
      const end_date =
        position.available_date >= now
          ? _available.add(number_of_days, "days").toDate()
          : now.add(number_of_days, "days").toDate();

      const available_date = moment(end_date)
        .tz("GMT")
        .add(1, "second")
        .toDate();

      element.start_date = start_date;
      element.end_date = end_date;
      element.available_date = available_date;
      // position.available_date = available_date;

      console.log(element);
      // xxx;

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

    const timestamp = new Date().getTime();
    const generateInvoice = `INV-${timestamp}`;

    const customer = {
      email: payer_email,
      givenNames: payer_name,
    };

    const ConfigApp = await ConfigAppModel.find({});

    const data = {
      payerEmail: payer_email,
      amount: total_harga,
      invoiceDuration: ConfigApp[0]["payment_duration"],
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
        const positionUpdate = rakTransaction.list_rak.find(
          (x) => x.position === element.position
        );
        const available_date = moment(positionUpdate.end_date)
          .tz(timezones)
          .add(1, "second")
          .toDate();

        position.status = STATUS_POSITION.UNPAID;

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
  }
};

const creatInvoiceOneMartCustomer = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const timestamp = new Date().getTime();
    const generateInvoice = `INV-${timestamp}`;
    const idXenplatform = await getForUserId(targetDatabase);
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const StoreModelData = storeDatabase.model("Store", storeSchema);
    const storeModelData = await StoreModelData.findOne();
    const productModelStore = storeDatabase.model("Product", productSchema);
    const ConfigAppModel = storeDatabase.model(
      "config_app",
      configAppForPOSSchema
    );

    const items = [];
    const items2 = [];
    const configApp = await ConfigAppModel.findOne();
    // console.log(req.body);
    for (const item of req.body.items) {
      const product = await productModelStore.findById(item.productId);
      // product.rak_id = item.rakId;
      // product.position_id = item.positionId;
      // product.save();

      items2.push({
        product: product,
        quantity: item.quantity,
      });
      items.push({
        name: product.name,
        quantity: item.quantity,
        price: product.price,
        referenceId: item.productId,
        category: item.category,
      });
    }

    const cartModelStore = storeDatabase.model("Cart", cartSchema);
    let cart = new cartModelStore({
      user: "66d0b17b6301661ba313e7ac",
      items: items2,
      total_price: req.body.total,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __v: 0,
    });

    // cart.push(items2);
    // console.log(cart);
    // console.log(cart);

    const customer = {
      email: req.body.email,
      givenNames: req.body.email,
    };
    const externalId = `${generateInvoice}&${targetDatabase}`;
    const data = {
      payerEmail: req.body.email,
      amount: req.body.total,
      invoiceDuration: configApp["payment_duration"],
      invoiceLabel: generateInvoice,
      externalId: externalId,
      description: `Membuat invoice ${generateInvoice}`,
      currency: "IDR",
      reminderTime: 1,
      items: items,
      customer,
      shouldSendEmail: true,
      successRedirectUrl:
        clientUrl +
        "/receipt/?status=success&invoice=" +
        generateInvoice +
        "&merchant=" +
        targetDatabase,
      failureRedirectUrl:
        clientUrl +
        "/receipt/?status=failure&invoice=" +
        generateInvoice +
        "&merchant=" +
        targetDatabase,
    };
    console.log(data);

    const invoice = await xenditInvoiceClient.createInvoice({
      data,
      forUserId: idXenplatform.account_holder.id,
    });
    // console.log(invoice);
    const feePos = await getFeePos(
      req.body.total,
      storeModelData.id_parent,
      targetDatabase
    );
    const totalWithFee = req.body.total + feePos;

    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );

    const addTransaction = new TransactionModelStore({
      product: cart.toObject(),
      invoice: invoice.externalId,
      invoice_label: data.invoiceLabel,
      status: "PENDING",
      fee_garapin: feePos,
      total_with_fee: totalWithFee,
      settlement_status: "NOT_SETTLED",
      inventory_status: "RAKU_OUT",
      // invoice: invoice,
    });
    const response = await addTransaction.save();

    return apiResponse(res, 200, "Sukses membuat invoice", {
      response,
      invoice,
    });
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return apiResponse(res, 400, "error", response.data);
  }
};

const detailTransaction = async (req, res) => {
  // const invoicelable = req.body.invoicelable;
  const targetDatabase = req.get("target-database");
  const storeDatabase = await connectTargetDatabase(targetDatabase);
  const TransactionModelStore = storeDatabase.model(
    "Transaction",
    transactionSchema
  );
  const idXenplatform = await getForUserId(targetDatabase);
  if (!idXenplatform) {
    return sendResponse(res, 400, "for-user-id kosong");
  }
  // console.log(invoicelable);

  const transaction = await TransactionModelStore.findOne({
    invoice: req.body.invoice,
  });
  // console.log(transaction.webhook.id);

  const invoices = await xenditInvoiceClient.getInvoices({
    externalId: req.body.invoice,
    forUserId: idXenplatform.account_holder.id,
  });
  // console.log(invoices);

  // const invoice = await xenditInvoiceClient.getInvoices({
  //   invoiceId: transaction.webhook.id,
  //   forUserId: idXenplatform.account_holder.id,
  // });

  console.log(req.body.reducestock);

  transaction.status = invoices[0].status;

  if (req.body.reducestock) {
    if (invoices[0].status === "PAID" || invoices[0].status === "SETTLED") {
      for (const item of invoices[0].items) {
        const productModelStore = storeDatabase.model("Product", productSchema);
        const product = await productModelStore.findOne({
          _id: item.referenceId,
        });
        product.subtractStock(
          item.quantity,
          targetDatabase,
          "Raku Out" + item.referenceId
        );
        // console.log(item.referenceId);
      }
    }
  }

  // transaction.webhook = invoice;
  transaction.save();

  return sendResponse(res, 200, "Sukses", {
    invoice: invoices[0],
  });
};
const getFeePos = async (totalAmount, idParent, targetDatabase) => {
  const garapinDB = await connectTargetDatabase("garapin_pos");

  const ConfigCost = garapinDB.model("config_cost", configCostSchema);
  const configCost = await ConfigCost.find();
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

const checkBeforePayment = async (req, res) => {
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
  const PositionModel = storeDatabase.model("position", positionSchema);
  const RentModelStore = storeDatabase.model("rent", rentSchema);

  const rakTransaction = await RakTransactionModelStore.findById({
    _id: transaction_id,
  });

  if (!rakTransaction) {
    return sendResponse(res, 404, "Transaction not found");
  }
  if (rakTransaction.payment_status === "PAID") {
    return sendResponse(res, 400, "Transaction already paid");
  }
  // if (rakTransaction.payment_status === "EXPIRED") {
  //   return sendResponse(res, 400, "Transaction expired",);

  // }

  if (timetools.isExpired(rakTransaction.xendit_info.expiryDate)) {
    console.log("timetools.isExpired");

    return sendResponse(res, 400, "Transaction expired");
  }

  rakTransaction.list_rak.forEach(async (element) => {
    const rak = await rakModelStore.findById(element.rak);
    if (!rak) {
      return sendResponse(res, 400, "Rak not found", null);
    }
    const position = await PositionModel.findById(element.position);
    if (!position) {
      return sendResponse(res, 400, "Position not found", null);
    }
    if (position.status === STATUS_POSITION.UNPAID) {
      return sendResponse(
        res,
        200,
        `Rak at position ${position.name_position} is still unpaid`,
        rakTransaction.xendit_info.invoiceUrl
      );
    } else {
      return sendResponse(
        res,
        400,
        `Rak at position ${position.name_position} is  ${position.status} `,
        false
      );
    }
  });
};

const updateAlreadyPaidDTransaction = async (req, res, next) => {
  const { transaction_id } = req?.body;

  const targetDatabase = req.get("target-database");

  const storeDatabase = await connectTargetDatabase(targetDatabase);

  const ConfigAppModel = storeDatabase.model(
    "config_app",
    configAppForPOSSchema
  );

  const configApp = await ConfigAppModel.findOne();

  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", {});
  }

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

    const today = moment().tz("GMT").format();
    if (rakTransaction) {
      for (const element of rakTransaction.list_rak) {
        const position = await PositionModel.findById(element.position);

        const available_date = moment(element.end_date)
          .tz(timezones)
          .add(1, "second")
          .toDate();

        if (position.status === STATUS_POSITION.UNPAID) {
          if (timetools.isIncoming(element.end_date, configApp.due_date)) {
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

        await RentModelStore.create({
          rak: element.rak,
          position: element.position,
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

const getTransactionbyPositionId = async (req, res) => {
  const params = req?.query;
  const targetDatabase = req.get("target-database");
  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", null);
  }
  const storeDatabase = await connectTargetDatabase(targetDatabase);
  try {
    const TransactionModelStore = storeDatabase.model(
      "Transaction",
      transactionSchema
    );
    if (!params?.position_id) {
      throw new Error(`Please provided position id`);
    }

    const position_id = params?.position_id;
    var transaksi_detail = await TransactionModelStore.find({
      position: position_id,
    })
      .populate("rak")
      .populate("db_user");
    if (!transaksi_detail || transaksi_detail.length === 0) {
      return sendResponse(res, 400, "Transaction not found", null);
    }
  } catch (error) {
    console.error("Error getting Get transaction:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

export default {
  createTransaction,
  getAllTransactionByUser,
  updateAlreadyPaidDTransaction,
  checkBeforePayment,
  creatInvoiceOneMartCustomer,
  detailTransaction,
};
