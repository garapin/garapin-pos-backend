import { connectTargetDatabase } from '../config/targetDatabase.js';
import { apiResponse } from '../utils/apiResponseFormat.js';
import { ProductModel, productSchema } from '../models/productModel.js';
import { CartModel, cartSchema } from '../models/cartModel.js';

const addToCart = async (req, res) => {
    try {
      const { id_product, quantity, id_user } = req.body;
  
      if (!id_user) {
        return apiResponse(res, 400, 'Akun tidak ditemukan');
      }
  
      const targetDatabase = req.get('target-database');
  
      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
  
      const storeDatabase = await connectTargetDatabase(targetDatabase);
  
      const productModelStore = storeDatabase.model('Product', productSchema);
      const cartModelStore = storeDatabase.model('Cart', cartSchema);
  
      const product = await productModelStore.findById(id_product);
  
      if (!product) {
        return apiResponse(res, 404, 'Product not found');
      }
  
      let cart = await cartModelStore.findOne({ user: id_user }).populate('items.product');
  
      if (!cart) {
        cart = new cartModelStore({ user: id_user, items: [] });
      }
  
      const existingItemIndex = cart.items.findIndex(
        (item) => String(item.product._id) === id_product
      );
  
      if (existingItemIndex !== -1) {
        cart.items[existingItemIndex].quantity += quantity;
      } else {
        cart.items.push({ product: product, quantity });
      }
  
      await cart.save();
  
      return apiResponse(res, 200, 'Menambahkan produk ke keranjang', cart);
    } catch (error) {
      console.error('Error adding to cart:', error);
      return apiResponse(res, 500, 'Internal Server Error');
    }
  };
  const getCartByUser = async (req, res) => {
    try {
        const id_user = req.params.id;
  
      if (!id_user) {
        return apiResponse(res, 400, 'Akun tidak ditemukan');
      }
  
      const targetDatabase = req.get('target-database');
  
      if (!targetDatabase) {
        return apiResponse(res, 400, 'Target database is not specified');
      }
  
      const storeDatabase = await connectTargetDatabase(targetDatabase);
      const productModelStore = storeDatabase.model('Product', productSchema);
      const cartModelStore = storeDatabase.model('Cart', cartSchema);
  
      let cart = await cartModelStore.findOne({ user: id_user }).populate('items.product');
  
      if (!cart) {
        return apiResponse(res, 404, 'Keranjang belanja tidak ditemukan');
      }
  
      return apiResponse(res, 200, 'Success', cart);
    } catch (error) {
      console.error('Error getting cart:', error);
      return apiResponse(res, 500, 'Internal Server Error');
    }
  };

export default { addToCart, getCartByUser };
