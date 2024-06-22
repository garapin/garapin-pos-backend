import mongoose from 'mongoose';

const configAppSchema = new mongoose.Schema({
  current_version:{
    type: String,
  },
  link_playstore:{
    type: String,
  },
link_appstore:{
  type: String,
},
test_login:{
  type: String,
},

}, { timestamps: true });

const ConfigAppModel = mongoose.model('config_app', configAppSchema);

export { ConfigAppModel, configAppSchema };
