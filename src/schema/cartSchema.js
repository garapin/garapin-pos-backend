import { z } from "zod";

const addCartSchema = z.object({
  user_id: z.string(),
  rak_id: z.string(),
  position_id: z.string(),
  start_date: z.string().date(),
  end_date: z.string().date(),
});

export { addCartSchema };
