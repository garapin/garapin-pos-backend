import { z } from "zod";

const addCartSchema = z.object({
  db_user: z.string(),
  rak: z.string(),
  position: z.string(),
  start_date: z.string().date(),
  end_date: z.string().date(),
});

const deleteCartSchema = z.object({
  db_user: z.string(),
  rak_id: z.string(),
  position_id: z.string(),
});

export { addCartSchema, deleteCartSchema };
