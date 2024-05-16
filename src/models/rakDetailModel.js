import mongoose from "mongoose";

const rakPositionSchema = new mongoose.Schema(
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
    category_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", // Reference to the Brand model
      required: true,
    },
    type_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "rakType", // Reference to the Brand model
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

const RakPositionModel = mongoose.model("rakPosition", rakPositionSchema);

export { RakPositionModel, rakPositionSchema };
