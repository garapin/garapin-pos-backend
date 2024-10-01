import moment from "moment";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { STATUS_POSITION, positionSchema } from "../../models/positionModel.js";
import { rakSchema } from "../../models/rakModel.js";
import {
  PAYMENT_STATUS_RAK,
  rakTransactionSchema,
} from "../../models/rakTransactionModel.js";
import { rentSchema } from "../../models/rentModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { UserModel } from "../../models/userModel.js";
import { configAppForPOSSchema } from "../../models/configAppModel.js";
import timetools from "../../utils/timetools.js";
import {
  TransactionModel,
  transactionSchema,
} from "../../models/transactionModel.js";
import { ProductModel, productSchema } from "../../models/productModel.js";
import { Xendit, Invoice as InvoiceClient } from "xendit-node";
import { ConfigTransactionModel } from "../../models/configTransaction.js";
import { storeSchema } from "../../models/storeModel.js";
import { templateSchema } from "../../models/templateModel.js";
import { configCostSchema } from "../../models/configCost.js";
import { splitPaymentRuleIdScheme } from "../../models/splitPaymentRuleIdModel.js";
import calculateFee from "../../utils/fee.js";

const XENDIT_WEBHOOK_TOKEN = process.env.XENDIT_WEBHOOK_TOKEN;
const timezones = Intl.DateTimeFormat().resolvedOptions().timeZone;
// const xenditInvoiceClient = new InvoiceClient({
//   secretKey: process.env.XENDIT_API_KEY,
// });

// const XENDIT_ACCOUNT_GARAPIN = process.env.XENDIT_ACCOUNT_GARAPIN;

const invoiceCallback = async (req, res) => {
  const callback = req?.body;
  const headerCallback = req?.headers;

  // console.log(headerCallback["x-callback-token"]);

  if (headerCallback["x-callback-token"] !== XENDIT_WEBHOOK_TOKEN) {
    console.log("CALLBACK TOKEN INVALID");
    return sendResponse(res, 400, "CALLBACK TOKEN INVALID", {});
  }

  console.log("====================================");
  console.log(callback);
  console.log("====================================");

  const str = callback.external_id;
  const parts = str.split("&&");
  const invoice = parts[0];
  // const targetDatabase = "Test_store_keempat_eb77c7d1-4a8";
  const targetDatabase = parts[1];
  const type = parts[2];

  // console.log({ parts });
  if (!targetDatabase) {
    return sendResponse(res, 400, "Target database is not specified", {});
  }

  if (type === "RAKU") {
    callbackRaku(targetDatabase, callback);
  } else if (type === "POS") {
    console.log("====================================");
    console.log(pos);
    console.log("====================================");
  } else if (type === "RAK") {
    callbackRak(targetDatabase, callback);
  }

  try {
    // const targetDatabase = req.get("target-database");
  } catch (error) {
    console.error("Error getting Create position:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
  }
};

async function callbackRaku(targetDatabase, callback) {
  const storeDatabase = await connectTargetDatabase(targetDatabase);
  const TransactionModelStore = storeDatabase.model(
    "Transaction",
    transactionSchema
  );

  // console.log(targetDatabase);
  // console.log(invoice);
  // const idXenplatform = await getForUserId(targetDatabase);
  // if (!idXenplatform) {
  //   return sendResponse(res, 400, "for-user-id kosong");
  // }
  // console.log(invoicelable);

  const transaction = await TransactionModelStore.findOne({
    invoice: callback.external_id,
  });

  if (!transaction) {
    return false;
  }
  // console.log(transaction.webhook.id);

  // const invoices = await xenditInvoiceClient.getInvoices({
  //   externalId: invoice,
  //   forUserId: XENDIT_ACCOUNT_GARAPIN,
  // });
  // // console.log(invoices);

  // const invoice = await xenditInvoiceClient.getInvoices({
  //   invoiceId: transaction.webhook.id,
  //   forUserId: idXenplatform.account_holder.id,
  // });

  // console.log(invoices);

  transaction.status = callback.status;
  transaction.payment_method = callback.payment_method;
  transaction.payment_date = callback.paid_at;
  transaction.save();

  const paymentmethod = callback.payment_method === "QR_CODE" ? "QRIS" : "VA";

  const fee = await calculateFee(transaction.total_with_fee, paymentmethod);
  console.log("====================================");
  console.log(paymentmethod);
  console.log(fee);
  console.log("====================================");
  // Buat objek req manual

  try {
    const withSplitRule = await createSplitRuleForNewEngine(
      targetDatabase,
      transaction.total_with_fee,
      fee,
      transaction.invoice
    );

    console.log("====================================");
    console.log(withSplitRule);
    console.log("====================================");
  } catch (error) {
    console.log("====================================");
    console.log(error);
    console.log("====================================");
  }

  if (transaction.status == "PAID" || transaction.status == "SETTLED") {
    for (const item of transaction.product.items) {
      const productModelStore = storeDatabase.model("Product", productSchema);
      const product = await productModelStore.findOne({
        _id: item.product,
      });
      product.subtractStock(
        item.quantity,
        targetDatabase,
        "Raku Out " + transaction.invoice
      );

      const supDb = product.db_user;
      const supStoreDb = await connectTargetDatabase(supDb);
      const productModelStoresup = supStoreDb.model("Product", productSchema);
      const productOnSupplier = await productModelStoresup.findOne({
        _id: product.inventory_id,
      });

      // console.log(productOnSupplier);

      productOnSupplier.subtractStock(
        item.quantity,
        supDb,
        "Raku Out " + transaction.invoice
      );

      // console.log(item.referenceId);
    }
  }
  // transaction.webhook = invoice;

  // return sendResponse(res, 200, "Sukses", {
  //   invoice: invoices[0],
  // });
}

async function callbackRak(targetDatabase, callback) {
  const today = moment().tz("GMT").format();
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  const ConfigAppModel = storeDatabase.model(
    "config_app",
    configAppForPOSSchema
  );

  const configApp = await ConfigAppModel.findOne();

  const RakTransactionModelStore = storeDatabase.model(
    "rakTransaction",
    rakTransactionSchema
  );
  const rakModelStore = storeDatabase.model("rak", rakSchema);
  const RentModelStore = storeDatabase.model("rent", rentSchema);
  const PositionModel = storeDatabase.model("position", positionSchema);
  const ProductModel = storeDatabase.model("product", productSchema);

  const rakTransaction = await RakTransactionModelStore.findOne({
    invoice: callback.external_id,
  });

  if (!rakTransaction) {
    false;
  }

  if (rakTransaction.payment_status !== "PENDING") {
    false;
  }

  // xxx;
  if (rakTransaction) {
    for (const element of rakTransaction.list_rak) {
      if (callback.status === "EXPIRED") {
        const position = await PositionModel.findById(element.position);
        if (position.status === STATUS_POSITION.UNPAID) {
          if (position.end_date) {
            position.status = timetools.isIncoming(position, configApp.due_date)
              ? STATUS_POSITION.INCOMING
              : STATUS_POSITION.RENTED;
          } else {
            position.status = STATUS_POSITION.AVAILABLE;
            position.available_date = today;
            position.start_date = null;
            position.end_date = null;
          }
          position.save();
        }
      } else if (callback.status === "PAID") {
        const position = await PositionModel.findById(element.position);

        const available_date = moment(element.end_date)
          .tz(timezones)
          .add(1, "second")
          .toDate();

        if (position.status === STATUS_POSITION.UNPAID) {
          if (timetools.isIncoming(element, configApp.due_date)) {
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

        // findoldproduct
        try {
          const produkYangDiupdate = await ProductModel.findOneAndUpdate(
            {
              position_id: { $in: [element.position] }, // Menggunakan $in untuk mencari nilai dalam array
              db_user: rakTransaction.db_user,
              stock: { $gt: 0 }, // Menambahkan kondisi stock harus lebih dari 0
            },
            { status: "ACTIVE" },
            { new: true } // Opsi ini mengembalikan dokumen yang sudah diupdate
          );
          console.log("====================================");
          console.log(produkYangDiupdate);
          console.log("====================================");
        } catch (error) {
          console.log(error);
        }

        // position["start_date"] = element.start_date;
        // position["end_date"] = element.end_date;
        // position["available_date"] = available_date;
        // position["status"] = STATUS_POSITION.RENTED;

        const rentsss = await RentModelStore.create({
          rak: element.rak,
          position: element.position,
          start_date: element.start_date,
          end_date: element.end_date,
          db_user: rakTransaction.db_user,
        });

        console.log(rentsss);

        await position.save();
      }
    }
  }

  rakTransaction.payment_status = callback.status;
  rakTransaction.payment_method = callback.payment_method;
  rakTransaction.payment_channel = callback.payment_channel;
  rakTransaction.payment_date = callback.paid_at;

  const paymentmethod = callback.payment_method === "QR_CODE" ? "QRIS" : "VA";

  const fee = await calculateFee(rakTransaction.total_harga, paymentmethod);
  console.log("====================================");
  console.log(paymentmethod);
  console.log(fee);
  console.log("====================================");
  // Buat objek req manual

  try {
    const withSplitRule = await createSplitRuleForNewEngine(
      targetDatabase,
      rakTransaction.total_harga,
      fee,
      rakTransaction.invoice
    );

    console.log("====================================");
    console.log(withSplitRule);
    console.log("====================================");
  } catch (error) {
    console.log("====================================");
    console.log(error);
    console.log("====================================");
  }

  await rakTransaction.save();
}

async function callbackTest(req, res) {
  const targetDatabase = req.get("target-database");
  const today = moment().tz("GMT").format();
  const storeDatabase = await connectTargetDatabase(targetDatabase);

  const ConfigAppModel = storeDatabase.model(
    "config_app",
    configAppForPOSSchema
  );

  const configApp = await ConfigAppModel.findOne();

  const RakTransactionModelStore = storeDatabase.model(
    "rakTransaction",
    rakTransactionSchema
  );
  const rakModelStore = storeDatabase.model("rak", rakSchema);
  const RentModelStore = storeDatabase.model("rent", rentSchema);
  const PositionModel = storeDatabase.model("position", positionSchema);
  const ProductModel = storeDatabase.model("product", productSchema);

  const rakTransaction = await RakTransactionModelStore.findOne({
    invoice: req.body.external_id,
  });
  // console.log(rakTransaction);
  // xxx;
  if (!rakTransaction) {
    false;
  }

  // console.log(rakTransaction);
  // xxx;

  if (rakTransaction.payment_status !== "PENDING") {
    false;
  }

  // xxx;
  if (rakTransaction) {
    for (const element of rakTransaction.list_rak) {
      if (req.body.status === "EXPIRED") {
        const position = await PositionModel.findById(element.position);
        if (position.status === STATUS_POSITION.UNPAID) {
          if (position.end_date) {
            position.status = timetools.isIncoming(position, configApp.due_date)
              ? STATUS_POSITION.INCOMING
              : STATUS_POSITION.RENTED;
          } else {
            position.status = STATUS_POSITION.AVAILABLE;
            position.available_date = today;
            position.start_date = null;
            position.end_date = null;
          }
          position.save();
        }
      } else if (req.body.status === "PAID") {
        const position = await PositionModel.findById(element.position);

        const available_date = moment(element.end_date)
          .tz(timezones)
          .add(1, "second")
          .toDate();

        if (position.status === STATUS_POSITION.UNPAID) {
          if (timetools.isIncoming(element, configApp.due_date)) {
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

        // findoldproduct
        try {
          const produkYangDiupdate = await ProductModel.findOneAndUpdate(
            {
              position_id: element.position, // Menggunakan $in untuk mencari nilai dalam array
              db_user: rakTransaction.db_user,
              stock: { $gt: 0 }, // Menambahkan kondisi stock harus lebih dari 0
            },
            { status: "ACTIVE" },
            { new: true } // Opsi ini mengembalikan dokumen yang sudah diupdate
          );
          console.log("====================================");
          console.log(produkYangDiupdate);
          console.log("====================================");
          // XXX;
        } catch (error) {
          console.log(error);
        }

        // position["start_date"] = element.start_date;
        // position["end_date"] = element.end_date;
        // position["available_date"] = available_date;
        // position["status"] = STATUS_POSITION.RENTED;

        const rentsss = await RentModelStore.create({
          rak: element.rak,
          position: element.position,
          start_date: element.start_date,
          end_date: element.end_date,
          db_user: rakTransaction.db_user,
        });

        console.log(rentsss);

        await position.save();
      }
    }
  }

  rakTransaction.payment_status = req.body.status;
  rakTransaction.payment_method = req.body.payment_method;
  rakTransaction.payment_channel = req.body.payment_channel;
  rakTransaction.payment_date = req.body.paid_at;

  await rakTransaction.save();
  return sendResponse(
    res,
    200,
    "Success update payment status for transaction ID: " + rakTransaction._id,
    rakTransaction
  );
}

async function addRentToStoreName(storeName, newRent) {
  try {
    const result = await UserModel.findOneAndUpdate(
      { "store_database_name.name": storeName },
      {
        $push: {
          "store_database_name.$[elem].rent": newRent,
        },
      },
      {
        arrayFilters: [{ "elem.name": storeName }],
        new: true, // Mengembalikan dokumen yang telah diperbarui
      }
    );

    return {
      error: false,
      data: result,
    };
  } catch (error) {
    console.error("Error updating rent:", error);
    return {
      error: true,
      message: error,
    };
  }
}

function parseString(input) {
  const parts = input.split("&&");

  if (parts.length !== 3) {
    throw new Error(
      "Input string does not contain exactly three parts separated by '&&'"
    );
  }

  const [invoices, lokasi, source] = parts;
  return { invoices, lokasi, source };
}

// Example usage:
const input = "INV-1726396594276&&mr-fran_puri_e51cf5fa-0b3&&RAKU";
const { invoices, lokasi, source } = parseString(input);

console.log("Invoices:", invoices); // Output: INV-1726396594276
console.log("Lokasi:", lokasi); // Output: mr-fran_puri_e51cf5fa-0b3
console.log("Source:", source); // Output: RAKU

const createSplitRuleForNewEngine = async (
  targetDatabase,
  totalAmount,
  totalFee,
  reference_id,
  type = null
) => {
  try {
    const accountXenGarapin = process.env.XENDIT_ACCOUNT_GARAPIN;
    if (!targetDatabase) {
      return "Target database is not specified";
    }
    const db = await connectTargetDatabase(targetDatabase);

    var isStandAlone = false;

    // Get Parent DB
    const StoreModelDB = db.model("Store", storeSchema);
    const storeDB = await StoreModelDB.findOne();
    if (!storeDB) {
      return "Store not found";
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
      return "Template not found";
    }

    const totalPercentAmount = template.routes.reduce(
      (acc, route) => acc + route.percent_amount,
      0
    );

    if (totalPercentAmount !== 100) {
      return "Total Percent Amount harus 100%";
    }

    const totalPercentFeePos = template.routes.reduce(
      (acc, route) => acc + route.fee_pos,
      0
    );

    const feePos = totalPercentFeePos + template.fee_cust;
    if (feePos !== 100) {
      return "Fee Pos harus 100%";
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

      const totalfee = Math.round(totalFee * (route.percent_amount / 100));

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
        taxes: type === "CASH" ? false : true,
        totalFee: type === "CASH" ? 0 : totalfee,
        fee: Math.round(cost),
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

    return data;
  } catch (error) {
    return "error " + error;
  }
};

export default {
  invoiceCallback,
  callbackTest,
};
