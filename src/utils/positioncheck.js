import { connectTargetDatabase } from "../config/targetDatabase.js";
import { positionSchema } from "../models/positionModel.js";
import { productSchema } from "../models/productModel.js";

async function isPositionCanInput(
  position_id,
  productOnSupplier,
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

  if (!productinpos) {
    return { isavailable: true, message: "Position available" };
  }

  if (productinpos.status !== "ACTIVE") {
    return { isavailable: true, message: "Position  used expired product" };
  }

  // console.log("====================================");
  // console.log(productinpos.db_user == productOnSupplier.db_user);
  // console.log("====================================");

  if (productinpos.db_user != productOnSupplier.db_user) {
    return { isavailable: false, message: "Position used other User" };
  }

  // console.log(productinpos.inventory_id);
  // console.log(productOnSupplier._id);

  // console.log(productinpos.inventory_id.equals(productOnSupplier._id));

  if (productinpos.inventory_id.equals(productOnSupplier._id)) {
    return { isavailable: true, message: "Position used same product" };
  }

  return {
    isavailable: ischange,
    message: "Position  use your other product",
  };
}

export default isPositionCanInput;
