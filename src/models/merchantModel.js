import mongoose from 'mongoose';

const databaseMerchantSchema = new mongoose.Schema({
  type: {
    type: String,
    required: false, 
  },
  merchant_role: {
    type: String,
    required: false, 
  },
  split_rule_id: {
    type: String,
    required: false, 
  },
  name: {
    type: String,
    required: false, 
  },
  email_owner: {
    type: String,
    required: true, 
  },
  connection_string:  {
    type: String,
    required: false, 
  },
  role:  {
    type: String,
    required: false, 
  },
  status:  {
    type: String,
    default: 'PENDING', 
  },
}, { timestamps: true, autoIndex: false }, { _id: true });

const DatabaseMerchantModel = mongoose.model('Database_Merchant', databaseMerchantSchema);

export { DatabaseMerchantModel, databaseMerchantSchema };