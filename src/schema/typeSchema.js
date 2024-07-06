import { z } from "zod";

const createTypeSchema = z.object({
  name_type: z.string({
    required_error: "name_type is required",
  }),
  create_by: z.string({
    required_error: "create_by is required",
  }),
});

export { createTypeSchema };
