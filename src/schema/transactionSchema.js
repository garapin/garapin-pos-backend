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
  rak: z.string(),
  position: z.string(),
  // number_of_days: z.number(),
  // rak_detail: rakDetailSchema,
  total_date: z.number(),
});
const createTransactionSchema = z.object({
  db_user: z.string(),
  list_rak: z.array(listRakItemSchema).nonempty(),
  // payer_name: z.string({ required_error: "payer_name is required" }),
  // payer_email: z.string({ required_error: "payer_email is required" }).email(),
});

const updateTransactionSchema = z.object({
  transaction_id: z.string({
    required_error: "transaction_id is required",
  }),
});

export { createTransactionSchema, updateTransactionSchema };
