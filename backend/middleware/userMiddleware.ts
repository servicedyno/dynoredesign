import express from "express";
import Joi from "joi";
import { IUserType } from "../utils/types";

const userMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const method = req.method;

  if (method === "GET") {
    return next();
  }

  let validateFields;
  let schema: Joi.PartialSchemaMap<any>;

  const pathname = req.path;
  if (req.headers["content-type"].includes("multipart/form-data")) {
    if (!req.body && !req.body.data) {
      return res.status(400).json({ message: "Data not found!" });
    } else {
      const { name, email }: IUserType = JSON.parse(req.body.data);
      if (pathname.includes("updateUser")) {
        schema = {
          name: Joi.string().required().messages({
            "string.empty": "Name is Required",
          }),
          email: Joi.string().email().required().messages({
            "string.empty": "Email is Required",
            "string.email": "Please Enter Valid Email",
          }),
        };
        validateFields = { name, email };
      }
    }
  } else {
    const { name, email, password, oldPassword, newPassword }: IUserType =
      req.body;

    if (pathname.includes("login")) {
      schema = {
        email: Joi.string().email().required().messages({
          "string.empty": "Email is Required",
          "string.email": "Please Enter Valid Email",
        }),
        password: Joi.string().required().messages({
          "string.empty": "Password is Required",
        }),
      };
      validateFields = { email, password };
    } else if (pathname.includes("changePassword")) {
      schema = {
        newPassword: Joi.string().required().messages({
          "string.empty": "New Password is Required",
        }),
        oldPassword: Joi.string().required().messages({
          "string.empty": "Old Password is Required",
        }),
      };
      validateFields = { newPassword, oldPassword };
    } else if (pathname.includes("registerUser")) {
      schema = {
        name: Joi.string().required().messages({
          "string.empty": "Name is Required",
        }),
        email: Joi.string().email().required().messages({
          "string.empty": "Email is Required",
          "string.email": "Please Enter Valid Email",
        }),
        password: Joi.string().required().messages({
          "string.empty": "Password is Required",
        }),
      };
      validateFields = { name, email, password };
    } else {
      return next();
    }
  }

  const validationSchema = Joi.object({
    ...schema,
  });

  const validationResult = validationSchema.validate(validateFields, {
    abortEarly: false,
  });

  if (validationResult.error && validationResult.error?.details.length !== 0) {
    const errors = validationResult.error.details.map((x) => {
      return { key: x.context.key, error: x.message };
    });
    return res.status(400).json({
      message: "Please enter proper values!",
      errors,
    });
  }
  next();
};

export default userMiddleware;
