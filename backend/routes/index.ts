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

import {
  authMiddleware,
  companyMiddleware,
  userMiddleware,
  walletMiddleware,
} from "../middleware";
import { ITatumWebHook, IWebHook } from "../utils/types";
import { paymentTypes } from "../utils/enums";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";
import apiRouter from "./apiRouter";
import paymentRouter from "./paymentRouter";
import {
  flutterwaveWebHook,
  tatumCryptoWebHook,
  tatumWebHook,
} from "../webhooks";
import adminRouter from "./adminRouter";

const router = express.Router();

router.use("/user", userRouter);
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
