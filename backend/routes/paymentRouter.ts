import express from "express";
import { paymentController } from "../controller";
import {
  authMiddleware,
  customerAuthMiddleware,
  linkMiddleware,
} from "../middleware";

const paymentRouter = express.Router();

paymentRouter.post("/getData", paymentController.getData);

paymentRouter.post(
  "/addPayment",
  customerAuthMiddleware,
  paymentController.addPayment
);

paymentRouter.post(
  "/createCryptoPayment",
  customerAuthMiddleware,
  paymentController.createCryptoPayment
);

paymentRouter.post(
  "/authStep",
  customerAuthMiddleware,
  paymentController.authStep
);

paymentRouter.post(
  "/verifyPayment",
  customerAuthMiddleware,
  paymentController.verifyPayment
);

paymentRouter.post(
  "/verifyCryptoPayment",
  customerAuthMiddleware,
  paymentController.verifyCryptoPayment
);

paymentRouter.post(
  "/confirmPayment",
  customerAuthMiddleware,
  paymentController.confirmPayment
);
paymentRouter.post(
  "/getCurrencyRates",
  customerAuthMiddleware,
  paymentController.getCurrencyRates
);

paymentRouter.get(
  "/getBalance",
  customerAuthMiddleware,
  paymentController.getBalance
);

paymentRouter.get(
  "/getPaymentLinks",
  authMiddleware,
  paymentController.getPaymentLinks
);

paymentRouter.post(
  "/createPaymentLink",
  authMiddleware,
  linkMiddleware,
  paymentController.createPaymentLink
);

paymentRouter.delete(
  "/deletePaymentLink/:id",
  authMiddleware,
  paymentController.deletePaymentLink
);

export default paymentRouter;
