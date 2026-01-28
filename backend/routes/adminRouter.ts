import express from "express";
import adminController from "../controller/adminController";
import { adminAuthMiddleware } from "../middleware";
import usdtPoolService from "../services/usdtPoolService";

const adminRouter = express.Router();

adminRouter.post("/login", adminController.login);
adminRouter.post(
  "/createWallets",
  adminAuthMiddleware,
  adminController.createWallets
);
adminRouter.post(
  "/withdrawAssets",
  adminAuthMiddleware,
  adminController.withdrawAssets
);
adminRouter.get("/getWallets", adminAuthMiddleware, adminController.getWallets);
adminRouter.get(
  "/getAllTransactions",
  adminAuthMiddleware,
  adminController.getAllTransactions
);

adminRouter.get(
  "/getAllUsers",
  adminAuthMiddleware,
  adminController.getAllUsers
);

adminRouter.post(
  "/getAdminAnalytics",
  adminAuthMiddleware,
  adminController.getAdminAnalytics
);

adminRouter.get(
  "/getTransferFees",
  adminAuthMiddleware,
  adminController.getTransferFees
);
adminRouter.get(
  "/getFeeWalletBalance",
  adminAuthMiddleware,
  adminController.getFeeWalletBalance
);
adminRouter.post(
  "/newTransactionFee",
  adminAuthMiddleware,
  adminController.newTransactionFee
);

adminRouter.put(
  "/changePassword",
  adminAuthMiddleware,
  adminController.changePassword
);

adminRouter.put(
  "/updateTransferFees",
  adminAuthMiddleware,
  adminController.updateTransferFees
);

adminRouter.put(
  "/updateEmail",
  adminAuthMiddleware,
  adminController.updateEmail
);

adminRouter.put(
  "/updateFeeLimits",
  adminAuthMiddleware,
  adminController.updateFeeLimits
);

adminRouter.get(
  "/getTransactionFee",
  adminAuthMiddleware,
  adminController.getTransactionFee
);

// adminRouter.get(
//   "/getBlockchainFeeConfigs",
//   adminAuthMiddleware,
//   adminController.getBlockchainFeeConfigs
// );

// adminRouter.post(
//   "/updateBlockchainFeeConfig",
//   adminAuthMiddleware,
//   adminController.updateBlockchainFeeConfig
// );

// adminRouter.post(
//   "/updateFeeTier",
//   adminAuthMiddleware,
//   adminController.updateFeeTier
// );

// USDT Pool Management Routes
adminRouter.get(
  "/usdtPoolStatus",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const status = await usdtPoolService.getPoolStatus();
      res.json({ success: true, data: status });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

adminRouter.post(
  "/usdtPoolSweep",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      await usdtPoolService.sweepAllEligibleAddresses();
      res.json({ success: true, message: "Sweep initiated" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

adminRouter.post(
  "/usdtPoolAddAddress",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const { walletType } = req.body;
      if (!["USDT-TRC20", "USDT-ERC20"].includes(walletType)) {
        return res.status(400).json({ success: false, message: "Invalid wallet type" });
      }
      const newAddress = await usdtPoolService.addAddressToPool(walletType);
      res.json({ success: true, data: newAddress });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Test endpoint: Request an address from pool (auto-expands if all IN_USE)
adminRouter.post(
  "/usdtPoolRequestAddress",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const { walletType, paymentId } = req.body;
      if (!["USDT-TRC20", "USDT-ERC20"].includes(walletType)) {
        return res.status(400).json({ success: false, message: "Invalid wallet type" });
      }
      const address = await usdtPoolService.getAvailableAddress(walletType, paymentId);
      res.json({ 
        success: true, 
        message: "Address assigned (auto-created if pool was full)",
        data: {
          pool_address_id: address.dataValues.pool_address_id,
          wallet_address: address.dataValues.wallet_address,
          status: address.dataValues.status,
          admin_fee_balance: address.dataValues.admin_fee_balance,
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

// Test endpoint: Release an address back to pool
adminRouter.post(
  "/usdtPoolReleaseAddress",
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const { poolAddressId, adminFeeAmount, gasUsed } = req.body;
      if (!poolAddressId) {
        return res.status(400).json({ success: false, message: "poolAddressId required" });
      }
      await usdtPoolService.releaseAddress(poolAddressId, adminFeeAmount || 0, gasUsed || 0);
      res.json({ success: true, message: "Address released back to pool" });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
);

export default adminRouter;
