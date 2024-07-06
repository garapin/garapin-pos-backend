import { z } from "zod";
// Schema for each item in list_rak
const listProductItemSchema = z.object({
  product: z
    .string({
      required_error: "product is required",
    })
    .min(1),
  stock: z.number({
    required_error: "stock is required",
  }),
});

const addProductToRakSchema = z.object({
  rent_id: z
    .string({
      required_error: "rent_id is required",
    })
    .min(1),
  list_product: z.array(listProductItemSchema).nonempty(),
});

export { addProductToRakSchema };
