import { z } from "zod";

const createPositionSchema = z.object({
  name_position: z.string({
    required_error: "name_position is required",
  }),
  row: z.string({
    required_error: "row is required",
  }),
  column: z.string({
    required_error: "column is required",
  }),
  create_by: z.string({
    required_error: "create_by is required",
  }),
});

export { createPositionSchema };
