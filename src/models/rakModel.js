import mongoose from "mongoose";

const rakSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
    },
    image: {
      type: String,
    },
    icon: {
      type: String,
    },
    discount: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      default: "ACTIVE",
    },
    category_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RakCategory", // Reference to the Brand model
      required: true,
    },
    type_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rakType", // Reference to the Brand model
      required: true,
    },
    position_ref: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "rakPosition", // Reference to the Brand model
        required: true,
      },
    ],
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

const RakModel = mongoose.model("rak", rakSchema);

export { RakModel, rakSchema };
