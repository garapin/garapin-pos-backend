import { apiResponse } from "./apiResponseFormat.js";

const notFound = (req, res, next) => {
  return apiResponse(res, 404, `Not Found: ${req?.originalUrl}`, []);
};

export { notFound };
