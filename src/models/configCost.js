import mongoose from 'mongoose';

const configCostSchema = new mongoose.Schema({
    start: {
      type: Number,
      default: 0,
    },
    end: {
      type: Number,
      default: 999999999999999
    },
    cost: {
      type: Number,
      default: 500
    },
});

const ConfigCostModel = mongoose.model('config_cost', configCostSchema);

export { ConfigCostModel, configCostSchema };