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
      start_date: {
        type: Date,
        required: true,
      },
      end_date: {
        type: Date,
        required: true,
      },
    },
  ],
});

const CartRakModel = mongoose.model("CartRak", cartRakSchema);

export { CartRakModel, cartRakSchema };
