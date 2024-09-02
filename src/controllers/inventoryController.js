import mongoose from "mongoose";
import { connectTargetDatabase } from "../config/targetDatabase.js";
import { brandSchema } from "../models/brandmodel.js";
import { cartSchema } from "../models/cartModel.js";
import { categorySchema } from "../models/categoryModel.js";
import { productSchema } from "../models/productModel.js";
import { stockCardSchema } from "../models/stockCardModel.js";
import { storeSchema } from "../models/storeModel.js";
import { transactionSchema } from "../models/transactionModel.js";
import { unitSchema } from "../models/unitModel.js";
import { apiResponse } from "../utils/apiResponseFormat.js";
import saveBase64Image from "../utils/base64ToImage.js";

const clientUrl = process.env.CLIENT_URL;
const copyProductToStockCard = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const db = await connectTargetDatabase(targetDatabase);

    // Init StockCard Model
    const StockCardData = db.model("stock_card", stockCardSchema);

    // Ambil semua produk dari koleksi product
    const ProductData = db.model("Product", productSchema);
    const products = await ProductData.find();

    // Salin produk ke stockCard jika belum ada
    const copiedProducts = [];
    for (const product of products) {
      const existingStockCard = await StockCardData.findOne({
        sku: product.sku,
      });
      if (!existingStockCard) {
        const newStockCard = new StockCardData({
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

    res.status(200).json({
      message: `${copiedProducts.length} produk berhasil disalin ke StockCard`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const insertInventoryTransaction = async (req, res) => {
  try {
    const targetDatabase = req.get("target-database");
    const { position_id, rak_id, supplier_id, product_name, product_sku, qty } =
      req.body;
    const { type, from_app } = req.query;
    const db = await connectTargetDatabase(targetDatabase);

    // Inisialisasi model
    const StockCardData = db.model("stock_card", stockCardSchema);
    const TransactionData = db.model("Transaction", transactionSchema);

    // Cari stockCard berdasarkan SKU
    let stockCard = await StockCardData.findOne({ sku: product_sku });

    if (!stockCard) {
      // Jika stockCard tidak ditemukan, buat baru
      stockCard = new StockCardData({
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
    } else if (type === "out") {
      stockCard.qty -= qty;
    }

    stockCard.updated_date = new Date();
    await stockCard.save();

    var dataInvoice = {};
    console.log("====================================");
    console.log(`Target Database: ${from_app}`);
    console.log("====================================");
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
        };
      }
    }

    const transaction = await saveTransactionInventory(req, dataInvoice);

    res.status(200).json({
      message: "Inventory berhasil diperbarui",
      stockCard: stockCard,
      transaction: transaction,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

const createProduct = async (req, res) => {
  const targetDatabase = req.get("target-database");
  const {
    product_name,
    product_sku,
    brand_ref,
    category_ref,
    unit_ref,
    image,
    icon,
    discount,
    price,
    length,
    width,
    db_user,
    expired_date,
  } = req.body;

  try {
    const db = await connectTargetDatabase(targetDatabase);

    const ProductModelStore = db.model("Product", productSchema);
    const CategoryModelStore = db.model("Category", categorySchema);
    const BrandModelStore = db.model("Brand", brandSchema);
    const UnitModelStore = db.model("Unit", unitSchema);

    const CategoryModel = await CategoryModelStore.findOne({
      _id: category_ref,
    });

    if (!CategoryModel) {
      return apiResponse(res, 400, "Category by id not found");
    }

    const BrandModel = await BrandModelStore.findOne({
      _id: brand_ref,
    });

    if (!BrandModel) {
      return apiResponse(res, 400, "Brand by id not found");
    }

    const UnitModel = await UnitModelStore.findOne({
      _id: unit_ref,
    });

    if (!UnitModel) {
      return apiResponse(res, 400, "Unit by id not found");
    }

    const existingSku = await ProductModelStore.findOne({ product_sku });

    if (existingSku) {
      return apiResponse(res, 400, "SKU already exists");
    }

    const addProduct = new ProductModelStore({
      name: product_name,
      sku: product_sku,
      image: image,
      icon: icon,
      discount: discount,
      price: price,
      brand_ref: brand_ref,
      category_ref: category_ref,
      unit_ref: unit_ref,
      expired_date: expired_date,
      length: length,
      width: width,
      db_user: db_user,
    });
    if (addProduct.image && addProduct.image.startsWith("data:image")) {
      const targetDirectory = "products";
      addProduct.image = saveBase64Image(
        addProduct.image,
        targetDirectory,
        targetDatabase
      );
    }

    const savedProduct = await addProduct.save();
    return apiResponse(res, 200, "Product created successfully", savedProduct);
  } catch (error) {
    return apiResponse(res, 500, error.message);
  }
};

const copyProductToUser = async (req, res) => {
  const targetDatabase = req.get("target-database");
  const sourceDatabase = req.get("source-database");
  const db = await connectTargetDatabase(sourceDatabase);

  const { supplier_id, rak_id, position_id, inventory_id } = req.body;

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

    const ProductModelUser = dbUser.model("Product", productSchema);
    const BrandModelUser = dbUser.model("Brand", brandSchema);
    const CategoryModelUser = dbUser.model("Category", categorySchema);
    const UnitModelUser = dbUser.model("Unit", unitSchema);

    const productOnUser = await ProductModelUser.findOne({ _id: inventory_id });

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
          { _id: productOnSupplier.brand_ref },
          {
            $setOnInsert: copyDataWithoutTimestamps(
              await db
                .model("Brand", brandSchema)
                .findById(productOnSupplier.brand_ref)
            ),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ),
        CategoryModelUser.findOneAndUpdate(
          { _id: productOnSupplier.category_ref },
          {
            $setOnInsert: copyDataWithoutTimestamps(
              await db
                .model("Category", categorySchema)
                .findById(productOnSupplier.category_ref)
            ),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ),
        UnitModelUser.findOneAndUpdate(
          { _id: productOnSupplier.unit_ref },
          {
            $setOnInsert: copyDataWithoutTimestamps(
              await db
                .model("Unit", unitSchema)
                .findById(productOnSupplier.unit_ref)
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
        brand_ref: productOnSupplier.brand_ref,
        category_ref: productOnSupplier.category_ref,
        unit_ref: productOnSupplier.unit_ref,
        expired_date: productOnSupplier.expired_date,
        length: productOnSupplier.length,
        width: productOnSupplier.width,
        db_user: sourceDatabase,
        supplier_id: convertedSupplierId,
        rak_id: convertedRakIds,
        position_id: convertedPositionIds,
        inventory_id: convertedInventoryId,
      });

      const savedCopyProduct = await addProduct.save();
      return apiResponse(
        res,
        200,
        "Product copy successfully",
        savedCopyProduct
      );
    }

    return apiResponse(res, 200, "Product already exists", productOnUser);
  } catch (error) {
    return apiResponse(res, 500, error.message);
  }
};

export default {
  copyProductToStockCard,
  insertInventoryTransaction,
  createProduct,
  copyProductToUser,
};
