import express from "express";
import adminController from "../controller/adminController";
import { adminAuthMiddleware } from "../middleware";

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

// ── User Management ──────────────────────────────────────────────────────────
adminRouter.get(
  "/users/:userId",
  adminAuthMiddleware,
  adminController.getUserDetail
);
adminRouter.put(
  "/users/:userId/ban",
  adminAuthMiddleware,
  adminController.banUser
);
adminRouter.post(
  "/users/unlock",
  adminAuthMiddleware,
  adminController.unlockUser
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

// ── Alert Service Endpoints ─────────────────────────────────────────────────
import alertService, { sendAlert, getHealth as getAlertHealth } from "../services/slackAlertService";

adminRouter.get("/alerts/health", adminAuthMiddleware, (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Alert service health",
    data: getAlertHealth(),
  });
});

adminRouter.post("/alerts/test", adminAuthMiddleware, async (_req, res) => {
  try {
    const result = await sendAlert({
      title: "Test Alert",
      message: "This is a test alert from DynoPay admin panel.",
      severity: "info",
      fields: { "Triggered by": "Admin test endpoint" },
    });
    res.status(200).json({
      success: true,
      message: "Test alert sent",
      data: { delivered: result },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send test alert", error: (err as Error).message });
  }
});

export default adminRouter;
