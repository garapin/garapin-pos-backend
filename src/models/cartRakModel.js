import mongoose from "mongoose";

// lintas database
const cartRakSchema = new mongoose.Schema({
  db_user: {
    type: String,
    required: true,
  },
  list_rak: [
    {
      rak: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "rak", // Reference to the Brand model
        required: true,
      },
      position: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "position", // Reference to the Brand model
        required: true,
      },
      total_date: {
        type: Number,
        required: true,
        default: 0,
      },
      start_date: {
        type: Date,
        required: false,
        // select: false,
      },
      end_date: {
        type: Date,
        required: false,
        // select: false,
      },
    },
  ],
});

const CartRakModel = mongoose.model("CartRak", cartRakSchema);

export { CartRakModel, cartRakSchema };
