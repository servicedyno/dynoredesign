import express from "express";
import { walletController } from "../controller";

const walletRouter = express.Router();

// ============================================
// WALLET ADDRESS CRUD OPERATIONS (Merchant-facing)
// All CUD operations require OTP verification
// ============================================

// READ - Get wallet addresses (No OTP required)
walletRouter.get("/getWallet", walletController.getWallet);
walletRouter.get("/getWalletAddresses", walletController.getWalletAddresses);

// CREATE - Add wallet address (2-step OTP flow)
// Step 1: Validate address and send OTP
walletRouter.post("/validateWalletAddress", walletController.validateWallet);
// Step 2: Verify OTP and complete creation
walletRouter.post("/verifyOtp", walletController.verifyOtp);
// Alternative: Direct add (for merchants, no OTP)
walletRouter.post("/addWalletAddress", walletController.addWalletAddress);

// UPDATE - Edit wallet address (2-step OTP flow)
// Step 1: Send OTP for update
walletRouter.post("/address/send-otp", walletController.sendEditWalletOTP);
// Step 2: Verify OTP and update
walletRouter.put("/address/:id", walletController.editWalletAddress);

// DELETE - Delete wallet address (2-step OTP flow)
// Step 1: Send OTP for deletion
walletRouter.post("/address/delete/send-otp", walletController.sendDeleteWalletOTP);
// Step 2: Verify OTP and delete
walletRouter.post("/deleteWalletAddress", walletController.deleteWalletAddressWithOTP);

// DELETE - Remove wallet address from main payment system (Simple, no OTP)
// Used for payment forwarding wallets (tbl_user_wallet)
walletRouter.delete("/wallet/:wallet_id", walletController.deleteWalletAddress);
walletRouter.post("/wallet/delete", walletController.deleteWalletAddress); // Alternative POST method

// ============================================
// TRANSACTION & OTHER WALLET OPERATIONS
// ============================================
walletRouter.post("/getWalletTransactions/:id", walletController.getWalletTransactions);
walletRouter.post("/getAllTransactions", walletController.getAllTransactions);
walletRouter.get("/transaction/:id", walletController.getTransactionDetails);
walletRouter.post("/transactions/export", walletController.exportTransactions);

walletRouter.post("/addFunds", walletController.addFunds);
walletRouter.post("/authStep", walletController.authStep);
walletRouter.post("/verifyPayment", walletController.verifyPayment);
walletRouter.post("/confirmPayment", walletController.confirmPayment);
walletRouter.post("/verifyCryptoPayment", walletController.verifyCryptoPayment);
walletRouter.post("/getCurrencyRates", walletController.getCurrencyRates);
walletRouter.post("/estimateFees", walletController.estimateFees);
walletRouter.get("/network-fees", walletController.getNetworkFees);
walletRouter.post("/calculate-payment", walletController.calculatePaymentAmount);
walletRouter.post("/sendConfirmationOTP", walletController.sendConfirmationOTP);
walletRouter.post("/withdrawAssets", walletController.withdrawAssets);
walletRouter.post("/exchangeCreate", walletController.exchangeCreate);
walletRouter.post("/confirmExchange", walletController.confirmExchange);
walletRouter.post("/getUserAnalytics", walletController.getUserAnalytics);
walletRouter.get("/getExchange", walletController.getExchange);
walletRouter.get("/configured-currencies", walletController.getConfiguredCurrencies);

export default walletRouter;
