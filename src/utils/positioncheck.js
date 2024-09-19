import { connectTargetDatabase } from "../config/targetDatabase.js";
import { positionSchema } from "../models/positionModel.js";
import { productSchema } from "../models/productModel.js";

async function isPositionCanInput(
  position_id,
  product_id,
  storeDatabase,
  ischange = false
) {
  const PositionModelStore = storeDatabase.model("position", positionSchema);
  const ProductModelStore = storeDatabase.model("Product", productSchema);
  const position = await PositionModelStore.findById(position_id);
  const productinpos = await ProductModelStore.findOne({
    position_id: position_id,
  });

  if (!position) {
    return { isavailable: false, message: "Position not found" };
  }

  if (position.status !== "RENT" && position.status !== "IN_COMING") {
    return { isavailable: false, message: "Position not available" };
  }

  if (!productinpos && !ischange) {
    return { isavailable: true, message: "Position available" };
  }

  if (
    !productinpos.inventory_id.equals(product_id) &&
    !ischange &&
    productinpos.status !== "DELETED"
  ) {
    return { isavailable: false, message: "position used other product" };
  }

  if (productinpos.position_id.includes(position_id)) {
    console.log("Position have same product");
    productinpos.status = "ACTIVE";
    await productinpos.save();
    return { isavailable: true, message: "Position have same product" };
  }

  return { isavailable: true, message: "Position available" };
}

export default isPositionCanInput;
