import mongoose from "mongoose";

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

async function updateStockCard(db, stockcardid, type, qty) {
  const StockCardData = db.model("stock_card", stockCardSchema);

  // Cari stockCard berdasarkan SKU
  let stockCard = await StockCardData.findOne({ _id: stockcardid });
  console.log(stockCard);
  // xxx;

  // stockCard.supplier_id = product.supplier_id;

  // Update quantity
  if (type === "in") {
    stockCard.qty += qty;
  } else if (type === "out") {
    stockCard.qty -= qty;
  }

  // console.log(type);

  // console.log(stockCard.qty);

  stockCard.updated_date = new Date();

  try {
    return await stockCard.save();
  } catch (error) {
    return error;
  }
}
export { StockCardModel, stockCardSchema, updateStockCard };
