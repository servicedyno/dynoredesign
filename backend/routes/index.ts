import express from "express";
import userRouter from "./userRouter";
import companyRouter from "./companyRouter";
import walletRouter from "./walletRouter";
import taxRouter from "./taxRouter";
import dashboardRouter from "./dashboardRouter";
import notificationRouter from "./notificationRouter";
import invoiceRouter from "./invoiceRouter";
import kycRouter from "./kycRouter";
import statusRouter from "./statusRouter";
import subscriptionRouter from "./subscriptionRouter";
import testRouter from "./testRouter";
import referralRouter from "./referralRouter";
import knowledgeBaseRouter from "./knowledgeBaseRouter";
import merchantApiRouter from "./merchantApiRouter";

import {
  authMiddleware,
  walletMiddleware,
} from "../middleware";
// ITatumWebHook, IWebHook imports removed - not used
import apiRouter from "./apiRouter";
import paymentRouter from "./paymentRouter";
import {
  flutterwaveWebHook,
  tatumCryptoWebHook,
  tatumWebHook,
} from "../webhooks";
import adminRouter from "./adminRouter";

const router = express.Router();

// Base API route - Returns API status and available endpoints
router.get("/", (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: "operational",
    service: "Dynopay API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    documentation: "/api-docs",
    endpoints: {
      authentication: "/api/user",
      admin: "/api/admin",
      companies: "/api/company",
      apiKeys: "/api/userApi",
      wallets: "/api/wallet",
      payments: "/api/pay",
      tax: "/api/tax",
      dashboard: "/api/dashboard",
      notifications: "/api/notifications",
      kyc: "/api/kyc",
      status: "/api/status",
      subscriptions: "/api/subscriptions",
      referrals: "/api/referral",
      knowledgeBase: "/api/kb",
      invoices: "/api/invoices"
    }
  });
});

router.use("/user", userRouter);
// Merchant API routes (unified — replaces legacy api-service on port 3301)
// Supports both OLD (x-api-key + wallet_token) and NEW (x-api-key + customer JWT) auth
router.use("/user", merchantApiRouter);
router.use("/admin", adminRouter);
router.use("/company", companyRouter);
router.use("/userApi", apiRouter);
router.use("/wallet", authMiddleware, walletMiddleware, walletRouter);
router.use("/pay", paymentRouter);
router.use("/tax", taxRouter);
router.use("/dashboard", dashboardRouter);
router.use("/notifications", notificationRouter);
router.use("/kyc", kycRouter);
router.use("/status", statusRouter); // Public status page endpoints
router.use("/subscriptions", subscriptionRouter); // Subscription management
router.use("/test", testRouter); // Test endpoints for development
router.use("/referral", referralRouter); // Referral system endpoints
router.use("/kb", knowledgeBaseRouter); // Knowledge Base endpoints
router.use("/", invoiceRouter); // Invoice routes (transactions/:id/invoice, invoices, invoices/:id)

router.post("/webhook", flutterwaveWebHook);
router.post("/failed_webhook", flutterwaveWebHook);
router.post("/tatum-webhook", tatumWebHook);
router.post("/tatum-crypto-webhook", tatumCryptoWebHook);
router.post("/test-webhook", (req: express.Request, res: express.Response) => {
  console.log(req.body, JSON.stringify(req.body));
  const tempData = req.body;
  console.log("from test-webhook==========tempData==============>", tempData);

  res.status(200).end();
});

export default router;
