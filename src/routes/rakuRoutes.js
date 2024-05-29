import express from "express";
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
import { validate } from "../schema/requestValidate.js";

import {
  // createCartRakSchema,
  // clearCartRakSchema,
  createRakSchema,
} from "../schema/rakSchema.js";
import { signinSchema } from "../schema/signinSchema.js";
import { createPositionSchema } from "../schema/positionSchema.js";
import { createTypeSchema } from "../schema/typeSchema.js";
import { createRakDetailSchema } from "../schema/rakDetailSchema.js";
import {
  createTransactionSchema,
  updateTransactionSchema,
} from "../schema/transactionSchema.js";
import { addCartSchema } from "../schema/cartSchema.js";
import RakiCartController from "../controllers/om-controller/cartController.js";
import { verifyToken } from "../utils/jwt.js";

const rakuRouter = express.Router();

//authenticate raku
rakuRouter.post(
  "/raku/auth/signin_with_google",
  validate(signinSchema),
  authControllerRaku.signinWithGoogle
);

rakuRouter.use(verifyToken);

rakuRouter.post("/raku/auth/send-otp", authControllerRaku.sendOTP);

// cart raku
rakuRouter.get("/raku/supplier/cart", RakiCartController.getCartByUserId);
rakuRouter.post(
  "/raku/supplier/cart",
  validate(addCartSchema),
  RakiCartController.addCart
);
// rakuRouter.delete(
//   "/raku/supplier/cart",
//   validate(clearCartRakSchema),
//   cartRakControllerRaku.clearCartRak
// );

// rak transaction raku
rakuRouter.get(
  "/store/rak-transaction",
  rakTransactionControllerRaku.getAllTransactionByUser
);
rakuRouter.post(
  "/store/rak-transaction",
  validate(createTransactionSchema),
  rakTransactionControllerRaku.createTransaction
);
rakuRouter.put(
  "/store/rak-transaction/already-paid",
  validate(updateTransactionSchema),
  rakTransactionControllerRaku.updateAlreadyPaidDTransaction
);

// rak raku
rakuRouter.post(
  "/store/rak",
  validate(createRakSchema),
  rakControllerRaku.createRak
);
rakuRouter.get("/store/rak", rakControllerRaku.getAllRak);
rakuRouter.get("/store/rak-user", rakControllerRaku.getRentedRacksByUser);
rakuRouter.get("/store/rak-detail", rakControllerRaku.getSingleRak);

// rak detail raku
rakuRouter.post(
  "/store/rak-detail",
  validate(createRakDetailSchema),
  rakDetailControllerRaku.createRakDetail
);
// rakuRouter.get("/store/rak", rakControllerRaku.getAllRak);

// position raku
rakuRouter.post(
  "/store/position",
  validate(createPositionSchema),
  positionControllerRaku.createPosition
);
rakuRouter.get("/store/position", positionControllerRaku.getAllPosition);

// type raku
rakuRouter.post(
  "/store/type",
  validate(createTypeSchema),
  typeControllerRaku.createType
);
rakuRouter.get("/store/type", typeControllerRaku.getAllType);

// store raku
rakuRouter.post("/raku/supplier/register", storeControllerRaku.registerStore);
rakuRouter.post("/raku/supplier/update", storeControllerRaku.updateStore);

// xendit callback invoice
rakuRouter.post(
  "/raku/xendit/invoice/callback",
  rakPaymentControllerRaku.invoiceCallback
);

export default rakuRouter;
