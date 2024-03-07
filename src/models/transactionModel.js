import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    product: {
      type: Object,
      required: true,
    },
    invoice: {
      type: String,
      required: true
    },
    invoice_label: {
      type: String,
      required: true
    },
    status: {
      type: String,
      required: true
    },
    payment_method: {
      type: String,
      default: null
    },
    payment_date: {
      type: Date,
      default: null
    },
    webhook: {
      type: Object,
      default: null,
    },

  },
  { timestamps: true }
);

const TransactionModel = mongoose.model('Transaction', transactionSchema);

export { TransactionModel, transactionSchema };
