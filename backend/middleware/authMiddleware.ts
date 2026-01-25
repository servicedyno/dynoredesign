import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { userModel } from "../models";

import { Op } from "sequelize";
import { IUserType } from "../utils/types";

const authMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader?.split(" ")[1];
    
    if (!token) {
      return errorResponseHelper(res, 401, "Authentication required. Please provide a valid token.");
    }
    
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (!tokenSecret) {
      return errorResponseHelper(res, 500, "Server configuration error. Token secret not set.");
    }
    
    try {
      // Verify token synchronously or using promisified version
      const decoded = jwt.verify(token, tokenSecret) as IUserType;
      
      // Debug logging
      console.log("Auth Middleware - Decoded token:", JSON.stringify(decoded).substring(0, 200));
      
      // Check token type - customer tokens have 'id', user tokens have 'user_id'
      if (decoded.id && !decoded.user_id) {
        console.log("Auth Middleware - Customer token detected, but user token required");
        return errorResponseHelper(res, 401, "This endpoint requires user authentication. Please login with a user account, not a customer account.");
      }
      
      // Check if decoded token has user_id
      if (!decoded || !decoded.user_id) {
        console.log("Auth Middleware - Token validation failed: missing user_id");
        return errorResponseHelper(res, 401, "Invalid token format. Please login again.");
      }
      
      // Check if user exists in database
      const userExists = await userModel.findOne({
        where: {
          user_id: decoded.user_id,
        },
      });

      if (!userExists) {
        return errorResponseHelper(res, 401, "User account does not exist. Please login again.");
      }
      
      // Store token in res.locals for use in controllers
      res.locals.token = token;
      res.locals.user = decoded;
      
      next();
    } catch (err: any) {
      // Handle JWT-specific errors
      if (err.name === 'TokenExpiredError') {
        return errorResponseHelper(res, 401, "Token has expired. Please login again.");
      } else if (err.name === 'JsonWebTokenError') {
        return errorResponseHelper(res, 401, "Invalid token. Please login again.");
      } else if (err.name === 'NotBeforeError') {
        return errorResponseHelper(res, 401, "Token not active yet. Please try again later.");
      } else {
        throw err; // Re-throw to be caught by outer catch
      }
    }
  } catch (e: any) {
    console.log("Auth Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default authMiddleware;
