import mongoose from "mongoose";

const rakTransactionSchema = new mongoose.Schema(
  {
    create_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user", // Reference to the Brand model
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
        number_of_days: {
          type: Number,
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
        rak_detail: {
          rak_name: {
            type: String,
            required: true,
          },
          price_perday: {
            type: String,
            required: true,
          },
          category_name: {
            type: String,
            required: true,
          },
          type_name: {
            type: String,
            required: true,
          },
        },
      },
    ],
    total_harga: {
      type: Number,
      required: true,
      default: 0,
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

const RakTransactionModel = mongoose.model(
  "rakTransaction",
  rakTransactionSchema
);

export { RakTransactionModel, rakTransactionSchema };
