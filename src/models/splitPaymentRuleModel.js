import mongoose from 'mongoose';


const routeSchema = new mongoose.Schema({
    // pilih salah satu, flat atau percent yang dipake tiap data diarray
  flat_amount: {
    type: Number,
    default: null
  },
  percent_amount: {
    type: Number,
    default: null
  },
  currency: String,
  destination_account_id: String,
  reference_id: String
});

const splitPaymentRuleSchema = new mongoose.Schema({
  name: String,
  description: String,
  routes: [routeSchema]
}, { timestamps: true });

const SplitPaymentRuleModel = mongoose.model('Split_Payment_Rule', splitPaymentRuleSchema);

export { SplitPaymentRuleModel, splitPaymentRuleSchema };
