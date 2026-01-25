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
    if (tokenSecret && token) {
      await Promise.resolve(
        jwt.verify(token, tokenSecret, async (err, user) => {
          if (err) {
            return errorResponseHelper(res, 401, "Invalid or expired token. Please login again.");
          } else {
            const userData = jwt.decode(token) as IUserType;
            const isExists = await userModel
              .findOne({
                where: {
                  user_id: userData.user_id,
                },
              })
              .then((token) => token !== null)
              .then((isExists) => isExists);

            if (!isExists) {
              return errorResponseHelper(res, 401, "User account does not exist. Please login again.");
            } else {
              res.locals.token = token;

              next();
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

export default authMiddleware;
