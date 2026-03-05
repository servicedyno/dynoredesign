import express, { RequestHandler } from "express";
import { userController } from "../controller";
import { authMiddleware, uploadImage, userMiddleware } from "../middleware";
import { 
  strictRateLimiter, 
  moderateRateLimiter, 
  loginRateLimiter,
  otpRateLimiter 
} from "../middleware/rateLimitMiddleware";
import { validate, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, twoFAValidateSchema } from "../middleware/validateRequest";
import sessionController from "../controller/sessionController";
import twoFactorController from "../controller/twoFactorController";
const userRouter = express.Router();

// Registration endpoints - moderate rate limiting (10 per 15 min per IP)
userRouter.post("/registerUser", moderateRateLimiter, validate(registerSchema), userMiddleware, userController.registerUser);
userRouter.post("/registerPhone", moderateRateLimiter, userController.registerPhoneStep1);
userRouter.post("/registerPhone/verify", moderateRateLimiter, userController.registerPhoneStep2);

// Login endpoint - strict rate limiting (5 per 15 min per IP+email combo) to prevent brute force
userRouter.post("/login", loginRateLimiter, validate(loginSchema), userMiddleware, userController.login);

// Email check - moderate rate limiting
userRouter.get("/checkEmail", moderateRateLimiter, userController.checkEmail);

// OTP endpoints - strict rate limiting (3 per 15 min per contact) to prevent OTP spam
userRouter.post("/generateOTP", otpRateLimiter, userController.generateOTP);
userRouter.post("/confirmOTP", otpRateLimiter, userController.confirmOTP);

// Social connect - moderate rate limiting
userRouter.post("/connectSocial", moderateRateLimiter, userController.connectSocial);

// Password reset endpoints - strict rate limiting (5 per 15 min per IP) to prevent abuse
userRouter.post("/forgot-password", strictRateLimiter, validate(forgotPasswordSchema), userController.forgotPassword);
userRouter.post("/reset-password", strictRateLimiter, validate(resetPasswordSchema), userController.resetPassword);

// Social Sign-In endpoints - moderate rate limiting (10 per 15 min per IP)
userRouter.post("/google-signin", moderateRateLimiter, userController.googleSignIn);
userRouter.post("/facebook-signin", moderateRateLimiter, userController.facebookSignIn);

// Profile endpoints (requires auth)
userRouter.get("/profile", authMiddleware, userController.getProfile);
userRouter.put("/profile", authMiddleware, userController.updateProfile);
userRouter.put("/email", authMiddleware, userController.changeEmail);
userRouter.put("/phone", authMiddleware, userController.changePhone);
userRouter.delete("/email", authMiddleware, userController.removeEmail);
userRouter.delete("/phone", authMiddleware, userController.removePhone);

userRouter.put(
  "/updateUser",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  userMiddleware,
  userController.updateUser
);

userRouter.put(
  "/changePassword",
  authMiddleware,
  validate(changePasswordSchema),
  userMiddleware,
  userController.changePassword
);

// Account deletion (requires auth)
userRouter.delete("/account", authMiddleware, userController.deleteAccount);

// Onboarding status (requires auth) - check wallet, KYC, API key, company setup status
userRouter.get("/onboarding-status", authMiddleware, userController.getOnboardingStatus);

// Email verification endpoints (requires auth)
userRouter.post("/verify-email", authMiddleware, userController.verifyEmail);
userRouter.post("/resend-verification", authMiddleware, otpRateLimiter, userController.resendVerification);

// Referee code unsubscribe (no auth required - uses token)
userRouter.post("/unsubscribe-reminders", userController.unsubscribeFromReminders);
userRouter.get("/unsubscribe-reminders/:token", userController.unsubscribeFromReminders);

// Payment link unsubscribe (no auth required - uses token)
userRouter.post("/unsubscribe-payment-reminders", userController.unsubscribeFromPaymentReminders);
userRouter.get("/unsubscribe-payment-reminders/:token", userController.unsubscribeFromPaymentReminders);

// ── Session Management ──────────────────────────────────────────────────────
userRouter.post("/refresh-token", moderateRateLimiter, sessionController.refreshToken);
userRouter.get("/sessions", authMiddleware, sessionController.listSessions);
userRouter.delete("/sessions/:id", authMiddleware, sessionController.revokeSessionEndpoint);
userRouter.delete("/sessions", authMiddleware, sessionController.revokeAllOtherSessionsEndpoint);
userRouter.get("/login-history", authMiddleware, sessionController.loginHistory);

// ── Two-Factor Authentication ────────────────────────────────────────────────
userRouter.post("/2fa/setup", authMiddleware, twoFactorController.setupEndpoint);
userRouter.post("/2fa/verify-setup", authMiddleware, twoFactorController.verifySetupEndpoint);
userRouter.post("/2fa/validate", strictRateLimiter, validate(twoFAValidateSchema), twoFactorController.validateEndpoint);
userRouter.post("/2fa/disable", authMiddleware, twoFactorController.disableEndpoint);
userRouter.post("/2fa/regenerate-backup-codes", authMiddleware, twoFactorController.regenerateBackupCodesEndpoint);
userRouter.get("/2fa/status", authMiddleware, twoFactorController.statusEndpoint);

export default userRouter;
