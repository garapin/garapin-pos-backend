import { connectTargetDatabase } from "../../config/targetDatabase.js";
import { cartRakItemSchema, cartRakSchema } from "../../models/cartRakModel.js";
import { rakCategorySchema } from "../../models/rakCategoryModel.js";
import { rakSchema } from "../../models/rakModel.js";
import { rakPositionSchema } from "../../models/rakPositionModel.js";
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

    let currentTotalPrice = cart.total_price;

    if (currentTotalPrice === 0) {
      return apiResponse(
        res,
        400,
        "Something wrong with total_price id_cart = " + cart._id
      );
    }

    let newTotalPrice = 0;
    if (cart?.items.length > 0) {
      cart?.items?.forEach((element) => {
        newTotalPrice +=
          newTotalPrice + element.product.price * element.quantity;
      });

      const isMatch = currentTotalPrice == newTotalPrice;

      if (!isMatch) {
        cart.total_price = newTotalPrice;
      }
    } else {
      cart.total_price = newTotalPrice;
    }

    await cart.save();
    return apiResponse(res, 200, "Success", cart);
  } catch (error) {
    console.error("Error getting cart:", error);
    return apiResponse(res, 500, "Internal Server Error", { error });
  }
};

const createCartRak = async (req, res, next) => {
  try {
    const { id_product, quantity, id_user, position_item } = req.body;

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
    const RakPositionModel = storeDatabase.model(
      "rakPosition",
      rakPositionSchema
    );
    const RakCategoryModel = storeDatabase.model(
      "RakCategory",
      rakCategorySchema
    );

    if (position_item.length < 1) {
      return apiResponse(res, 404, "Rak position not found", {});
    }

    const product = await productModelStore.findById(id_product);

    if (!product) {
      return apiResponse(res, 404, "Product not found", {});
    }

    const positionProduct = product.position_ref.map((id) => id.toString());

    for (let index = 0; index < position_item.length; index++) {
      let checkIfPositionMatch = positionProduct.includes(
        position_item[index]["id"]
      );
      if (!checkIfPositionMatch) {
        return apiResponse(res, 404, "Something wrong with position rak", {});
      }
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
        position_ref: position_item,
      });

      cart.items.push(newCartItem._id);
    } else {
      newQuantity = quantity;

      await CartRakItemModel.findOneAndUpdate(
        { product: product.id, cart: cart._id },
        {
          quantity: existingItemIndex.quantity + newQuantity,
          position_ref: position_item,
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

    const newCart = await cartModelStore.findById(cart._id).populate([
      {
        path: "items",
        populate: [
          {
            path: "product",
            model: "rak", // Assuming 'Product' is the name of your product model
          },
        ],
      },
    ]);

    return apiResponse(res, 200, "Menambahkan produk ke keranjang", newCart);
  } catch (error) {
    console.error("Error adding to cart:", error);
    return apiResponse(res, 500, "Internal Server Error", { error });
  }
};

const clearCartRak = async (req, res) => {
  try {
    const { id_user } = req.body;

    if (!id_user) {
      return apiResponse(res, 400, "Akun tidak ditemukan");
    }

    const targetDatabase = req.get("target-database");

    if (!targetDatabase) {
      return apiResponse(res, 400, "Target database is not specified");
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
      return apiResponse(res, 404, "Keranjang tidak ditemukan");
    }

    // Mengosongkan array items dalam objek keranjang

    const deletedCartItem = await CartRakItemModel.deleteMany({
      cart: cart._id,
    });

    return apiResponse(
      res,
      200,
      "Keranjang berhasil dikosongkan",
      deletedCartItem
    );
  } catch (error) {
    console.error("Error clearing cart:", error);
    return apiResponse(res, 500, "Internal Server Error", { error });
  }
};

export default { getCartRak, createCartRak, clearCartRak };
