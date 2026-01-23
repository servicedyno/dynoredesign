import express from "express";
import { userController } from "../controller";
import { authMiddleware, uploadImage, userMiddleware } from "../middleware";
const userRouter = express.Router();

userRouter.post("/registerUser", userMiddleware, userController.registerUser);
userRouter.post("/login", userMiddleware, userController.login);
userRouter.get("/checkEmail", userController.checkEmail);
userRouter.post("/generateOTP", userController.generateOTP);
userRouter.post("/confirmOTP", userController.confirmOTP);
userRouter.post("/connectSocial", userController.connectSocial);

userRouter.put(
  "/updateUser",
  authMiddleware,
  uploadImage.single("image"),
  userMiddleware,
  userController.updateUser
);

userRouter.put(
  "/changePassword",
  authMiddleware,
  userMiddleware,
  userController.changePassword
);

export default userRouter;
