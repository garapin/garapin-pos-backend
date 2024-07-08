import mongoose from "mongoose";

const configSettingSchema = new mongoose.Schema({
  payment_duration: {
    type: Number,
    required: true,
  },
  minimum_rent_date: {
    type: Number,
    required: true,
  },
});

const configSettingModel = mongoose.model("configSetting", configSettingSchema);

export { configSettingModel, configSettingSchema };
