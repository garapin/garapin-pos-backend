import { z } from "zod";

const publicProfileSchema = z.object({
  business_name: z.string(),
});

const accountHolderSchema = z.object({
  email: z.string().email(),
  type: z.enum(["OWNED", "OTHER"]), // Assuming 'OWNED' and 'OTHER' are possible values
  public_profile: publicProfileSchema,
});

const updateSchema = z.object({
  store_name: z.string(),
  pic_name: z.string(),
  phone_number: z.string(),
  address: z.string(),
  city: z.string(),
  country: z.string(),
  state: z.string(),
  postal_code: z.string(),
  store_image: z.string().optional(),
  bank_name: z.string(),
  holder_name: z.string(),
  account_number: z.number(),
  otp_code: z.string(),
  email: z.string().email(),
  account_holder: accountHolderSchema,
});

export { updateSchema };
