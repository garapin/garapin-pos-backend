import mongoose from "mongoose";

const otpHistoriesSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
  },
  otp: {
    type: String,
    required: true,
  },
  isUsage: {
    type: Boolean,
    required: false,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  usageAt: {
    type: Date,
    default: null,
  },
});

const OtpHistoriesModel = mongoose.model("OtpHistories", otpHistoriesSchema);

export { OtpHistoriesModel, otpHistoriesSchema };
