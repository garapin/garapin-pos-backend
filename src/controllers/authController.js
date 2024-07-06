import { UserModel } from '../models/userModel.js';
import bcrypt from 'bcrypt';
import { apiResponse, sendResponse } from '../utils/apiResponseFormat.js';
import { storeSchema } from '../models/storeModel.js';
import { connectTargetDatabase } from '../config/targetDatabase.js';
import admin from '../config/firebase.js';
import otpGenerator from "otp-generator";
import { OtpModel } from "../models/otpModel.js";
import { OtpHistoriesModel } from "../models/otpHistoryModel.js";

//NOT USE
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      return apiResponse(res, 400, "Incorrect email or password");
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return apiResponse(res, 400, "Incorrect email or password.");
    }
    return apiResponse(res, 200, "Login successful", user);
  } catch (error) {
    console.error("Error:", error);
    return apiResponse(res, 500, "Internal Server Error");
  }
};

const signinWithGoogle = async (req, res) => {
  let email;
  try {
    const { token } = req.body;
    if (!token) return apiResponse(res, 401, 'Invalid token!');

    const decodedToken = await admin.auth().verifyIdToken(token);
    email = decodedToken.email;
  } catch (error) {
    console.log(error);
    return apiResponse(res, 401, 'Invalid token!');
  }
  try {
    const user = await UserModel.findOne({ email });
    const isRakuStore = req?.body.isRakuStore;

    if (!user) {
      const newUser = await UserModel({ email: email });
      await newUser.save();
      newUser.store_database_name.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const result = [];

      let filteredUsers;
      if (isRakuStore) {
        filteredUsers = newUser.store_database_name.filter((store) =>
          store.name.startsWith("om")
        );
      } else {
        filteredUsers = newUser.store_database_name.filter(
          (store) => !store.name.startsWith("om")
        );
      }

      for (const db of filteredUsers) {
        const name = db.name;
        const database = await connectTargetDatabase(db.name);
        const StoreModelDatabase = database.model("Store", storeSchema);
        const data = await StoreModelDatabase.findOne();
        if (data != null) {
          result.push({
            user: newUser,
            dbName: name,
            storesData: data,
            email_owner: email,
          });
        }
      }

      return apiResponse(res, 200, "Akun berhasil didaftarkan", {
        user: newUser,
        database: result,
      });
    }
    user.store_database_name.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const result = [];
    let filteredUsers;

    if (isRakuStore) {
      filteredUsers = user.store_database_name.filter((store) =>
        store.name.startsWith("om")
      );
    } else {
      filteredUsers = user.store_database_name.filter(
        (store) => !store.name.startsWith("om")
      );
    }

    for (const db of filteredUsers) {
      const name = db.name;
      const database = await connectTargetDatabase(db.name);
      const StoreModelDatabase = database.model("Store", storeSchema);
      const data = await StoreModelDatabase.findOne();

      result.push({
        user: user,
        dbName: name,
        storesData: data,
        email_owner: email,
      });
      console.log(result);
    }
    return apiResponse(res, 200, "Akun ditemukan", {
      user: user,
      database: result,
    });
  } catch (error) {
    console.error("Error:", error);
    return apiResponse(res, 500, "Internal Server Error");
  }
};

const logout = (req, res) => {
  res.json({ message: "Logout successful" });
};

const sendOTP = async (req, res, next) => {
  try {
    if (!req.body.email) {
      return sendResponse(res, 400, "Your body Email is required");
    }
    const email = req.body.email;
    // Check if user is already present
    const checkUserPresent = await UserModel.findOne({ email });
    // If user found with provided email
    if (!checkUserPresent) {
      return sendResponse(res, 404, "User not found", checkUserPresent);
    }
    let otp = otpGenerator.generate(6, {
      upperCaseAlphabets: false,
      lowerCaseAlphabets: false,
      specialChars: false,
    });
    let resultOtp = await OtpModel.findOne({ otp: otp });
    while (resultOtp) {
      otp = otpGenerator.generate(6, {
        upperCaseAlphabets: false,
      });
      resultOtp = await OtpModel.findOne({ otp: otp });
    }
    const otpPayload = { email, otp };
    const otpBody = await OtpModel.create(otpPayload);

    if (otpBody) {
      await OtpHistoriesModel.create(otpPayload);
      await sendVerificationEmail(otpBody.email, otpBody.otp);
    }

    return sendResponse(
      res,
      200,
      "Send verification otp successfully",
      otpBody
    );
  } catch (error) {
    console.log(error.message);
    return sendResponse(res, 500, error.message, {
      error: error.message,
    });
  }
};

export default { login, logout, signinWithGoogle, sendOTP };
