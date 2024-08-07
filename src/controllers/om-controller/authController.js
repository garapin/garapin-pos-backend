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
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import otpGenerator from "otp-generator";
import { showImage } from "../../utils/handleShowImage.js";

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

// const signinWithGoogle = async (req, res) => {
//   try {
//     const { email } = req.body;
//     const { token } = req.body;

//     if (!email) {
//       return sendResponse(res, 400, "Email is required", null);
//     }

//     let user = await UserModel.findOne({ email });

//     if (!user) {
//       user = new UserModel({ email, isRaku: true });
//       const savedUser = await user.save();
//       const token = generateToken({ data: savedUser._id });
//       user.token = token;

//       await UserModel.updateOne({ email: email }, { $set: { token: token } });

//       user.store_database_name.sort(
//         (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//       );

//       const result = [];

//       for (const db of user.store_database_name) {
//         const name = db.name;
//         const database = await connectTargetDatabase(db.name);
//         const StoreModelDatabase = database.model("Store", storeSchema);
//         const data = await StoreModelDatabase.findOne();
//         data.store_name = data.store_name || name;
//         if (data) {
//           result.push({
//             user: user,
//             dbName: name,
//             storesData: data,
//             email_owner: email,
//             token: token,
//           });
//         }
//       }
//       return sendResponse(res, 200, "Akun berhasil didaftarkan", {
//         user: user,
//         database: result,
//       });
//     } else {
//       if (!user.isRaku) {
//         return sendResponse(res, 400, "User duplicated with POS Account", null);
//       }

//       user.store_database_name.sort(
//         (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
//       );

//       const token = generateToken({ data: user._id });
//       user.token = token;

//       await UserModel.updateOne({ email: email }, { $set: { token: token } });

//       const result = [];

//       for (const db of user.store_database_name.filter(
//         (db) => db.isRakuStore
//       )) {
//         const name = db.name;
//         const database = await connectTargetDatabase(db.name);
//         const StoreModelDatabase = database.model("Store", storeSchema);
//         const data = await StoreModelDatabase.findOne();
//         if (data) {
//           if (data.store_image) {
//             data.store_image = await showImage(req, data.store_image);
//           }
//           if (data.details?.id_card_image) {
//             data.details.id_card_image = await showImage(
//               req,
//               data.details.id_card_image
//             );
//           }
//           data.store_name = data.store_name || name;
//           result.push({
//             user: user,
//             dbName: name,
//             storesData: data,
//             email_owner: email,
//             token: token,
//           });
//         }
//       }
//       return sendResponse(res, 200, "Akun ditemukan", {
//         user: user,
//         database: result,
//       });
//     }
//   } catch (error) {
//     console.error("Error in signinWithGoogle:", error);
//     return sendResponse(res, 500, "Internal Server Error", {
//       error: error.message,
//     });
//   }
// };

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
    return sendResponse(res, 500, error.message, {
      error: error.message,
    });
  }
};

export default { login, logout, sendOTP };
