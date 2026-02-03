import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { customerModel } from "../models";

import { Op } from "sequelize";
import { IUserType, CustomerJwtPayload } from "../utils/types";

interface JwtError extends Error {
  name: 'TokenExpiredError' | 'JsonWebTokenError' | 'NotBeforeError' | string;
}

const authMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader?.split(" ")[1];
    
    if (!token) {
      return errorResponseHelper(res, 403, "Authentication failed! Token required.");
    }
    
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (!tokenSecret) {
      return errorResponseHelper(res, 500, "Server configuration error. Token secret not set.");
    }
    
    try {
      // Verify token synchronously
      const decoded = jwt.verify(token, tokenSecret) as CustomerJwtPayload;
      
      // Check if decoded token is valid and has required id
      const customerId = decoded.id || decoded.user_id;
      if (!decoded || !customerId) {
        return errorResponseHelper(res, 403, "Invalid token format - missing customer ID");
      }
      
      // Check if customer exists in database
      const customerExists = await customerModel.findOne({
        where: {
          id: customerId,
        },
      });

      if (!customerExists) {
        return errorResponseHelper(res, 403, "Customer account does not exist");
      }
      
      // Store token and user data in res.locals
      res.locals.token = token;
      res.locals.user = decoded;
      
      next();
    } catch (err: unknown) {
      // Handle JWT-specific errors
      const jwtError = err as JwtError;
      if (jwtError.name === 'TokenExpiredError') {
        return errorResponseHelper(res, 403, "Authentication Expired! Please login again.");
      } else if (jwtError.name === 'JsonWebTokenError') {
        return errorResponseHelper(res, 403, "Invalid token. Please login again.");
      } else if (jwtError.name === 'NotBeforeError') {
        return errorResponseHelper(res, 403, "Token not active yet. Please try again later.");
      } else {
        throw err; // Re-throw to be caught by outer catch
      }
    }
  } catch (e: unknown) {
    console.log("API Service Auth Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default authMiddleware;
