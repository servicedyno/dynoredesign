import express, { RequestHandler } from "express";
import { userController } from "../controller";
import { authMiddleware, uploadImage, userMiddleware } from "../middleware";
const userRouter = express.Router();

userRouter.post("/registerUser", userMiddleware, userController.registerUser);
userRouter.post("/registerPhone", userController.registerPhoneStep1);
userRouter.post("/registerPhone/verify", userController.registerPhoneStep2);
userRouter.post("/login", userMiddleware, userController.login);
userRouter.get("/checkEmail", userController.checkEmail);
userRouter.post("/generateOTP", userController.generateOTP);
userRouter.post("/confirmOTP", userController.confirmOTP);
userRouter.post("/connectSocial", userController.connectSocial);

// Password reset endpoints
userRouter.post("/forgot-password", userController.forgotPassword);
userRouter.post("/reset-password", userController.resetPassword);

// Google Sign-In endpoint
userRouter.post("/google-signin", userController.googleSignIn);

// Facebook Sign-In endpoint
userRouter.post("/facebook-signin", userController.facebookSignIn);

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
