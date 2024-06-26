import { z } from "zod";

const addconfigSettingZodSchema = z.object({
  category: z.enum(["payment", "rak"]),
  configCode: z.string(),
  name: z.string(),
  value: z.string(),
  type: z.enum(["string", "number", "array", "float", "decimal"]),
  description: z.string().optional(),
});

const updateconfigSettingZodSchema = z.object({
  payment_duration: z.number(),
  minimum_rent_date: z.number(),
});

export { addconfigSettingZodSchema, updateconfigSettingZodSchema };
