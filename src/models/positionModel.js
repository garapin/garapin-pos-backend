import mongoose from "mongoose";

const positionSchema = new mongoose.Schema(
  {
    name_position: {
      type: String,
      required: true,
    },
    row: {
      type: String,
      required: true,
    },
    column: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    status: {
      type: String,
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
  }
);

const PositionModel = mongoose.model("position", positionSchema);

export { PositionModel, positionSchema };
