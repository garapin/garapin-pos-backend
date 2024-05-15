import mongoose from "mongoose";

// lintas database
const cartRakItemSchema = new mongoose.Schema({
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CartRak",
  },
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "rak",
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
  },
  position_ref: [
    {
      id: {
        type: String,
        required: true,
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
  ],
});

const CartRakItemModel = mongoose.model("CartRakTtem", cartRakItemSchema);

const cartRakSchema = new mongoose.Schema(
  {
    items: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CartRakTtem",
      },
    ],
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    total_price: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

const CartRakModel = mongoose.model("CartRak", cartRakSchema);

export { CartRakModel, cartRakSchema, CartRakItemModel, cartRakItemSchema };
