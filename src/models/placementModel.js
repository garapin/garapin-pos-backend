import mongoose from "mongoose";

const placementSchema = new mongoose.Schema(
  {
    create_by: {
      type: String,
      required: true,
    },
    rent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rent", // Reference to the Brand model
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product", // Reference to the Brand model
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

const PlacementModel = mongoose.model("Placement", placementSchema);

export { PlacementModel, placementSchema };
