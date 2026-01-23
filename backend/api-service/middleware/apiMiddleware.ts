import express from "express";
import Joi from "joi";
import { decrypt, errorResponseHelper, getErrorMessage } from "../helper";
import { customerLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const apiMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const headers = req.headers;
    if (headers["x-api-key"]) {
      const apiKey = headers["x-api-key"];
      const decryptedData = decrypt(apiKey, process.env.API_SECRET);
      if (decryptedData.includes("DYNOPAY_USER_API")) {
        const apiKeyData = decryptedData.split("-")[1];
        const apiData = JSON.parse(apiKeyData);
        const { company_id, adm_id } = apiData;
        const tempData = await sequelize.query(
          `select * from tbl_company where company_id=${company_id}
            and user_id=${adm_id}
          `,
          { type: QueryTypes.SELECT }
        );
        if (tempData.length > 0) {
          res.locals.apiKeyData = apiData;
          next();
        } else {
          errorResponseHelper(
            res,
            403,
            "API key authorization failed! Please check the API key."
          );
        }
      } else {
        errorResponseHelper(
          res,
          403,
          "API key authorization failed! Please check the API key."
        );
      }
    } else {
      errorResponseHelper(res, 403, "API key does not exists");
    }
    // next();
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(errorMessage, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

export default apiMiddleware;
