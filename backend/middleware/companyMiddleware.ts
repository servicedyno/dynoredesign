import express from "express";
import Joi from "joi";
import { ICompany, IUserType } from "../utils/types";

const companyMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const method = req.method;
  if (method === "GET" || method === "DELETE") {
    return next();
  }
  if (!req.body.data) {
    return res.status(400).json({ message: "Data not found!" });
  } else {
    const { company_name, email, mobile }: ICompany = JSON.parse(req.body.data);
    let validateFields;

    const pathname = req.path;
    let schema: Joi.PartialSchemaMap<any>;
    if (pathname.includes("addCompany") || pathname.includes("updateCompany")) {
      schema = {
        company_name: Joi.string().required().messages({
          "string.empty": "Company Name is Required",
        }),
        email: Joi.string().email().required().messages({
          "string.empty": "Company Email is Required",
          "string.email": "Please Enter Valid Email",
        }),
        mobile: Joi.string().required().messages({
          "string.empty": "Mobile number is Required",
        }),
      };
      validateFields = { company_name, email, mobile };
    } else {
      return next();
    }

    const validationSchema = Joi.object({
      ...schema,
    });

    const validationResult = validationSchema.validate(validateFields, {
      abortEarly: false,
    });

    if (
      validationResult.error &&
      validationResult.error?.details.length !== 0
    ) {
      const errors = validationResult.error.details.map((x) => {
        return { key: x.context.key, error: x.message };
      });
      return res.status(400).json({
        message: "Please enter proper values!",
        errors,
      });
    }
    next();
  }
};

export default companyMiddleware;
