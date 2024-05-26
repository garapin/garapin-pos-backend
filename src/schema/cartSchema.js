import { z } from "zod";

const addCartSchema = z.object({
  user_id: z.string(),
  rak: z.string(),
  position: z.string(),
  start_date: z.string().date(),
  end_date: z.string().date(),
});

export { addCartSchema };
