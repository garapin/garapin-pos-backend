import mongoose from 'mongoose';

const configAppSchema = new mongoose.Schema({
  current_version:{
    type: String,
  },
}, { timestamps: true });

const ConfigAppModel = mongoose.model('config_app', configAppSchema);

export { ConfigAppModel, configAppSchema };
