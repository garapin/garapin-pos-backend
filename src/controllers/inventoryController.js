import { connectTargetDatabase } from "../config/targetDatabase.js";
import { cartSchema } from "../models/cartModel.js";
import { productSchema } from "../models/productModel.js";
import { stockCardSchema } from "../models/stockCardModel.js";
import { storeSchema } from "../models/storeModel.js";
import { transactionSchema } from "../models/transactionModel.js";

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

const insertInventory = async (req, res) => {
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

export default {
  copyProductToStockCard,
  insertInventory,
};
