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

  const { name, email }: IUserType = req.body;

  validateFields = { email, name };

  const validationSchema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.empty": "Email is Required",
      "string.email": "Please Enter Valid Email",
    }),
    name: Joi.string().required().messages({
      "string.empty": "Name is Required",
    }),
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
