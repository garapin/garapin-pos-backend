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
    price_perday: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    stok: {
      type: Number,
      required: true,
      default: 0,
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

const RakModel = mongoose.model("rak", rakSchema);

export { RakModel, rakSchema };
