import express from "express";
// Joi import removed - not used
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
      const apiKey = headers["x-api-key"] as string;
      const decryptedData = decrypt(apiKey, process.env.API_SECRET);
      
      // Handle both old format and new format with prefix (dpk_live_ or dpk_test_)
      if (decryptedData.includes("DYNOPAY_USER_API")) {
        // Extract the JSON part after "DYNOPAY_USER_API-"
        const apiKeyPart = decryptedData.split("DYNOPAY_USER_API-")[1];
        const apiData = JSON.parse(apiKeyPart);
        const { company_id, adm_id } = apiData;
        
        const tempData = await sequelize.query(
          `SELECT * FROM tbl_company WHERE company_id=$1 AND user_id=$2`,
          { 
            bind: [company_id, adm_id],
            type: QueryTypes.SELECT 
          }
        );
        
        if (tempData.length > 0) {
          res.locals.apiKeyData = apiData;
          next();
        } else {
          errorResponseHelper(
            res,
            403,
            "API key authorization failed! Company not found."
          );
        }
      } else {
        errorResponseHelper(
          res,
          403,
          "API key authorization failed! Invalid key format."
        );
      }
    } else {
      errorResponseHelper(res, 403, "API key is required in x-api-key header");
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    customerLogger.error(errorMessage, new Error(String(e)));
    errorResponseHelper(res, 500, "API key validation error: " + errorMessage);
  }
};

export default apiMiddleware;
