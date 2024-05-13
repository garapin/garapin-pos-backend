import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { cartRakItemSchema, cartRakSchema } from "../../models/cartRakModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { apiResponse } from "../../utils/apiResponseFormat.js";

const getCartRak = async (req, res) => {
  const id_user = req.query.id ?? "";

  try {
    if (id_user === "") {
      return apiResponse(res, 400, "Params id is required", {});
    }
    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }
    const storeDatabase = await connectTargetDatabase(targetDatabase);
    const productModelStore = storeDatabase.model("rak", rakSchema);
    const cartModelStore = storeDatabase.model("CartRak", cartRakSchema);
    const CartRakItemModel = storeDatabase.model(
      "CartRakTtem",
      cartRakItemSchema
    );

    let cart = await cartModelStore.findOne({ supplierId: id_user }).populate({
      path: "items",
      populate: {
        path: "product",
        model: "rak", // Assuming 'Product' is the name of your product model
      },
    });

    if (!cart) {
      return apiResponse(res, 200, "Cart not found", cart);
    }
    return apiResponse(res, 200, "Success", cart);
  } catch (error) {
    console.error("Error getting cart:", error);
    return apiResponse(res, 500, "Internal Server Error", { error });
  }
};

const createCartRak = async (req, res, next) => {
  try {
    const { id_product, quantity, id_user } = req.body;

    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified", {});
    }

    const storeDatabase = await connectTargetDatabase(targetDatabase);

    const productModelStore = storeDatabase.model("rak", rakSchema);
    const cartModelStore = storeDatabase.model("CartRak", cartRakSchema);
    const CartRakItemModel = storeDatabase.model(
      "CartRakTtem",
      cartRakItemSchema
    );

    const product = await productModelStore.findById(id_product);

    if (!product) {
      return apiResponse(res, 404, "Product not found", {});
    }

    let cart = await cartModelStore
      .findOne({ supplierId: id_user })
      .populate("items");

    if (!cart) {
      cart = await cartModelStore.create({ supplierId: id_user });
    }

    const existingItemIndex = await CartRakItemModel.findOne({
      product: id_product,
    });
    let newQuantity = 0;
    let total_price = 0;
    if (!existingItemIndex) {
      newQuantity = quantity;

      const newCartItem = await CartRakItemModel.create({
        product: product.id,
        quantity: newQuantity,
        cart: cart._id,
      });

      cart.items.push(newCartItem._id);
    } else {
      newQuantity = quantity;

      await CartRakItemModel.findOneAndUpdate(
        { product: product.id, cart: cart._id },
        {
          quantity: existingItemIndex.quantity + newQuantity,
        },
        { new: true }
      );
    }
    const oldProduct = await CartRakItemModel.find({
      cart: cart._id,
    }).populate("product");

    if (oldProduct) {
      oldProduct.forEach((row) => {
        total_price = total_price + row.product.price * row.quantity;
      });
    }

    cart.total_price = total_price;
    await cart.save();

    const newCart = await cartModelStore.findById(cart._id).populate({
      path: "items",
      populate: {
        path: "product",
        model: "rak", // Assuming 'Product' is the name of your product model
      },
    });

    return apiResponse(res, 200, "Menambahkan produk ke keranjang", newCart);
  } catch (error) {
    console.error("Error adding to cart:", error);
    return apiResponse(res, 500, "Internal Server Error", { error });
  }
};

export default { getCartRak, createCartRak };
