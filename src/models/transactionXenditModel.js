import mongoose from "mongoose";

const feeSchema = new mongoose.Schema({
    xendit_fee: Number,
    value_added_tax: Number,
    xendit_withholding_tax: Number,
    third_party_withholding_tax: Number,
    status: String
});

const transactionSchema = new mongoose.Schema({
    id: String,
    product_id: String,
    type: String,
    status: String,
    channel_category: String,
    channel_code: String,
    reference_id: String,
    account_identifier: { type: String, default: null },
    currency: String,
    amount: Number,
    net_amount: Number,
    cashflow: String,
    settlement_status: String,
    estimated_settlement_time: Date,
    business_id: String,
    created: Date,
    updated: Date,
    fee: feeSchema
});

const TransactionXenditResponse = mongoose.model('TransactionXenditResponse', transactionSchema);

export { TransactionXenditResponse, transactionSchema };