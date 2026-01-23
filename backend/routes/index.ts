import express from "express";
import userRouter from "./userRouter";
import companyRouter from "./companyRouter";
import walletRouter from "./walletRouter";

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
router.use("/company", authMiddleware, companyRouter);
router.use("/userApi", authMiddleware, apiRouter);
router.use("/wallet", authMiddleware, walletMiddleware, walletRouter);
router.use("/pay", paymentRouter);

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
