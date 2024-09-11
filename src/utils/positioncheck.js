import { connectTargetDatabase } from "../config/targetDatabase.js";
import { positionSchema } from "../models/positionModel.js";
import { productSchema } from "../models/productModel.js";

async function isPositionCanInput(position_id, storeDatabase) {
  const PositionModelStore = storeDatabase.model("position", positionSchema);
  const ProductModelStore = storeDatabase.model("Product", productSchema);
  const position = await PositionModelStore.findById(position_id);

  if (!position) {
    return { isavailable: false, message: "Position not found" };
  }

  if (position.status !== "RENT" && position.status !== "IN_COMING") {
    return { isavailable: false, message: "Position not available" };
  }

  const productinpos = await ProductModelStore.findOne({
    position_id: position_id,
  });

  if (productinpos) {
    console.log(productinpos);

    return { isavailable: false, message: "Position already used" };
  }

  return { isavailable: true, message: "Position available" };
}

export default isPositionCanInput;
