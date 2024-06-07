import { z } from "zod";

const sendOtpVerificationSchema = z.object({
  store_name: z.string(),
  email: z.string().email(),
  about_what: z.string().optional(),
});

const verificationOtpSchema = z.object({
  email: z.string().email(),
  otp_code: z.string(),
});

export { sendOtpVerificationSchema, verificationOtpSchema };
