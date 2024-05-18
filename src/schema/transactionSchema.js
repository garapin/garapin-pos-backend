import { z } from "zod";
// Schema for rak_detail
const rakDetailSchema = z.object({
  rak_name: z.string(),
  price_perday: z.number(),
  category_name: z.string(),
  type_name: z.string(),
});

// Schema for each item in list_rak
const listRakItemSchema = z.object({
  rak_id: z.string(),
  position_id: z.string(),
  number_of_days: z.number(),
  total_harga: z.number(),
  rak_detail: rakDetailSchema,
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
});
const createTransactionSchema = z.object({
  create_by: z.string(),
  list_rak: z.array(listRakItemSchema).nonempty(),
});

const updateTransactionSchema = z.object({
  transaction_id: z.string({
    required_error: "transaction_id is required",
  }),
});

export { createTransactionSchema, updateTransactionSchema };
