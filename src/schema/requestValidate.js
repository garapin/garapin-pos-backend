import { apiResponse } from "../utils/apiResponseFormat.js";

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (err) {
    apiResponse(res, 400, "Invalid request", { error: err.errors });
  }
};

export { validate };
