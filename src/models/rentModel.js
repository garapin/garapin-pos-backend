import mongoose from "mongoose";
const rentSchema = new mongoose.Schema(
  {
    create_by: {
      type: String,
      required: true,
    },
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
