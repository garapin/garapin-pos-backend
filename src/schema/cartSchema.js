import { z } from "zod";

const addCartSchema = z.object({
  db_user: z.string(),
  rak: z.string(),
  position: z.string(),
  total_date: z.number(),
});

const deleteCartSchema = z.object({
  db_user: z.string(),
  rak_id: z.string(),
  position_id: z.string(),
});

export { addCartSchema, deleteCartSchema };
