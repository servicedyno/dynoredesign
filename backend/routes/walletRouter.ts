import express from "express";
import { walletController } from "../controller";

const walletRouter = express.Router();

walletRouter.get("/getWallet", walletController.getWallet);
walletRouter.get("/getWalletAddresses", walletController.getWalletAddresses);
walletRouter.post(
  "/validateWalletAddress",
  walletController.validateWallet
);
walletRouter.post(
  "/verifyCode",
  walletController.verifyOtp
);

walletRouter.post(
  "/deleteWalletAddress",
  walletController.deleteWalletAddress
);

walletRouter.post(
  "/getWalletTransactions/:id",
  walletController.getWalletTransactions
);

walletRouter.post("/getAllTransactions", walletController.getAllTransactions);
walletRouter.post("/addWalletAddress", walletController.addWalletAddress);

walletRouter.post("/addFunds", walletController.addFunds);
walletRouter.post("/authStep", walletController.authStep);
walletRouter.post("/verifyPayment", walletController.verifyPayment);
walletRouter.post("/confirmPayment", walletController.confirmPayment);
walletRouter.post("/verifyCryptoPayment", walletController.verifyCryptoPayment);
walletRouter.post("/getCurrencyRates", walletController.getCurrencyRates);
walletRouter.post("/estimateFees", walletController.estimateFees);
walletRouter.post("/sendConfirmationOTP", walletController.sendConfirmationOTP);
walletRouter.post("/withdrawAssets", walletController.withdrawAssets);
walletRouter.post("/exchangeCreate", walletController.exchangeCreate);
walletRouter.post("/confirmExchange", walletController.confirmExchange);
walletRouter.post("/getUserAnalytics", walletController.getUserAnalytics);
walletRouter.get("/getExchange", walletController.getExchange);

export default walletRouter;
