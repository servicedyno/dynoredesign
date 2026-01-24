import express, { RequestHandler } from "express";
import { userController } from "../controller";
import { authMiddleware, uploadImage, userMiddleware } from "../middleware";
const userRouter = express.Router();

userRouter.post("/registerUser", userMiddleware, userController.registerUser);
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

// Profile endpoints (requires auth)
userRouter.get("/profile", authMiddleware, userController.getProfile);
userRouter.put("/profile", authMiddleware, userController.updateProfile);
userRouter.put("/email", authMiddleware, userController.changeEmail);

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

export default userRouter;
