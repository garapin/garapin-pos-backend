import mongoose from "mongoose";
import { connectTargetDatabase } from "../config/targetDatabase.js";
import { brandSchema } from "../models/brandmodel.js";
import { cartSchema } from "../models/cartModel.js";
import { categorySchema } from "../models/categoryModel.js";
import { productSchema } from "../models/productModel.js";
import { storeSchema } from "../models/storeModel.js";
import { transactionSchema } from "../models/transactionModel.js";
import { unitSchema } from "../models/unitModel.js";
import { apiResponse } from "../utils/apiResponseFormat.js";
import saveBase64Image from "../utils/base64ToImage.js";
import { stockCardSchema } from "../models/stockCardModel.js";
import isPositionCanInput from "../utils/positioncheck.js";
import { ObjectId } from "mongodb";

const copyProductToStockCard = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const db = await connectTargetDatabase(targetDatabase);

    // Hapus indeks SKU jika ada
    try {
      await db.collection("products").dropIndex("sku_1");
      console.log("Indeks SKU berhasil dihapus");
    } catch (error) {
      console.log(
        "Indeks SKU tidak ditemukan atau sudah dihapus:",
        error.message
      );
    }

    // Init StockCard Model
    const StockCardData = db.model("stock_card", stockCardSchema);

    // Ambil semua produk dari koleksi product
    const ProductData = db.model("Product", productSchema);
    const products = await ProductData.find();

    // Salin produk ke stockCard jika belum ada
    const copiedProducts = [];
    for (const product of products) {
      const existingStockCard = await StockCardData.findOne({
        product_id: product._id,
      });
      if (!existingStockCard) {
        const newStockCard = new StockCardData({
          product_id: product._id,
          product_name: product.name,
          sku: product.sku,
          qty: product.stock,
          created_date: new Date(),
          updated_date: new Date(),
        });
        await newStockCard.save();
        copiedProducts.push(newStockCard);
      }
    }

    return apiResponse(res, 200, "Product copied successfully", copiedProducts);
  } catch (error) {
    return apiResponse(res, 500, error.message);
  }
};

const insertInventoryTransaction = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const {
      product_id,
      parent_invoice,
      position_id,
      rak_id,
      supplier_id,
      product_name,
      product_sku,
      qty,
    } = req.body;
    const { type, from_app } = req.query;
    const db = await connectTargetDatabase(targetDatabase);

    // Inisialisasi model
    const StockCardData = db.model("stock_card", stockCardSchema);
    const TransactionData = db.model("Transaction", transactionSchema);

    // Cari stockCard berdasarkan SKU
    let stockCard = await StockCardData.findOne({ product_id: product_id });

    // Hapus indeks SKU jika ada
    try {
      await db.collection("products").dropIndex("sku_1");
      console.log("Indeks SKU berhasil dihapus");
    } catch (error) {
      console.log(
        "Indeks SKU tidak ditemukan atau sudah dihapus:",
        error.message
      );
    }

    if (!stockCard) {
      // Jika stockCard tidak ditemukan, buat baru
      stockCard = new StockCardData({
        product_id: product_id,
        product_name: product_name,
        sku: product_sku,
        qty: 0,
        created_date: new Date(),
        updated_date: new Date(),
      });
    }

    stockCard.position_id = position_id;
    stockCard.rak_id = rak_id;
    stockCard.supplier_id = supplier_id;

    // Update quantity
    if (type === "in") {
      stockCard.qty += qty;

      // Cek apakah produk memiliki db_user
      const ProductData = db.model("Product", productSchema);
      const product = await ProductData.findOne({
        $or: [{ _id: product_id }, { inventory_id: product_id }],
      });

      if (product && product.db_user) {
        // Kurangi stok di db_user
        const dbUser = await connectTargetDatabase(product.db_user);
        const ProductModelUser = dbUser.model("Product", productSchema);
        const userProduct = await ProductModelUser.findOne({
          $or: [{ _id: product_id }, { inventory_id: product_id }],
        });

        if (userProduct) {
          await userProduct.addStock(qty, dbUser, "Add Stock Inventory");
        }
      }

      if (product) {
        await product.addStock(qty, targetDatabase, "Add Stock Inventory");
      }
    } else if (type === "out") {
      stockCard.qty -= qty;

      // Cek apakah produk memiliki db_user
      const ProductData = db.model("Product", productSchema);
      const product = await ProductData.findOne({
        $or: [{ _id: product_id }, { inventory_id: product_id }],
      });

      if (product && product.db_user) {
        // Kurangi stok di db_user
        const dbUser = await connectTargetDatabase(product.db_user);
        const ProductModelUser = dbUser.model("Product", productSchema);
        const userProduct = await ProductModelUser.findOne({
          $or: [{ _id: product_id }, { inventory_id: product_id }],
        });

        if (userProduct) {
          await userProduct.subtractStock(
            qty,
            dbUser,
            "Subtract Stock Inventory"
          );
        }
      }

      if (product) {
        await product.subtractStock(
          qty,
          targetDatabase,
          "Subtract Stock Inventory"
        );
      }
    }

    stockCard.updated_date = new Date();
    await stockCard.save();

    var dataInvoice = {};

    if (from_app === "POS") {
      const timestamp = new Date().getTime();
      const generateInvoice = `OUTP-${timestamp}`;

      dataInvoice = {
        external_id: `${generateInvoice}&&${targetDatabase}&&POS`,
        amount: 0,
        invoice_label: generateInvoice,
        description: `Membuat invoice OUTP-${timestamp}`,
        product_sku: product_sku,
        product_name: product_name,
        qty: qty,
        type: type,
        from_app: from_app,
        parent_invoice: parent_invoice,
      };
    } else if (from_app === "RAKU") {
      if (type === "in") {
        const timestamp = new Date().getTime();
        const generateInvoice = `OUTR-${timestamp}`;

        dataInvoice = {
          external_id: `${generateInvoice}&&${targetDatabase}&&RAKU`,
          amount: 0,
          invoice_label: generateInvoice,
          description: `Membuat invoice OUTR-${timestamp}`,
          product_sku: product_sku,
          product_name: product_name,
          qty: qty,
          type: type,
          from_app: from_app,
          parent_invoice: parent_invoice,
        };
      } else if (type === "out") {
        const timestamp = new Date().getTime();
        const generateInvoice = `INVR-${timestamp}`;

        dataInvoice = {
          external_id: `${generateInvoice}&&${targetDatabase}&&RAKU`,
          amount: 0,
          invoice_label: generateInvoice,
          description: `Membuat invoice INVR-${timestamp}`,
          product_sku: product_sku,
          product_name: product_name,
          qty: qty,
          type: type,
          from_app: from_app,
          parent_invoice: parent_invoice,
        };
      }
    }

    const transaction = await saveTransactionInventory(req, dataInvoice);

    return apiResponse(res, 200, "Inventory berhasil diperbarui", {
      message: "Invoice inventory berhasil dibuat",
      stockCard: stockCard,
      transaction: transaction,
    });
  } catch (error) {
    return apiResponse(res, 500, error.message);
  }
};

const saveTransactionInventory = async (req, data) => {
  const targetDatabase = req.get("target-database");
  const db = await connectTargetDatabase(targetDatabase);

  // Find Product by sku
  const ProductData = db.model("Product", productSchema);
  const product = await ProductData.findOne({ sku: data.product_sku });

  const TransactionModelStore = db.model("Transaction", transactionSchema);
  const addTransaction = new TransactionModelStore({
    invoice: data.external_id,
    parent_invoice: data.parent_invoice,
    invoice_label: data.invoice_label,
    status: "SUCCEEDED",
    fee_garapin: 0,
    total_with_fee: 0,
    product: {
      items: [
        {
          product: product.toObject(),
          quantity: data.qty,
        },
      ],
    },
    inventory_status:
      data.from_app === "POS"
        ? data.type === "in"
          ? "POS_IN"
          : "POS_OUT"
        : data.type === "in"
          ? "RAKU_IN"
          : "RAKU _OUT",
  });

  return await addTransaction.save();
};

const copyProductToUser = async (req, res) => {
  const targetDatabase = req.get("target-database");
  const sourceDatabase = req.get("source-database");
  const db = await connectTargetDatabase(sourceDatabase);

  const { supplier_id, rak_id, position_id, inventory_id, qty } = req.body;

  // console.log(position_id);

  for (const id of position_id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return apiResponse(res, 400, "Invalid position_id");
    }
  }

  try {
    // Pastikan position_id adalah array
    if (!Array.isArray(position_id)) {
      return apiResponse(res, 400, "position_id harus berupa array");
    }

    // Pastikan rak_id adalah array
    if (!Array.isArray(rak_id)) {
      return apiResponse(res, 400, "rak_id harus berupa array");
    }

    // Konversi string ID menjadi ObjectId
    const convertedPositionIds = position_id
      .map((id) => (id ? mongoose.Types.ObjectId(id) : null))
      .filter((id) => id !== null);
    const convertedRakIds = rak_id
      .map((id) => (id ? mongoose.Types.ObjectId(id) : null))
      .filter((id) => id !== null);
    const convertedSupplierId = supplier_id
      ? mongoose.Types.ObjectId(supplier_id)
      : null;

    const convertedInventoryId = mongoose.Types.ObjectId(inventory_id);

    const ProductModelSupplier = db.model("Product", productSchema);
    const productOnSupplier = await ProductModelSupplier.findOne({
      _id: inventory_id,
    });

    if (!productOnSupplier) {
      return apiResponse(res, 400, "Product on supplier not found");
    }

    const dbUser = await connectTargetDatabase(targetDatabase);

    for (const id of position_id) {
      const isposavailable = await isPositionCanInput(
        id,
        productOnSupplier._id,
        dbUser,
        db
      );
      if (!isposavailable.isavailable) {
        return apiResponse(res, 400, isposavailable.message);
      }
    }

    // Hapus indeks SKU jika ada
    try {
      await dbUser.collection("products").dropIndex("sku_1");
      console.log("Indeks SKU berhasil dihapus");
    } catch (error) {
      console.log(
        "Indeks SKU tidak ditemukan atau sudah dihapus:",
        error.message
      );
    }

    const ProductModelUser = dbUser.model("Product", productSchema);
    const BrandModelUser = dbUser.model("Brand", brandSchema);
    const CategoryModelUser = dbUser.model("Category", categorySchema);
    const UnitModelUser = dbUser.model("Unit", unitSchema);

    const productOnUser = await ProductModelUser.findOne({
      inventory_id: inventory_id,
      position_id: { $in: convertedPositionIds },
    });

    // console.log(convertedPositionIds);

    // console.log(productOnUser);

    if (!productOnUser) {
      // Fungsi helper untuk menyalin data tanpa updatedAt
      const copyDataWithoutTimestamps = (doc) => {
        if (!doc) return null;
        const data = doc.toObject();
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        return data;
      };

      // Cari atau buat brand, category, dan unit di database user
      const [brandUser, categoryUser, unitUser] = await Promise.all([
        BrandModelUser.findOneAndUpdate(
          { brand: productOnSupplier.brand_ref.brand },
          {
            $setOnInsert: copyDataWithoutTimestamps(
              await db.model("Brand", brandSchema).findOne({
                brand: productOnSupplier.brand_ref.brand,
              })
            ),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ),
        CategoryModelUser.findOneAndUpdate(
          { category: productOnSupplier.category_ref.category },
          {
            $setOnInsert: copyDataWithoutTimestamps(
              await db.model("Category", categorySchema).findOne({
                category: productOnSupplier.category_ref.category,
              })
            ),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ),
        UnitModelUser.findOneAndUpdate(
          { unit: productOnSupplier.unit_ref.unit },
          {
            $setOnInsert: copyDataWithoutTimestamps(
              await db
                .model("Unit", unitSchema)
                .findOne({ unit: productOnSupplier.unit_ref.unit })
            ),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ),
      ]);

      const addProduct = new ProductModelUser({
        name: productOnSupplier.name,
        sku: productOnSupplier.sku,
        image: productOnSupplier.image,
        icon: productOnSupplier.icon,
        discount: productOnSupplier.discount,
        price: productOnSupplier.price,
        brand_ref: brandUser,
        category_ref: categoryUser,
        unit_ref: unitUser,
        expired_date: productOnSupplier.expired_date,
        length: productOnSupplier.length,
        width: productOnSupplier.width,
        db_user: sourceDatabase,
        supplier_id: convertedSupplierId,
        rak_id: convertedRakIds,
        position_id: convertedPositionIds,
        inventory_id: convertedInventoryId,
        stock: 0,
      });
      const savedCopyProduct = await addProduct.save();

      savedCopyProduct.addStock(
        qty,
        targetDatabase,
        "Add new product " + savedCopyProduct._id
      );

      return apiResponse(
        res,
        200,
        "Product copy successfully",
        savedCopyProduct
      );
    } else {
      /// Only add qty
      productOnUser.addStock(qty, targetDatabase, "Add qty product");

      return apiResponse(
        res,
        200,
        "Product Qty copy successfully",
        productOnUser
      );
    }
  } catch (error) {
    console.log(error);

    return apiResponse(res, 500, error.message);
  }
};

export default {
  copyProductToStockCard,
  insertInventoryTransaction,
  copyProductToUser,
};
