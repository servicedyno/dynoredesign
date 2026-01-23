import express from "express";
import jwt from "jsonwebtoken";
import { errorResponseHelper, getErrorMessage } from "../helper";
import { customerModel } from "../models";

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
    if (!token) errorResponseHelper(res, 403, "Authentication failed!");
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (tokenSecret && token) {
      await Promise.resolve(
        jwt.verify(token, tokenSecret, async (err, user) => {
          if (err) errorResponseHelper(res, 403, "Authentication Expired!");
          else {
            const userData = jwt.decode(token) as any;
            const isExists = await customerModel
              .findOne({
                where: {
                  id: userData.id,
                },
              })
              .then((token) => token !== null)
              .then((isExists) => isExists);

            if (!isExists) {
              errorResponseHelper(res, 403, "Account does not exists!!!");
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
