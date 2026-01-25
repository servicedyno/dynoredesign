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

// TEMPORARY TEST ENDPOINT - For manual fee balance check testing
paymentRouter.get("/test-fee-balance-alert", async (req, res) => {
  try {
    console.log("Manual fee balance check triggered via test endpoint");
    await paymentController.checkFeeBalance();
    res.json({ 
      success: true, 
      message: "Fee balance check completed. Check logs and your email (moxxcompany@gmail.com)" 
    });
  } catch (error) {
    console.error("Test endpoint error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error checking fee balance", 
      error: error.message 
    });
  }
});

// TEMPORARY TEST ENDPOINT - Clear Redis cooldown to force email
paymentRouter.get("/test-clear-fee-alert-cooldown", async (req, res) => {
  try {
    const { deleteRedisItem } = await import("../helper");
    await deleteRedisItem("admin_fee_alert");
    console.log("Redis cooldown cleared - next check will send email");
    res.json({ 
      success: true, 
      message: "Cooldown cleared. Now call /test-fee-balance-alert to send email immediately" 
    });
  } catch (error) {
    console.error("Error clearing cooldown:", error);
    res.status(500).json({ 
      success: false, 
      message: "Error clearing cooldown", 
      error: error.message 
    });
  }
});

export default paymentRouter;
