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
import historyTransactionController from '../controllers/historyTransactionController.js';
import merchantController from '../controllers/merchantController.js';
import configController from '../controllers/configController.js';
import withdrawlController from '../controllers/withdrawlController.js';
import { body } from 'express-validator';
import { verifyToken } from '../utils/jwt.js'; 
import { verifyXenditToken } from '../utils/xenditToken.js';


const router = express.Router();

//authenticate
router.get('/config/version', configController.versionApps);
router.get('/config/version/v2', configController.versionAppsV2);
router.post('/auth/login', authController.login);
router.post('/auth/signin_with_google', authController.signinWithGoogle);
router.post('/auth/logout', authController.logout);

//approval merchant belum dilindungi
router.post('/store/merchant/approval', merchantController.approvalRequestMerchant);


//WEBHOOK

// WEBHOOK QRIS;l
router.post('/webhook/:db', paymentController.xenditWebhook);
// WEBHOOK VA
router.use('/webhook_va/:type', verifyXenditToken);
router.post('/webhook_va/:type', paymentController.webhookVirtualAccount);
// WEBHOOK WITHDRAW
router.use('/webhook_withdraw', verifyXenditToken);
router.post('/webhook_withdraw', withdrawlController.webhookWithdraw);




router.use(verifyToken); 
// store
router.post('/store/register', storeController.registerStore);
router.post('/store/register_cashier', storeController.registerCashier);
router.post('/store/remove_cashier', storeController.removeCashier);
router.post('/store/update', storeController.updateStore);
router.post('/store/update/add_bank_account', storeController.addBankAccount);
router.post('/store/update/request_bussiness_partner', storeController.requestBussinessPartner);
router.get('/store/get-info', storeController.getStoreInfo);
router.get('/store/get_stores_database', storeController.getAllStoreInDatabase);
router.get('/store/get_stores_database_id_parent', storeController.getStoresByParentId);
router.get('/store/get_stores_database_id_parent/trx', storeController.getTrxNotRegisteredInTemplateByIdParent);


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
router.get('/store/split_rule/:id', splitPaymentRuleController.getSplitRuleTRX);
router.post('/store/crate_template', splitPaymentRuleController.createTemplate);
router.post('/store/template/update', splitPaymentRuleController.updateTemplate);
router.get('/store/split/:id', splitPaymentRuleController.getTemplateById);
router.get('/store/template/all', splitPaymentRuleController.getAllTemplates);
router.post('/store/template/add_fee_cust', splitPaymentRuleController.addFeeCustomer);
router.post('/store/template/change_status', splitPaymentRuleController.activationTemplate);
router.post('/store/template/target/delete', splitPaymentRuleController.deleteTargetTemplate);

//merchanr
router.post('/store/merchant/create', merchantController.createMerchant);
router.get('/store/merchant/all', merchantController.getAllMerchant);
// router.post('/store/merchant/approval', merchantController.approvalRequestMerchant);
router.post('/store/merchant/accept_invitation', merchantController.acceptInvitationMerchant);

//history transaction
router.post('/store/transaction/history', historyTransactionController.historyTransaction);
router.post('/store/transaction/history/report', historyTransactionController.historyTransactionReport);
router.post('/store/transaction/get_total_income', historyTransactionController.getTotalIncomeTransaction);
router.post('/store/transaction/get_total_bagi', historyTransactionController.getTotalIncomeBagi);
router.post('/store/transaction/history/v2', historyTransactionController.historyTransactionV2);
router.post('/store/transaction/history/product', historyTransactionController.transactionDetailNonSplit);
router.post('/store/transaction/history/support', historyTransactionController.historyTransactionSupport);
router.post('/store/transaction/history/detail', historyTransactionController.transactionDetail);
router.post('/store/transaction/history/filter/:role', historyTransactionController.getFilterStore);
router.post('/store/transaction/history/transaction/today', historyTransactionController.historyTransactionToday);


// //withdrawl
router.get('/store/balance/get_balance', withdrawlController.getBalance);
router.post('/store/balance/verify_pin', withdrawlController.verifyPinWIthdrawl);
router.post('/store/balance/withdraw', withdrawlController.withdrawl);
router.get('/store/balance/withdraw/history', withdrawlController.getWithdrawHistory);
router.post('/store/balance/withdraw/check_amount', withdrawlController.withdrawCheckAmount);




// test
router.post('/test/garapin_cost', paymentController.testGarapinCost);
router.get('/test/login', configController.loginTest);


// router.post('/store/transcation/ewallet',paymentController.createEwallet);
// router.post('/webhook/:id/:db' ,paymentController.xenditWebhook);








export default router;