// routes/storeRoutes.js
import express from 'express';
import storeController from '../controllers/storeController.js';
import authController from '../controllers/authController.js';
import brandControler from '../controllers/brandController.js';
import categoryController from '../controllers/categoryController.js';
import productController from '../controllers/productController.js';
import unitController from '../controllers/unitController.js';
import cartController from '../controllers/cartController.js';
import paymentController from '../controllers/paymentController.js';
import { body } from 'express-validator';
import { verifyToken} from '../utils/jwt.js'; // Middleware untuk otentikasi token


const router = express.Router();

//authenticate
router.post('/auth/login', authController.login);
router.post('/auth/signin_with_google', authController.signinWithGoogle);
router.post('/auth/logout', authController.logout);


// router.use(verifyToken); 

// store
router.post('/store/register', storeController.registerStore);
router.post('/store/register_cashier', storeController.registerCashier);
router.post('/store/remove_cashier', storeController.removeCashier);
router.post('/store/update', storeController.updateStore);
router.get('/store/get-info', storeController.getStoreInfo);

//brand
router.get('/store/brand',brandControler.getAllBrands);
router.post('/store/brand/create',brandControler.createBrand);
router.post('/store/brand/edit',brandControler.editBrand);
router.post('/store/brand/delete/:id',brandControler.deleteBrand);
router.get('/store/brand/:id',brandControler.getBrandById);

//category
router.post('/store/category/create',categoryController.createCategory);
router.post('/store/category/edit',categoryController.editCategory);
router.get('/store/category',categoryController.getAllCategories);
router.post('/store/category/delete/:id',categoryController.deleteCategory);
router.get('/store/category/:id',categoryController.getSingleCategories);



//product
router.post('/store/product/create',productController.createProduct);
router.post('/store/product/edit',productController.editProduct);
router.post('/store/product/delete/:id',productController.deleteProduct);
router.get('/store/product',productController.getAllProducts);
router.get('/store/product/icon',productController.getIconProducts);
router.get('/store/product/:id',productController.getSingleProduct);

//unit
router.post('/store/unit/create',unitController.createUnit);
router.post('/store/unit/edit',unitController.editUnit);
router.get('/store/unit',unitController.getAllUnits);
router.post('/store/unit/delete/:id',unitController.deleteUnit);
router.get('/store/unit/:id',unitController.getSingleUnits);



//cart
router.post('/store/cart/create', cartController.addToCart);
router.get('/store/cart/:id', cartController.getCartByUser);

//payment
router.post('/store/transcation/create-invoices',paymentController.createInvoice);
router.get('/store/transcation/invoces/:id',paymentController.getInvoices);
router.get('/store/transcation/invoces/cancel/:id',paymentController.cancelInvoices);
router.post('/store/transcation/create-qrcode',paymentController.createQrCode);
router.get('/store/transcation/qrcode/:id',paymentController.getQrCode);
router.post('/webhook/:id/:db' ,paymentController.xenditWebhook);


export default router;