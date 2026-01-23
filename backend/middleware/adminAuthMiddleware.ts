import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { userModel } from "../models";

import { Op } from "sequelize";
import { IUserType } from "../utils/types";

const adminAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader?.split(" ")[1];
    if (!token) errorResponseHelper(res, 403, "Your Login has Expired");
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (tokenSecret && token) {
      await Promise.resolve(
        jwt.verify(token, tokenSecret, async (err, user) => {
          if (err) errorResponseHelper(res, 403, "Your Login has Expired");
          else {
            const userData = jwt.decode(token) as IUserType;
            if (userData?.role && userData?.role === "ADMIN") {
              res.locals.token = token;

              next();
            } else {
              errorResponseHelper(res, 403, "Account does not exists!!!");
            }
          }
        })
      );
    }
  } catch (e: any) {
    console.log(e);
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

export default adminAuthMiddleware;
