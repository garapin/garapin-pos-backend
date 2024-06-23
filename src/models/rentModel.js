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
    available_date: {
      type: Date,
      default: function () {
        if (this.end_date) {
          // Tambahkan satu hari ke end_date
          const newDate = new Date(this.end_date);
          newDate.setDate(newDate.getDate() + 1);
          return newDate;
        }
        return null;
      },
    },
    list_product: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: false, // ini false
        },
        stock: {
          type: Number,
          default: 0,
        },
      },
    ],
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
