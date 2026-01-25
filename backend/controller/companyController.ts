import express from "express";
import {
  errorResponseHelper,
  getErrorMessage,
  successResponseHelper,
} from "../helper";
import jwt from "jsonwebtoken";
import { IUserType } from "../utils/types";
import { companyModel } from "../models";
import { companyLogger } from "../utils/loggers";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

import axios from "axios";

const TAX_DATA_API_URL = process.env.TAX_DATA_API_URL || "https://api.apilayer.com/tax_data";
const TAX_DATA_API_KEY = process.env.TAX_DATA_API_KEY;

/**
 * Validate TAX ID/VAT Number using APILayer
 * @param vat_number - Tax ID to validate
 * @param country_code - ISO 2-letter country code
 * @returns Validation result with company details if valid
 */
const validateTaxIdInternal = async (vat_number: string, country_code: string) => {
  if (!TAX_DATA_API_KEY) {
    return {
      valid: null,
      format_valid: null,
      query_status: "api_key_missing",
      note: "Tax validation API key not configured. Proceeding without validation.",
    };
  }

  try {
    const response = await axios.get(`${TAX_DATA_API_URL}/validate`, {
      headers: {
        "apikey": TAX_DATA_API_KEY,
      },
      params: {
        vat_number,
        country_code: country_code.toUpperCase(),
      },
      timeout: 10000,
    });

    return {
      valid: response.data.valid || false,
      company_name: response.data.company_name || null,
      company_address: response.data.company_address || null,
      format_valid: response.data.format_valid || false,
      query_status: "completed",
    };
  } catch (apiError: any) {
    // Handle rate limiting
    if (apiError.response?.data?.message?.includes("exceeded")) {
      return {
        valid: null,
        format_valid: null,
        query_status: "rate_limited",
        note: "API rate limit exceeded. Validation skipped.",
      };
    }

    // Invalid format
    if (apiError.response?.status === 400) {
      return {
        valid: false,
        format_valid: false,
        query_status: "invalid_format",
      };
    }

    // Other errors - don't block company creation
    return {
      valid: null,
      format_valid: null,
      query_status: "validation_failed",
      note: "Tax validation failed. Proceeding without validation.",
    };
  }
};

const addCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const file = req.file as Express.Multer.File;
    const data = JSON.parse(req.body.data);
    let photo;
    if (file) {
      photo = process.env.SERVER_URL + "images/" + file.filename;
    }
    
    // Validate TAX ID if provided
    let taxValidation = null;
    if (data.vat_number && data.country) {
      companyLogger.info(
        `Validating TAX ID: ${data.vat_number} for country: ${data.country}`,
        { user_id: userData.user_id, email: userData.email }
      );
      
      taxValidation = await validateTaxIdInternal(data.vat_number, data.country);
      
      // If validation completed and format is invalid, return error
      if (taxValidation.query_status === "invalid_format") {
        return errorResponseHelper(
          res,
          400,
          `Invalid TAX ID format for ${data.country}. Please check and try again.`
        );
      }
      
      // If validation completed and VAT is invalid, return error
      if (taxValidation.query_status === "completed" && taxValidation.valid === false) {
        return errorResponseHelper(
          res,
          400,
          `TAX ID ${data.vat_number} is not registered in ${data.country}. Please verify the number.`
        );
      }
      
      // If valid, mark as verified
      if (taxValidation.valid === true) {
        data.vat_verified = true;
      }
      
      companyLogger.info(
        `TAX ID validation result: ${taxValidation.query_status}`,
        { 
          user_id: userData.user_id, 
          vat_number: data.vat_number,
          valid: taxValidation.valid,
          format_valid: taxValidation.format_valid
        }
      );
    }
    
    const resData = await companyModel.create({
      ...data,
      user_id: userData.user_id,
      photo,
    });

    // Include tax validation result in response
    const responseData = {
      ...resData.dataValues,
      tax_validation: taxValidation || { note: "No TAX ID provided" },
    };

    successResponseHelper(res, 200, "Company added successfully!", responseData);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const updateCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const file = req.file as Express.Multer.File;
    const data = JSON.parse(req.body.data);
    const company_id = req.params.id;
    let photo;
    if (file) {
      photo = process.env.SERVER_URL + "images/" + file.filename;
    }
    const resData = await companyModel.update(
      {
        ...data,
        user_id: userData.user_id,
        ...(photo && { photo }),
      },
      {
        where: {
          user_id: userData.user_id,
          company_id,
        },
        returning: true,
      }
    );

    const finalArray = resData[1][0].dataValues;
    successResponseHelper(
      res,
      200,
      "Company updated successfully!",
      finalArray
    );
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const resData = await companyModel.findAll({
      where: {
        user_id: userData.user_id,
      },
    });
    successResponseHelper(res, 200, "", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Get Company by ID
 * GET /api/company/getCompany/:id
 */
const getCompanyById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    
    const resData = await companyModel.findOne({
      where: {
        user_id: userData.user_id,
        company_id,
      },
    });

    if (!resData) {
      return errorResponseHelper(res, 404, "Company not found");
    }

    successResponseHelper(res, 200, "Company retrieved successfully", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const deleteCompany = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const resData = await companyModel.destroy({
      where: {
        user_id: userData.user_id,
        company_id,
      },
    });
    successResponseHelper(res, 200, "Company deleted successfully!", resData);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const getTransactions = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const id = req.params.id;

    const resData = await sequelize.query(
      `
      select ut.*,c.customer_name,c.email,cm.company_name,cm.company_id from tbl_user_transaction ut 
      join tbl_customer c on c.customer_id=ut.customer_id
      join tbl_company cm on cm.company_id=c.company_id where c.company_id=${id}`,
      { type: QueryTypes.SELECT }
    );

    const finalRes = resData.map((x) => {
      const { wallet_id, ...rest }: any = x;
      return rest;
    });

    successResponseHelper(res, 200, "", finalRes);
  } catch (e) {
    const message = getErrorMessage(e);
    companyLogger.error(
      message,
      { user_id: userData.user_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

export default {
  addCompany,
  getCompany,
  getCompanyById,
  deleteCompany,
  updateCompany,
  getTransactions,
};
