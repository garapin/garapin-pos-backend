import mongoose from 'mongoose';

const routes = new mongoose.Schema({
  type: {
    type: String,
    required: true,
  },
  target: {
    type: String,
  default: null,
  },
  fee_pos: {
    type: Number,
    default: null
  },
  flat_amount: {
    type: Number,
    default: null,
  },
  percent_amount: {
    type: Number,
    default: null,
  },
  currency: {
    type: String,
    default: null
  },
  destination_account_id: {
    type: String,
    default: null
  },
  reference_id: {
    type: String,
    default: null
  },
});

const splitPaymentRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null
    },
    routes: [routes],
  },
  { timestamps: true }
);

const SplitPaymentRuleModel = mongoose.model('Split_Payment_Rule', splitPaymentRuleSchema);

export { SplitPaymentRuleModel, splitPaymentRuleSchema };
