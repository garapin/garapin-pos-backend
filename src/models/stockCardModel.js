import mongoose from "mongoose";
import { ProductModel, productSchema } from "../models/productModel.js";
import { connectTargetDatabase } from "../config/targetDatabase.js";

const stockCardSchema = new mongoose.Schema({
  product_id: {
    type: String,
    required: true,
  },
  product_name: {
    type: String,
    required: true,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
  },
  qty: {
    type: Number,
    required: true,
  },
  position_id: {
    type: String,
    required: false,
  },
  rak_id: {
    type: String,
    required: false,
  },
  supplier_id: {
    type: String,
    required: false,
  },
  created_date: {
    type: Date,
    required: true,
  },
  updated_date: {
    type: Date,
    required: true,
  },
});

const StockCardModel = mongoose.model("stock_card", stockCardSchema);

// async function updateStockCard(
//   stockcardid,
//   productid,
//   type,
//   qty,
//   targetDatabase
// ) {
//   const db = await connectTargetDatabase(targetDatabase);
//   const StockCardData = db.model("stock_card", stockCardSchema);

//   // Cari stockCard berdasarkan SKU
//   let stockCard = await StockCardData.findOne({ _id: stockcardid });
//   let product = await ProductModel.findOne({ _id: productid });
//   if (!stockCard) {
//     const newStockCard = new StockCardData({
//       product_name: product.name,
//       sku: product.sku,
//       qty: product.stock,
//       created_date: new Date(),
//       updated_date: new Date(),
//     });
//     await newStockCard.save();
//     copiedProducts.push(newStockCard);
//   }

//   console.log(stockCard);
//   // xxx;

//   // stockCard.supplier_id = product.supplier_id;

//   // Update quantity
//   if (type === "in") {
//     stockCard.qty += qty;
//   } else if (type === "out") {
//     stockCard.qty -= qty;
//   }

//   // console.log(type);

//   stockCard.updated_date = new Date();
//   console.log(product);

//   if (type === "in") {
//     product.addStock(qty, targetDatabase, "RAKU IN " + stockCard._id);
//   } else if (type === "out") {
//     product.subtractStock(qty, targetDatabase, "RAKU OUT " + stockCard._id);
//   }
//   // product.save();

//   try {
//     return await stockCard.save();
//   } catch (error) {
//     return error;
//   }
// }
export { StockCardModel, stockCardSchema };
