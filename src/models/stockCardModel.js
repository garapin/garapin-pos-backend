import mongoose from 'mongoose';

const stockCardSchema = new mongoose.Schema({
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

export { StockCardModel, stockCardSchema };