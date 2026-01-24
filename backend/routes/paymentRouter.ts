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

// Public endpoint for internal service-to-service calls (API service → Main backend)
paymentRouter.post(
  "/getCurrencyRatesInternal",
  paymentController.getCurrencyRates
);

// Public endpoint for blockchain network fees (used by checkout pages)
paymentRouter.get(
  "/network-fees",
  paymentController.getNetworkFees
);

// Public endpoint to calculate payment amount with fees
paymentRouter.post(
  "/calculate-payment",
  paymentController.calculatePaymentAmount
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

paymentRouter.get(
  "/links/:id",
  authMiddleware,
  paymentController.getPaymentLinkById
);

paymentRouter.put(
  "/links/:id",
  authMiddleware,
  paymentController.updatePaymentLink
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
