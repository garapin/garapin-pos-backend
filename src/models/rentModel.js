import mongoose from "mongoose";
const rentSchema = new mongoose.Schema(
  {
    db_user: {
      type: String,
      required: true,
    },
    rak: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rak",
      required: true,
    },
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "position",
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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
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
    id: true,
  }
);

const RentModel = mongoose.model("rent", rentSchema);

export { RentModel, rentSchema };
