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
import splitPaymentRuleController from '../controllers/splitPaymentRuleController.js';
import merchantController from '../controllers/merchantController.js';
import { body } from 'express-validator';
import { verifyToken } from '../utils/jwt.js'; 
import { verifyXenditToken } from '../utils/xenditToken.js';


const router = express.Router();

//authenticate
router.post('/auth/login', authController.login);
router.post('/auth/signin_with_google', authController.signinWithGoogle);
router.post('/auth/logout', authController.logout);



router.use(verifyToken); 
// store
router.post('/store/register', storeController.registerStore);
router.post('/store/register_cashier', storeController.registerCashier);
router.post('/store/remove_cashier', storeController.removeCashier);
router.post('/store/update', storeController.updateStore);
router.post('/store/update/add_bank_account', storeController.addBankAccount);
router.get('/store/get-info', storeController.getStoreInfo);
router.get('/store/get_stores_database', storeController.getAllStoreInDatabase);
router.get('/store/get_stores_database_id_parent', storeController.getStoresByParentId);

//brand
router.get('/store/brand', brandControler.getAllBrands);
router.post('/store/brand/create', brandControler.createBrand);
router.post('/store/brand/edit', brandControler.editBrand);
router.post('/store/brand/delete/:id', brandControler.deleteBrand);
router.get('/store/brand/:id', brandControler.getBrandById);

//category
router.post('/store/category/create', categoryController.createCategory);
router.post('/store/category/edit', categoryController.editCategory);
router.get('/store/category', categoryController.getAllCategories);
router.post('/store/category/delete/:id', categoryController.deleteCategory);
router.get('/store/category/:id', categoryController.getSingleCategories);



//product
router.post('/store/product/create', productController.createProduct);
router.post('/store/product/edit', productController.editProduct);
router.post('/store/product/delete/:id', productController.deleteProduct);
router.get('/store/product', productController.getAllProducts);
router.get('/store/product/icon', productController.getIconProducts);
router.get('/store/product/:id', productController.getSingleProduct);

//unit
router.post('/store/unit/create', unitController.createUnit);
router.post('/store/unit/edit', unitController.editUnit);
router.get('/store/unit', unitController.getAllUnits);
router.post('/store/unit/delete/:id', unitController.deleteUnit);
router.get('/store/unit/:id', unitController.getSingleUnits);



//cart
router.post('/store/cart/create', cartController.addToCart);
router.post('/store/cart/clear_all', cartController.clearCart);
router.get('/store/cart/:id', cartController.getCartByUser);

//payment
router.get('/store/transcation/payment_available', paymentController.paymentAvailable);
router.post('/store/transcation/create-invoices', paymentController.createInvoice);
router.get('/store/transcation/invoces/:id', paymentController.getInvoices);
router.get('/store/transcation/invoces/cancel/:id', paymentController.cancelInvoices);
router.post('/store/transcation/create-qrcode', paymentController.createQrCode);
router.post('/store/transcation/create-va', paymentController.createVirtualAccount);
router.get('/store/transcation/qrcode/:id', paymentController.getQrCode);
router.post('/store/transcation/payment-cash', paymentController.paymentCash);

//split payment rules
router.post('/store/split_rule', splitPaymentRuleController.createSplitRule);

//merchanr
router.post('/store/merchant/create', merchantController.createMerchant);
router.get('/store/merchant/all', merchantController.getAllMerchant);
router.post('/store/merchant/approval', merchantController.approvalRequestMerchant);
router.post('/store/merchant/accept_invitation', merchantController.acceptInvitationMerchant);


// router.post('/store/transcation/ewallet',paymentController.createEwallet);
// router.post('/webhook/:id/:db' ,paymentController.xenditWebhook);


router.post('/webhook/:db', paymentController.xenditWebhook);

router.use('/webhook_va/:type', verifyXenditToken);
router.post('/webhook_va/:type', paymentController.webhookVirtualAccount);






export default router;