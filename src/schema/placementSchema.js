import { z } from "zod";

const addProductToRakSchema = z.object({
  rent_id: z
    .string({
      required_error: "rent_id is required",
    })
    .min(1),

  create_by: z
    .string({
      required_error: "create_by is required",
    })
    .min(1),
  product_id: z
    .string({
      required_error: "product_id is required",
    })
    .min(1),
});

export { addProductToRakSchema };
