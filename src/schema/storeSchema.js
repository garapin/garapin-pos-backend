import { z } from "zod";

// Define a regex for a base64 encoded image string
const base64ImageRegex =
  /^data:image\/(png|jpeg|jpg|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

// Create a Zod schema using the regex
const base64ImageSchema = z
  .string()
  .regex(base64ImageRegex, {
    message: "Invalid base64 image format",
  })
  .nullable(); // Allow null values

// Define the overall request schema
const updateRegisterSchema = z.object({
  store_name: z.string(),
  pic_name: z.string(),
  phone_number: z.string(),
  country: z.string(),
  state: z.string(),
  city: z.string(),
  address: z.string(),
  postal_code: z.string(),
  store_image: base64ImageSchema,
  bank_name: z.string(),
  holder_name: z.string(),
  account_number: z.string(),
  account_holder: z.object({
    email: z.string().email(),
    type: z.string(), // Assuming 'type' can be 'OWNED' or 'SHARED'
    public_profile: z.object({
      business_name: z.string(),
    }),
  }),
  id_card_number: z.string().optional(),
  id_card_image: base64ImageSchema,
});

export { updateRegisterSchema };
