import mongoose from "mongoose";
import { rentSchema } from "./rentModel.js";

const databaseSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: false,
    },
    message: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      default: "ACTIVE",
    },
    merchant_role: {
      type: String,
      required: false,
    },
    isRakuStore: {
      type: Boolean,
      default: false,
    },
    store_name: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      required: false,
    },
    connection_string: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      default: null,
    },
    state: {
      type: String,
      default: null,
    },
    city: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    postal_code: {
      type: String,
      default: null,
    },
    rent: [rentSchema],
  },
  { timestamps: true, autoIndex: false },
  { _id: true }
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      unique: true,
      validate: {
        validator: async function (value) {
          if (this.isModified("email")) {
            // cek email sudah dipake di database name yang dituju
            const existingUser = await mongoose.models.User.findOne({
              email: value,
              store_database_name: this.store_database_name,
            });
            return !existingUser;
          }
          return true;
        },
        message: "Email must be unique within the same store_database_name",
      },
      required: true,
    },
    store_database_name: {
      type: [databaseSchema],
      default: [],
    },
    role: String,
    token: String,
    isRaku: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const UserModel = mongoose.model("User", userSchema);

export { UserModel, userSchema };
