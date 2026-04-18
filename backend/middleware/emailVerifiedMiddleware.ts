import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper } from "../helper";
import { userModel } from "../models";
import { IUserType } from "../utils/types";

/**
 * Middleware that gates routes behind email verification.
 * Must be placed AFTER authMiddleware in the middleware chain.
 *
 * Returns 403 if the user's email is not verified.
 */
const emailVerifiedMiddleware = async (
  _req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const token = res.locals.token;
    if (!token) {
      return errorResponseHelper(res, 401, "Authentication required.");
    }

    const decoded = jwt.decode(token) as IUserType;
    if (!decoded || !decoded.user_id) {
      return errorResponseHelper(res, 401, "Invalid token.");
    }

    const user = await userModel.findOne({
      where: { user_id: decoded.user_id },
      attributes: ["email_verified"],
    });

    if (!user) {
      return errorResponseHelper(res, 404, "User not found.");
    }

    if (!user.dataValues.email_verified) {
      return errorResponseHelper(
        res,
        403,
        "Please verify your email address before accessing this feature. Check your inbox for a verification code."
      );
    }

    next();
  } catch (err) {
    return errorResponseHelper(res, 500, "Email verification check failed.");
  }
};

export default emailVerifiedMiddleware;
