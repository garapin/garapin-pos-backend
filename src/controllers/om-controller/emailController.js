import otpGenerator from "otp-generator";
import { OtpHistoriesModel } from "../../models/otpHistoryModel.js";
import { OtpModel } from "../../models/otpModel.js";
import { UserModel } from "../../models/userModel.js";
import { sendResponse } from "../../utils/apiResponseFormat.js";
import { otpVerification, sendVerificationEmail } from "../../utils/otp.js";
import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { storeSchema } from "../../models/storeModel.js";

const sendOTP = async (req, res, next) => {
  try {
    if (!req.body.email) {
      return sendResponse(res, 400, "Your body Email is required");
    }
    const email = req.body.email;

    const checkUserExist = await UserModel.findOne({ email });

    if (!checkUserExist) {
      return sendResponse(res, 404, "User not found", checkUserExist);
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
      await sendVerificationEmail(
        req,
        otpBody.email,
        otpBody.otp,
        req.body.store_name,
        req?.body?.about_what
      );
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

const verificationOTP = async (req, res, next) => {
  const { email, otp_code } = req?.body;
  try {
    // Check if user is already present
    const checkUserExist = await UserModel.findOne({ email });

    if (!checkUserExist) {
      return sendResponse(res, 404, "User not found", checkUserExist);
    }

    const isVerification = await otpVerification(res, email, otp_code);

    if (!isVerification) {
      return sendResponse(res, 400, "error", "Otp is not valid");
    }

    return sendResponse(res, 200, "Verification otp successfully");
  } catch (error) {
    console.log(error.message);
    return sendResponse(res, 500, error.message, {
      error: error.message,
    });
  }
};

export default { sendOTP, verificationOTP };
