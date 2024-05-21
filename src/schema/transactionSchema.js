import { z } from "zod";

const rakDetailSchema = z.object({
  rak_name: z.string(),
  price_perday: z.number(),
  category_name: z.string(),
  type_name: z.string(),
  position_name: z.string(),
  position_height: z.number(),
  position_long_size: z.number(),
});

// Schema for each item in list_rak
const listRakItemSchema = z.object({
  rak_id: z.string(),
  position_id: z.string(),
  // number_of_days: z.number(),
  // rak_detail: rakDetailSchema,
  start_date: z.string().date(),
  end_date: z.string().date(),
});
const createTransactionSchema = z.object({
  create_by: z.string(),
  list_rak: z.array(listRakItemSchema).nonempty(),
  payer_email: z.string({ required_error: "payer_email is required" }).email(),
});

const updateTransactionSchema = z.object({
  transaction_id: z.string({
    required_error: "transaction_id is required",
  }),
});

export { createTransactionSchema, updateTransactionSchema };
