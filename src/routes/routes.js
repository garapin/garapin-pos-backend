// routes/storeRoutes.js
import express from 'express';
import storeController from '../controllers/storeController.js';
import authController from '../controllers/authController.js';
import brandControler from '../controllers/brandController.js';
import categoryController from '../controllers/categoryController.js';
import productController from '../controllers/productController.js';
import unitController from '../controllers/unitController.js';


const router = express.Router();

// store
router.post('/store/register', storeController.registerStore);
router.post('/store/register_cashier', storeController.registerCashier);
router.post('/store/update', storeController.updateStore);
router.get('/store/get-info', storeController.getStoreInfo);

//brand
router.get('/store/brand',brandControler.getAllBrands);
router.post('/store/brand/create',brandControler.createBrand);
router.post('/store/brand/edit',brandControler.editBrand);
router.get('/store/brand/:id',brandControler.getBrandById);

//category
router.post('/store/category/create',categoryController.createCategory);
router.post('/store/category/edit',categoryController.editCategory);
router.get('/store/category',categoryController.getAllCategories);
router.get('/store/category/:id',categoryController.getSingleCategories);



//product
router.post('/store/product/create',productController.createProduct);
router.post('/store/product/edit',productController.editProduct);
router.get('/store/product',productController.getAllProducts);
router.get('/store/product/:id',productController.getSingleProduct);

//unit
router.post('/store/unit/create',unitController.createUnit);
router.post('/store/unit/edit',unitController.editUnit);
router.get('/store/unit',unitController.getAllUnits);
router.get('/store/unit/:id',unitController.getSingleUnits);

//authenticate
router.post('/auth/login', authController.login);
router.post('/auth/signin_with_google', authController.signinWithGoogle);
router.post('/auth/logout', authController.logout);

export default router;