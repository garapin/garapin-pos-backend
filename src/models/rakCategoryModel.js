import mongoose from "mongoose";

const rakCategorySchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      default: "ACTIVE",
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

const RakCategoryModel = mongoose.model("RakCategory", rakCategorySchema);

export { RakCategoryModel, rakCategorySchema };
