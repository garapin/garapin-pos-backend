import mongoose from "mongoose";

// lintas database
const cartRakSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
  },
  list_rak: [
    {
      rak_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "rak", // Reference to the Brand model
        required: true,
      },
      position_id: {
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
