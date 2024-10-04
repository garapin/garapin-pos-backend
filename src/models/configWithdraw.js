import mongoose from 'mongoose';

const configWithdrawSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
    },
    fee: {
      type: Number,
      required: true,
    },
    vat_percent: {
      type: Number,
      required: true  
    },
    quick_release_percent: {
      type: Number,
      required: true,
      default: 0,
    },
});

const ConfigWithdrawModel = mongoose.model('config_withdraw', configWithdrawSchema);

export { ConfigWithdrawModel, configWithdrawSchema };