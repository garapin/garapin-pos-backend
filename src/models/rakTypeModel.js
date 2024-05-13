import mongoose from "mongoose";

const rakTypeSchema = new mongoose.Schema(
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

const RakTypeModel = mongoose.model("rakType", rakTypeSchema);

export { RakTypeModel, rakTypeSchema };
