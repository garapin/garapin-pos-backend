import mongoose from "mongoose";

const configAppSchema = new mongoose.Schema(
  {
    current_version: {
      type: String,
    },
    link_playstore: {
      type: String,
    },
    link_appstore: {
      type: String,
    },
    test_login: {
      type: String,
    },
    test_login: {
      type: String,
    },
    payment_duration: {
      type: Number,
      required: true,
    },
    minimum_rent_date: {
      type: Number,
      required: true,
    },
    rent_due_date: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

const configAppForPOSSchema = new mongoose.Schema({
  payment_duration: {
    type: Number,
    required: true,
  },
  minimum_rent_date: {
    type: Number,
    required: true,
  },
  rent_due_date: {
    type: Number,
    required: true,
  },
  due_date: {
    type: Number,
    required: false,
  },
});

const ConfigAppModel = mongoose.model("config_app", configAppSchema);

export { ConfigAppModel, configAppSchema, configAppForPOSSchema };
