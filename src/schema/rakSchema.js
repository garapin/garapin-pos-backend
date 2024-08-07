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

const positionsUpdate = z.object({
  id: z.string({
    required_error: "id is required",
  }),
  name_position: z.string({
    required_error: "name_position is required",
  }),
  row: z.string({
    required_error: "row is required",
  }),
  column: z.string({
    required_error: "column is required",
  }),
  height: z.number({
    required_error: "height is required",
  }),
  long_size: z.number({
    required_error: "long_size is required",
  }),
  // status: z.string({
  //   required_error: "status is required",
  // }),
  filter: z.array(z.string().optional()).optional(),
  available_date: z.string().date(),
});

const positions = z.object({
  name_position: z.string({
    required_error: "name_position is required",
  }),
  row: z.string({
    required_error: "row is required",
  }),
  column: z.string({
    required_error: "column is required",
  }),
  height: z.number({
    required_error: "height is required",
  }),
  long_size: z.number({
    required_error: "long_size is required",
  }),
  filter: z.array(z.string().optional()).optional(),
  available_date: z.string().date(),
});

const createRakSchema = z.object({
  name: z.string({
    required_error: "name is required",
  }),
  // sku: z.string({
  //   required_error: "sku is required",
  // }),
  image: z.string({
    required_error: "image is required",
  }),
  height: z.number({
    required_error: "height is required",
  }),
  long_size: z.number({
    required_error: "long_size is required",
  }),
  discount: z.number({
    required_error: "discount is required",
  }),
  price_perday: z.number({
    required_error: "price_perday is required",
  }),
  create_by: z.string({
    required_error: "create_by is required",
  }),
  category_id: z.string({
    required_error: "category_id is required",
  }),
  type_id: z.string({
    required_error: "type_id is required",
  }),
  positions: z.array(positions).nonempty(),
});

const updateRakSchema = z.object({
  name: z.string({
    required_error: "name is required",
  }),
  // sku: z.string({
  //   required_error: "sku is required",
  // }),
  image: z.string({
    required_error: "image is required",
  }),
  height: z.number({
    required_error: "height is required",
  }),
  long_size: z.number({
    required_error: "long_size is required",
  }),
  discount: z.number({
    required_error: "discount is required",
  }),
  price_perday: z.number({
    required_error: "price_perday is required",
  }),
  create_by: z.string({
    required_error: "create_by is required",
  }),
  category_id: z.string({
    required_error: "category_id is required",
  }),
  type_id: z.string({
    required_error: "type_id is required",
  }),
  positions: z.array(positionsUpdate).nonempty(),
});

export {
  createCartRakSchema,
  clearCartRakSchema,
  createRakSchema,
  updateRakSchema,
};
