import express from "express";
import {
  authMiddleware,
  paymentMiddleware,
  userMiddleware,
} from "../middleware";

import controller from "../controller";

const router = express.Router();

router.post("/user/createUser", userMiddleware, controller.createUser);
router.post(
  "/user/createPayment",
  authMiddleware,
  paymentMiddleware,
  controller.createPayment
);

router.post("/user/useWallet", authMiddleware, controller.useWallet);

router.post(
  "/user/cryptoPayment",
  authMiddleware,
  paymentMiddleware,
  controller.cryptoPayment
);
router.post(
  "/user/addFunds",
  authMiddleware,
  paymentMiddleware,
  controller.addFunds
);

router.get("/user/getTransactions", authMiddleware, controller.getTransactions);
router.get(
  "/user/getCryptoTransaction/:address",
  authMiddleware,
  controller.getCryptoTransaction
);
router.get(
  "/getSupportedCurrency",
  authMiddleware,
  controller.getSupportedCurrency
);

router.get(
  "/user/getSingleTransaction/:id",
  authMiddleware,
  controller.getSingleTransaction
);
router.get("/user/getBalance", authMiddleware, controller.getBalance);

export default router;
