// routes/storeRoutes.js
import express from "express";
import storeController from "../controllers/storeController.js";
import authController from "../controllers/authController.js";
import brandControler from "../controllers/brandController.js";
import categoryController from "../controllers/categoryController.js";
import productController from "../controllers/productController.js";
import unitController from "../controllers/unitController.js";
import cartController from "../controllers/cartController.js";
import cartGuestController from "../controllers/cartGuestController.js";
import paymentController from "../controllers/paymentController.js";
import splitPaymentRuleController from "../controllers/splitPaymentRuleController.js";
import historyTransactionController from "../controllers/historyTransactionController.js";
import merchantController from "../controllers/merchantController.js";
import configController from "../controllers/configController.js";
import withdrawlController from "../controllers/withdrawlController.js";
import { body } from "express-validator";
import { verifyToken } from "../utils/jwt.js";
import { verifyXenditToken } from "../utils/xenditToken.js";

//raku
import authControllerRaku from "../controllers/om-controller/authController.js";
import storeControllerRaku from "../controllers/om-controller/storeController.js";
// import cartRakControllerRaku from "../controllers/om-controller/cartRakController.js";
import rakControllerRaku from "../controllers/om-controller/rakController.js";
import positionControllerRaku from "../controllers/om-controller/positionController.js";
import typeControllerRaku from "../controllers/om-controller/typeController.js";
import rakDetailControllerRaku from "../controllers/om-controller/rakDetailController.js";
import rakTransactionControllerRaku from "../controllers/om-controller/transactionController.js";
import rakPaymentControllerRaku from "../controllers/om-controller/paymentController.js";
import RakuCartController from "../controllers/om-controller/cartController.js";
import RakuProductController from "../controllers/om-controller/productController.js";
import RakuRentController from "../controllers/om-controller/rentController.js";
import RakuPlacementTransactionController from "../controllers/om-controller/placementController.js";
import { validate } from "../schema/requestValidate.js";

import {
  // createCartRakSchema,
  // clearCartRakSchema,
  createRakSchema,
  updateRakSchema,
} from "../schema/rakSchema.js";
import { signinSchema } from "../schema/signinSchema.js";
import { createPositionSchema } from "../schema/positionSchema.js";
import { createTypeSchema } from "../schema/typeSchema.js";
import { createRakDetailSchema } from "../schema/rakDetailSchema.js";
import {
  createTransactionSchema,
  updateTransactionSchema,
} from "../schema/transactionSchema.js";
import { addCartSchema, deleteCartSchema } from "../schema/cartSchema.js";
import {
  createProductSchema,
  updateProductSchema,
} from "../schema/productSchema.js";
import { addProductToRakSchema } from "../schema/placementSchema.js";
import {
  updateAccountHolderSchema,
  updateRegisterSchema,
} from "../schema/storeSchema.js";
import emailController from "../controllers/om-controller/emailController.js";
import {
  sendOtpVerificationSchema,
  verificationOtpSchema,
} from "../schema/emailSchema.js";
import configSettingsController from "../controllers/om-controller/configAppsController.js";
import { updateconfigAppZodSchema } from "../schema/configSettingsSchema.js";
import reportController from "../controllers/reportController.js";

const router = express.Router();

// // raku authentication
// router.post(
//   "/raku/auth/signin_with_google",
//   validate(signinSchema),
//   authController.signinWithGoogle
// );

//authenticate
router.get("/config/version", configController.versionApps);
router.get("/config/version/v2", configController.versionAppsV2);
router.post("/auth/login", authController.login);
router.post("/auth/signin_with_google", authController.signinWithGoogle);
router.post("/auth/logout", authController.logout);

//approval merchant belum dilindungi
router.post(
  "/store/merchant/approval",
  merchantController.approvalRequestMerchant
);

//WEBHOOK

// WEBHOOK QRIS;l
router.post("/webhook/:db", paymentController.xenditWebhook);
// WEBHOOK VA
router.use("/webhook_va/:type", verifyXenditToken);
router.post("/webhook_va/:type", paymentController.webhookVirtualAccount);
// WEBHOOK WITHDRAW
router.use("/webhook_withdraw", verifyXenditToken);
router.post("/webhook_withdraw", withdrawlController.webhookWithdraw);

// xendit callback invoice
router.post(
  "/raku/xendit/invoice/callback",
  rakPaymentControllerRaku.invoiceCallback
);




//cart-guest-mode
router.post("/store/cart-guest/create", cartGuestController.addToCart);



router.use(verifyToken);

// store
router.post("/store/register", storeController.registerStore);
router.post("/store/register_cashier", storeController.registerCashier);
router.post("/store/remove_cashier", storeController.removeCashier);
router.post("/store/update", storeController.updateStore);
router.post("/store/update/add_bank_account", storeController.addBankAccount);
router.post(
  "/store/update/request_bussiness_partner",
  storeController.requestBussinessPartner
);
router.get("/store/get-info", storeController.getStoreInfo);
router.get("/store/get_stores_database", storeController.getAllStoreInDatabase);
router.get(
  "/store/get_stores_database_id_parent",
  storeController.getStoresByParentId
);
router.get(
  "/store/get_stores_database_id_parent/trx",
  storeController.getTrxNotRegisteredInTemplateByIdParent
);
router.post("/store/update_policy", storeController.updatePrivacyPolice);

//brand
router.get("/store/brand", brandControler.getAllBrands);
router.post("/store/brand/create", brandControler.createBrand);
router.post("/store/brand/edit", brandControler.editBrand);
router.post("/store/brand/delete/:id", brandControler.deleteBrand);
router.get("/store/brand/:id", brandControler.getBrandById);

//category
router.post("/store/category/create", categoryController.createCategory);
router.post("/store/category/edit", categoryController.editCategory);
router.get("/store/category", categoryController.getAllCategories);
router.post("/store/category/delete/:id", categoryController.deleteCategory);
router.get("/store/category/:id", categoryController.getSingleCategories);

//product
router.post("/store/product/create", productController.createProduct);
router.post("/store/product/edit", productController.editProduct);
router.post("/store/product/delete/:id", productController.deleteProduct);
router.get("/store/product", productController.getAllProducts);
router.get("/store/product/icon", productController.getIconProducts);
router.get("/store/product/:id", productController.getSingleProduct);

//unit
router.post("/store/unit/create", unitController.createUnit);
router.post("/store/unit/edit", unitController.editUnit);
router.get("/store/unit", unitController.getAllUnits);
router.post("/store/unit/delete/:id", unitController.deleteUnit);
router.get("/store/unit/:id", unitController.getSingleUnits);

//cart
router.post("/store/cart/create", cartController.addToCart);
router.post("/store/cart/clear_all", cartController.clearCart);
router.get("/store/cart/:id", cartController.getCartByUser);

//payment
router.get(
  "/store/transcation/payment_available",
  paymentController.paymentAvailable
);
router.post(
  "/store/transcation/create-invoices",
  paymentController.createInvoice
);
router.post(
  "/store/transaction/create-invoices-topup",
  paymentController.createInvoiceTopUp
);
router.get("/store/transcation/invoces/:id", paymentController.getInvoices);
router.get(
  "/store/transcation/invoces/cancel/:id",
  paymentController.cancelInvoices
);
router.post("/store/transcation/create-qrcode", paymentController.createQrCode);
router.post(
  "/store/transaction/create-qrcode-topup",
  paymentController.createQrCodePaymentLockedAccount
);
router.post(
  "/store/transcation/create-va",
  paymentController.createVirtualAccount
);
router.post(
  "/store/transaction/create-va-topup",
  paymentController.createVirtualAccountPaymentLockedAccount
);
router.get("/store/transcation/qrcode/:id", paymentController.getQrCode);
router.post("/store/transcation/payment-cash", paymentController.paymentCash);

//split payment rules
router.post("/store/split_rule", splitPaymentRuleController.createSplitRule);
router.get("/store/split_rule/:id", splitPaymentRuleController.getSplitRuleTRX);
router.post("/store/crate_template", splitPaymentRuleController.createTemplate);
router.post(
  "/store/template/update",
  splitPaymentRuleController.updateTemplate
);
router.get("/store/split/:id", splitPaymentRuleController.getTemplateById);
router.get("/store/template/all", splitPaymentRuleController.getAllTemplates);
router.post(
  "/store/template/add_fee_cust",
  splitPaymentRuleController.addFeeCustomer
);
router.post(
  "/store/template/change_status",
  splitPaymentRuleController.activationTemplate
);
router.post(
  "/store/template/target/delete",
  splitPaymentRuleController.deleteTargetTemplate
);

//merchanr
router.post("/store/merchant/create", merchantController.createMerchant);
router.get("/store/merchant/all", merchantController.getAllMerchant);
// router.post('/store/merchant/approval', merchantController.approvalRequestMerchant);
router.post(
  "/store/merchant/accept_invitation",
  merchantController.acceptInvitationMerchant
);

//history transaction
router.post(
  "/store/transaction/history",
  historyTransactionController.historyTransaction
);
router.post(
  "/store/transaction/history/report",
  historyTransactionController.historyTransactionReport
);
router.post(
  "/store/transaction/get_total_income",
  historyTransactionController.getTotalIncomeTransaction
);
router.post(
  "/store/transaction/get_total_bagi",
  historyTransactionController.getTotalIncomeBagi
);
router.post(
  "/store/transaction/history/v2",
  historyTransactionController.historyTransactionV2
);
router.post(
  "/store/transaction/history/product",
  historyTransactionController.transactionDetailNonSplit
);
router.post(
  "/store/transaction/history/support",
  historyTransactionController.historyTransactionSupport
);
router.post(
  "/store/transaction/history/detail",
  historyTransactionController.transactionDetail
);
router.post(
  "/store/transaction/history/filter/:role",
  historyTransactionController.getFilterStore
);
router.post(
  "/store/transaction/history/transaction/today",
  historyTransactionController.historyTransactionToday
);
router.post(
  "/store/bagibagi/history/merchant",
  historyTransactionController.getAllMerchant
);

// //withdrawl
router.get("/store/balance/get_balance", withdrawlController.getBalance);
router.post(
  "/store/balance/verify_pin",
  withdrawlController.verifyPinWIthdrawl
);
router.post("/store/balance/withdraw", withdrawlController.withdrawl);
router.get(
  "/store/balance/withdraw/history",
  withdrawlController.getWithdrawHistory
);
router.post(
  "/store/balance/withdraw/check_amount",
  withdrawlController.withdrawCheckAmount
);
router.get(
  "/store/amount/pending_transaction",
  paymentController.getAmountFromPendingTransaction
);

// test
router.post("/test/garapin_cost", paymentController.testGarapinCost);
router.get("/test/login", configController.loginTest);

// router.post('/store/transcation/ewallet',paymentController.createEwallet);
// router.post('/webhook/:id/:db' ,paymentController.xenditWebhook);

// raku buka

router.post(
  "/raku/auth/send-otp",
  validate(sendOtpVerificationSchema),
  emailController.sendOTP
);

router.post(
  "/raku/auth/verification-otp",
  validate(verificationOtpSchema),
  emailController.verificationOTP
);

// cart raku
router.get("/raku/supplier/cart", RakuCartController.getCartByUserId);
router.post(
  "/raku/supplier/cart",
  validate(addCartSchema),
  RakuCartController.addCart
);
router.delete(
  "/raku/supplier/cart",
  validate(deleteCartSchema),
  RakuCartController.deleteItemCart
);
// router.delete(
//   "/raku/supplier/cart",
//   validate(clearCartRakSchema),
//   cartRakControllerRaku.clearCartRak
// );

// rak transaction raku
router.get(
  "/store/rak-transaction",
  rakTransactionControllerRaku.getAllTransactionByUser
);
router.post(
  "/store/rak-transaction",
  validate(createTransactionSchema),
  rakTransactionControllerRaku.createTransaction
);
router.put(
  "/store/rak-transaction/already-paid",
  validate(updateTransactionSchema),
  rakTransactionControllerRaku.updateAlreadyPaidDTransaction
);

// rak raku
router.post(
  "/store/rak",
  validate(createRakSchema),
  rakControllerRaku.createRak
);
router.put(
  "/store/rak",
  validate(updateRakSchema),
  rakControllerRaku.updateRak
);
router.get("/store/rak", rakControllerRaku.getAllRak);
router.get("/store/rak-detail", rakControllerRaku.getSingleRak);

router.post(
  "/store/rak-detail",
  validate(createRakDetailSchema),
  rakDetailControllerRaku.createRakDetail
);

// position raku
router.post(
  "/store/position",
  validate(createPositionSchema),
  positionControllerRaku.createPosition
);
router.get("/store/position", positionControllerRaku.getAllPosition);

// type raku
router.post(
  "/store/type",
  validate(createTypeSchema),
  typeControllerRaku.createType
);
router.get("/store/type", typeControllerRaku.getAllType);

// store raku
router.patch(
  "/raku/supplier/update-email-account-holder/:account_holder_id",
  validate(updateAccountHolderSchema),
  storeControllerRaku.updateAccountHolder
);
// router.post("/raku/supplier/register", storeController.registerStore);
router.post("/raku/supplier/register", storeControllerRaku.registerStore);
router.post("/raku/supplier/update", storeControllerRaku.updateStore);
router.get("/raku/supplier/all-store", storeControllerRaku.getAllStoreRaku);

router.get("/store/raku/get-profile", storeController.getStoreProfile);

// product raku
router.post(
  "/raku/supplier/product",
  validate(createProductSchema),
  RakuProductController.createProduct
);
router.put(
  "/raku/supplier/product",
  validate(updateProductSchema),
  RakuProductController.editProduct
);
router.get("/raku/supplier/product", RakuProductController.getAllProducts);
router.get(
  "/raku/supplier/product/:id",
  RakuProductController.getSingleProduct
);
router.delete(
  "/raku/supplier/product/:id",
  RakuProductController.deleteProduct
);

// stock management
router.get(
  "/raku/supplier/product/:id/stock-history",
  RakuProductController.getStockHistorySingleProduct
);
router.get(
  "/raku/supplier/stock-history",
  RakuProductController.getStockHistory
);

// rent
router.get(
  "/raku/supplier/rent/user/:user_id",
  RakuRentController.getRentedRacksByUser
);

router.post(
  "/raku/supplier/rent/engine-status",
  RakuRentController.engineResetStatus
);

// placement transaction
router.post(
  "/raku/supplier/placement",
  validate(addProductToRakSchema),
  RakuPlacementTransactionController.addProductToRak
);
router.get(
  "/raku/supplier/placement/user",
  RakuPlacementTransactionController.getAllPlacementByUser
);

router.get(
  "/raku/supplier/placement",
  RakuPlacementTransactionController.getAllPlacement
);

// config settings
// router.post(
//   "/store/config-settings/",
//   validate(addconfigSettingZodSchema),
//   configSettingsController.addConfigSetting
// );

router.get(
  "/store/pos-config-apps/",
  configSettingsController.getConfigSetting
);

router.patch(
  "/store/pos-config-apps/:id",
  validate(updateconfigAppZodSchema),
  configSettingsController.updateConfigSetting
);

router.get(
  "/store/master-config-apps/",
  configSettingsController.getMasterConfigSetting
);

router.patch(
  "/store/master-config-apps/:id",
  validate(updateconfigAppZodSchema),
  configSettingsController.updateMasterConfigSetting
);

/// report
router.get("/store/report/transaction", reportController.reportTransaction);
router.get("/store/report/transaction/payment-method", reportController.reportTransactionByPaymentMethod);
router.get("/store/report/transaction/product", reportController.reportTransactionByProduct);
router.get("/store/report/transaction/bagi-bagi", reportController.reportBagiBagi);

// raku tutup

export default router;
