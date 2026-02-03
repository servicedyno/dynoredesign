import express, { RequestHandler } from "express";
import { userController } from "../controller";
import { authMiddleware, uploadImage, userMiddleware } from "../middleware";
import { strictRateLimiter, ipRateLimiter } from "../middleware/rateLimitMiddleware";
const userRouter = express.Router();

// Registration endpoints - moderate rate limiting (10 per 15 min)
userRouter.post("/registerUser", ipRateLimiter, userMiddleware, userController.registerUser);
userRouter.post("/registerPhone", ipRateLimiter, userController.registerPhoneStep1);
userRouter.post("/registerPhone/verify", ipRateLimiter, userController.registerPhoneStep2);

// Login endpoint - strict rate limiting (5 per 15 min) to prevent brute force
userRouter.post("/login", strictRateLimiter, userMiddleware, userController.login);

// Email check - moderate rate limiting
userRouter.get("/checkEmail", ipRateLimiter, userController.checkEmail);

// OTP endpoints - strict rate limiting (5 per 15 min) to prevent OTP spam
userRouter.post("/generateOTP", strictRateLimiter, userController.generateOTP);
userRouter.post("/confirmOTP", strictRateLimiter, userController.confirmOTP);

// Social connect - moderate rate limiting
userRouter.post("/connectSocial", ipRateLimiter, userController.connectSocial);

// Password reset endpoints - strict rate limiting (5 per 15 min) to prevent abuse
userRouter.post("/forgot-password", strictRateLimiter, userController.forgotPassword);
userRouter.post("/reset-password", strictRateLimiter, userController.resetPassword);

// Social Sign-In endpoints - moderate rate limiting (10 per 15 min)
userRouter.post("/google-signin", ipRateLimiter, userController.googleSignIn);
userRouter.post("/facebook-signin", ipRateLimiter, userController.facebookSignIn);

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
  userMiddleware,
  userController.changePassword
);

// Account deletion (requires auth)
userRouter.delete("/account", authMiddleware, userController.deleteAccount);

// Referee code unsubscribe (no auth required - uses token)
userRouter.post("/unsubscribe-reminders", userController.unsubscribeFromReminders);
userRouter.get("/unsubscribe-reminders/:token", userController.unsubscribeFromReminders);

// Payment link unsubscribe (no auth required - uses token)
userRouter.post("/unsubscribe-payment-reminders", userController.unsubscribeFromPaymentReminders);
userRouter.get("/unsubscribe-payment-reminders/:token", userController.unsubscribeFromPaymentReminders);

export default userRouter;
