import mongoose from "mongoose";

const rakTypeSchema = new mongoose.Schema(
  {
    name_type: {
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
    create_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user", // Reference to the Brand model
      required: true,
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
