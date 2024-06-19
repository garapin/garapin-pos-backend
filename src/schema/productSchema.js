import { z } from "zod";

const createProductSchema = z.object({
  name: z
    .string({
      required_error: "name is required",
    })
    .min(1),
  sku: z
    .string({
      required_error: "sku is required",
    })
    .min(1),

  category_ref: z
    .string({
      required_error: "category_ref is required",
    })
    .min(1),
  brand_ref: z
    .string({
      required_error: "brand_ref is required",
    })
    .min(1),
  unit_ref: z
    .string({
      required_error: "unit_ref is required",
    })
    .min(1),
  image: z
    .string({
      required_error: "image is required",
    })
    .min(1),
  icon: z.string({
    required_error: "icon is required",
  }),
  discount: z
    .number({
      required_error: "discount is required",
    })
    .min(0),
  price: z
    .number({
      required_error: "price is required",
    })
    .min(0),
  expired_date: z.string().date(),
  stock: z
    .number({
      required_error: "stock is required",
    })
    .min(0),
  minimum_stock: z
    .number({
      required_error: "minimum_stock is required",
    })
    .min(0),
  length: z
    .number({
      required_error: "length is required",
    })
    .min(0),
  width: z
    .number({
      required_error: "width is required",
    })
    .min(0),
  db_user: z.string({
    required_error: "db_user / supplier db is required",
  }),
});

const updateProductSchema = z.object({
  id: z
    .string({
      required_error: "id is required",
    })
    .min(1),
  name: z
    .string({
      required_error: "name is required",
    })
    .min(1),
  sku: z
    .string({
      required_error: "sku is required",
    })
    .min(1),
  category_ref: z
    .string({
      required_error: "category_ref is required",
    })
    .min(1),
  brand_ref: z
    .string({
      required_error: "brand_ref is required",
    })
    .min(1),
  unit_ref: z
    .string({
      required_error: "unit_ref is required",
    })
    .min(1),
  image: z.string({
    required_error: "image is required",
  }),

  icon: z.string({
    required_error: "icon is required",
  }),
  discount: z
    .number({
      required_error: "discount is required",
    })
    .min(0),
  price: z
    .number({
      required_error: "price is required",
    })
    .min(0),
  expired_date: z.string().date(),
  stock: z
    .number({
      required_error: "stock is required",
    })
    .min(0),
  minimum_stock: z
    .number({
      required_error: "minimum_stock is required",
    })
    .min(0),
  length: z
    .number({
      required_error: "length is required",
    })
    .min(0),
  width: z
    .number({
      required_error: "width is required",
    })
    .min(0),
  db_user: z.string({
    required_error: "db_user / supplider db is required",
  }),
});

export { createProductSchema, updateProductSchema };
