import mongoose from "mongoose";
export const STATUS_POSITION = Object.freeze({
  AVAILABLE: "AVAILABLE",
  RENTED: "RENTED",
});
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
    height: {
      type: Number,
      required: false,
      default: 0,
    },
    long_size: {
      type: Number,
      required: false,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(STATUS_POSITION),
      default: STATUS_POSITION.AVAILABLE,
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

const PositionModel = mongoose.model("position", positionSchema);

export { PositionModel, positionSchema };
