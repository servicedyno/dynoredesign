import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { customerModel, paymentLinkModel, userModel } from "../models";

import { Op } from "sequelize";
import { IUserType } from "../utils/types";

const customerAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader?.split(" ")[1];
    
    if (!token) {
      return errorResponseHelper(res, 403, "Your Login has Expired");
    }
    
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (!tokenSecret) {
      return errorResponseHelper(res, 500, "Server configuration error. Token secret not set.");
    }
    
    try {
      // Verify token synchronously
      const decoded = jwt.verify(token, tokenSecret) as any;
      
      console.log("userData=========>", decoded);
      
      // Check if decoded token is valid
      if (!decoded) {
        return errorResponseHelper(res, 403, "Invalid token format");
      }
      
      // For payment link flow - check if this is from Redis payload
      if (decoded?.pathType && decoded?.pathType === "createLink") {
        // Payment link uses transaction_id
        if (!decoded.transaction_id) {
          return errorResponseHelper(res, 403, "Invalid payment link token - missing transaction_id");
        }
        
        const linkExists = await paymentLinkModel.findOne({
          where: {
            transaction_id: decoded.transaction_id,
          },
        });

        if (!linkExists) {
          return errorResponseHelper(res, 403, "Link does not exist or has been deleted");
        }
        
        res.locals.token = token;
        res.locals.user = decoded;
        next();
      } else if (decoded?.customer_id) {
        // Customer model uses id field
        const customerExists = await customerModel.findOne({
          where: {
            id: decoded.customer_id,
          },
        });

        if (!customerExists) {
          return errorResponseHelper(res, 403, "Customer account does not exist");
        }
        
        res.locals.token = token;
        res.locals.user = decoded;
        next();
      } else {
        // Regular user authentication - skip customer/link check
        // This is for regular user JWT tokens (user_id)
        res.locals.token = token;
        res.locals.user = decoded;
        next();
      }
    } catch (err: any) {
      // Handle JWT-specific errors
      if (err.name === 'TokenExpiredError') {
        return errorResponseHelper(res, 403, "Your Login has Expired");
      } else if (err.name === 'JsonWebTokenError') {
        return errorResponseHelper(res, 403, "Invalid token. Please login again.");
      } else if (err.name === 'NotBeforeError') {
        return errorResponseHelper(res, 403, "Token not active yet. Please try again later.");
      } else {
        throw err; // Re-throw to be caught by outer catch
      }
    }
  } catch (e: any) {
    console.log("Customer Auth Middleware Error:", e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default customerAuthMiddleware;
