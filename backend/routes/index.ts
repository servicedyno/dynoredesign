import express from "express";
import { apiLogger } from "../utils/loggers";
import userRouter from "./userRouter";
import eventsRouter from "./eventsRouter";
import analyticsRouter from "./analyticsRouter";
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
import { strictRateLimiter } from "../middleware/rateLimitMiddleware";
import apiRouter from "./apiRouter";
import paymentRouter from "./paymentRouter";
import {
  flutterwaveWebHook,
  tatumCryptoWebHook,
  tatumWebHook,
} from "../webhooks";
import crypto from "crypto";
import adminRouter from "./adminRouter";
import { logWebhookValidationFailure } from "../utils/securityLogger";

/**
 * Tatum webhook HMAC signature verification middleware.
 * If TATUM_WEBHOOK_SECRET is configured, validates the x-payload-hash header.
 * If not configured, logs a warning and allows the request (backward compatible).
 */
const verifyTatumWebhookSource = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.TATUM_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — skip verification (backward compatible)
    return next();
  }

  const signature = req.headers["x-payload-hash"] as string;
  if (!signature) {
    // Existing subscriptions may not have HMAC enabled — allow but warn
    apiLogger.warn(`[WebhookAuth] Missing x-payload-hash header from ${req.ip} — allowing (legacy subscription)`);
    return next();
  }

  const rawBody = JSON.stringify(req.body);
  const expectedSignature = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  if (signature !== expectedSignature) {
    apiLogger.warn(`[WebhookAuth] Invalid webhook signature from ${req.ip}`);
    logWebhookValidationFailure('tatum', req.ip || 'unknown', 'Invalid HMAC signature');
    return res.status(401).json({ error: "Invalid webhook signature" });
  }

  next();
};

const router = express.Router();

// Base API route - Returns API status and available endpoints
router.get("/", (_req: express.Request, res: express.Response) => {
  res.status(200).json({
    status: "operational",
    service: "Dynopay API",
    version: "1.0.0",
    api_version: "v1",
    timestamp: new Date().toISOString(),
    documentation: "/api/docs",
    versioning: {
      current: "v1",
      base_url: "/api",
      versioned_url: "/api/v1",
      note: "Both /api/* and /api/v1/* are supported. Use /api/v1/* for explicit version pinning."
    },
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
// Merchant API routes (unified) — supports both OLD and NEW auth flows
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
router.use("/events", eventsRouter); // SSE real-time events
router.use("/admin/analytics", analyticsRouter); // Admin analytics (revenue, cohorts, funnels)
router.use("/", invoiceRouter); // Invoice routes (transactions/:id/invoice, invoices, invoices/:id)

router.post("/webhook", strictRateLimiter, flutterwaveWebHook);
router.post("/failed_webhook", strictRateLimiter, flutterwaveWebHook);
router.post("/tatum-webhook", strictRateLimiter, verifyTatumWebhookSource, tatumWebHook);
router.post("/tatum-crypto-webhook", strictRateLimiter, verifyTatumWebhookSource, tatumCryptoWebHook);

export default router;
