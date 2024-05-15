import { z } from "zod";

const createCartRakSchema = z.object({
  quantity: z.number({
    required_error: "quantity is required",
  }),
  id_product: z.string({
    required_error: "target_database is required",
  }),
  id_user: z.string({
    required_error: "id_user is required",
  }),
  position_item: z
    .array(
      z.object({
        id: z.string({ required_error: "id position is required" }),
        startRentalTime: z
          .string({
            required_error: "Start Rental Time is required",
          })
          .date(),
        endRentalTime: z
          .string({
            required_error: "End Rental Time is required",
          })
          .date(),
      })
    )
    .nonempty("At least one position is required"),
});

const clearCartRakSchema = z.object({
  id_user: z.string({
    required_error: "id_user is required",
  }),
});

export { createCartRakSchema, clearCartRakSchema };
