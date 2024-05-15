import mongoose from "mongoose";

const rakPositionSchema = new mongoose.Schema(
  {
    nameType: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: String,
      required: true,
      default: "ACTIVE",
    },
    description: {
      type: String,
      required: false,
    },
    startRentalTime: {
      type: Date,
      required: false,
    },
    endRentalTime: {
      type: Date,
      required: false,
    },
  },
  {
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
    timestamps: true,
  }
);

const RakPositionModel = mongoose.model("rakPosition", rakPositionSchema);

export { RakPositionModel, rakPositionSchema };
