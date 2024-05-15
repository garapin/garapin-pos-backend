import { z } from "zod";

const signinSchema = z.object({
  email: z.string({ required_error: "Email is required" }).email(),
});

export { signinSchema };
