import { z } from "zod";

const createRakDetailSchema = z.object({
  rak_id: z.string({
    required_error: "rak_id is required",
  }),
  position_id: z.string({
    required_error: "position_id is required",
  }),
});

export { createRakDetailSchema };
