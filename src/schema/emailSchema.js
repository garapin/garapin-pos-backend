import { z } from "zod";

const sendOtpVerificationSchema = z.object({
  email: z.string().email(),
  about_what: z.string(),
});

export { sendOtpVerificationSchema };
