import nodemailer from "nodemailer";
import { OtpModel } from "../models/otpModel.js";
import { OtpHistoriesModel } from "../models/otpHistoryModel.js";
import { apiResponse, sendResponse } from "../utils/apiResponseFormat.js";
import sgMail from "@sendgrid/mail";

export const otpVerification = async (res, email, otp) => {
  // Find the most recent OTP for the email
  try {
    const verificationOtp = await OtpModel.find({ email })
      .sort({ createdAt: -1 })
      .limit(1);
    console.log({ verificationOtp, email });
    if (verificationOtp.length === 0 || otp !== verificationOtp[0].otp) {
      console.log("1");
      return false;
    }
    console.log("2");
    await OtpHistoriesModel.findOneAndUpdate(
      { email },
      { isUsage: true, usageAt: new Date() },
      { sort: { createdAt: -1 }, new: true }
    );
    console.log("3");
    return true;
  } catch (error) {
    console.log("OTP ERROR:", error);
    return false;
  }
};

// Define a function to send emails
export const sendVerificationEmail = async (
  req,
  email,
  otp,
  store_name = "",
  about = ""
) => {
  try {
    // const baseUrl = `${req.protocol}://${req.get("host")}`;
    // const logo = baseUrl + "/assets/email_logoraku.png";
    // const logo = "";

    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
      to: email,
      from: `Garapin Cloud <office@garapin.cloud>`, // Use the email address or domain you verified above
      subject: `Email verifikasi ${about}`,
      html: `
            <!DOCTYPE html>
            <html lang="en">
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${otp}</title>
                <style>
                    body {
                        font-family: 'Arial', sans-serif;
                        background-color: #f4f4f4;
                        color: #333;
                        margin: 0;
                        padding: 0;
                        -webkit-text-size-adjust: 100%;
                        -ms-text-size-adjust: 100%;
                    }
                    .container {
                        width: 100%;
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #fff;
                        padding: 20px;
                        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                        box-sizing: border-box;
                    }
                    .header {
                        text-align: center;
                        padding: 0 0;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    .header img {
                        width: 180px;
                        height: 180px;
                    }
                    .content {
                        padding: 20px;
                        text-align: center;
                    }
                    .content h1 {
                        font-size: 24px;
                        margin-bottom: 20px;
                        color: #3867d0;
                    }
                    .content p {
                        font-size: 16px;
                        line-height: 1.5;
                        margin: 10px 0;
                    }
                    .otp-code {
                        display: inline-block;
                        font-size: 36px;
                        font-weight: bold;
                        color: #fff;
                        background-color: #3867d0;
                        padding: 10px 20px;
                        border-radius: 5px;
                        letter-spacing: 5px;
                        margin: 20px 0;
                    }
                    .footer {
                        text-align: center;
                        padding: 20px;
                        border-top: 1px solid #e0e0e0;
                        margin-top: 20px;
                        font-size: 12px;
                        color: #777;
                    }
                    .footer a {
                        color: #3867d0;
                        text-decoration: none;
                    }
                    @media only screen and (max-width: 600px) {
                        .container {
                            padding: 10px;
                        }
                        .content h1 {
                            font-size: 20px;
                        }
                        .content p {
                            font-size: 14px;
                        }
                        .otp-code {
                            font-size: 28px;
                            padding: 10px;
                            letter-spacing: 3px;
                        }
                    }
                    @media only screen and (max-width: 400px) {
                        .content h1 {
                            font-size: 18px;
                        }
                        .content p {
                            font-size: 12px;
                        }
                        .otp-code {
                            font-size: 24px;
                            padding: 8px;
                            letter-spacing: 2px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <img src="${logo}" alt="Garapin Cloud" s>
                    </div>
                    <div class="content">
                        <h1>Your OTP Code</h1>
                        <p>Halo  <b>${store_name}</b>,</p>
                        <p>Berikut adalah OTP yang diminta:</p>
                        <div class="otp-code">${otp}</div>
                        <p>OTP ini hanya berlaku selama 5 menit. Jangan berikan OTP ini kepada siapapun. Abaikan pesan ini apabila Anda tidak meminta OTP.</p>
                        <p>Jika Anda memerlukan bantuan lebih lanjut, silakan hubungi layanan pelanggan kami.</p>
                        <p>Terima Kasih.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Garapin Cloud. All rights reserved.</p>
                        <p><a href="https://garapin.cloud/">Visit our website</a> | <a href="mailto:office@garapin.cloud">Contact Support</a></p>
                    </div>
                </div>
            </body>
            </html>


      `,
    };

    const sendEmail = await sgMail.send(msg);
    console.log("Email sent successfully: ", sendEmail);
  } catch (error) {
    console.error(error);

    if (error.response) {
      console.error(error.response.body);
    }
  }
};
