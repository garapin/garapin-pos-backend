import bcrypt from "bcrypt";
import { UserModel, userSchema } from "../../models/userModel.js";
import {
  apiResponseList,
  apiResponse,
  sendResponse,
} from "../../utils/apiResponseFormat.js";
import { generateToken } from "../../utils/jwt.js";
import { sendVerificationEmail } from "../../utils/otp.js";
import { StoreModel, storeSchema } from "../../models/storeModel.js";
import { OtpModel, otpSchema } from "../../models/otpModel.js";
import {
  OtpHistoriesModel,
  otpHistoriesSchema,
} from "../../models/otpHistoryModel.js";
import {
  connectTargetDatabase,
  closeConnection,
} from "../../config/targetDatabase.js";
import otpGenerator from "otp-generator";

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
  try {
    const { email } = req.body;

    const user = await UserModel.findOne({ email, isRaku: true });

    if (!user) {
      const newUser = await UserModel({ email, isRaku: true });
      const dataUser = await newUser.save();
      const token = generateToken({ data: dataUser._id });
      newUser.token = token;
      newUser.store_database_name.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      const result = [];

      for (const db of newUser.store_database_name) {
        console.log(db.name);
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
            token: token,
          });
          console.log(result);
        }
      }
      console.log({ user: newUser, result: result });
      return sendResponse(res, 200, "Akun berhasil didaftarkan", {
        user: newUser,
        database: result,
      });
    }
    user.store_database_name.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    const token = generateToken({ data: user._id });
    user.token = token;

    const result = [];

    for (const db of user.store_database_name) {
      console.log(db.name);
      const name = db.name;
      const database = await connectTargetDatabase(db.name);
      const StoreModelDatabase = database.model("Store", storeSchema);
      const data = await StoreModelDatabase.findOne();
      // if (data != null) {
      result.push({
        user: user,
        dbName: name,
        storesData: data,
        email_owner: email,
        token: token,
      });
      console.log(result);
      // }
    }
    console.log({ user: user, result: result });
    return sendResponse(res, 200, "Akun ditemukan", {
      user: user,
      database: result,
    });
  } catch (error) {
    console.error("Error:", error);
    return sendResponse(res, 500, "Internal Server Error", {
      error: error.message,
    });
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

    return sendResponse(res, 200, "Send verification otp successfully");
  } catch (error) {
    console.log(error.message);
    return sendResponse(res, 500, error.message, {
      error: error.message,
    });
  }
};

export default { login, logout, signinWithGoogle, sendOTP };
