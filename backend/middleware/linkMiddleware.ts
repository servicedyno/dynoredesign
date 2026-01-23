import express from "express";
import Joi, { LanguageMessages } from "joi";
import { paymentTypes } from "../utils/enums";

const linkMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { email, base_currency, amount, modes } = req.body;
  let validateFields, schema;

  validateFields = { email, base_currency, amount, modes };

  const allowedCurrency = [
    "USD",
    "NGN",
    "GBP",
    "EUR",
    "BTC",
    "LTC",
    "DOGE",
    "KES",
    "UGX",
    "RWF",
  ];
  const allowedModes = [
    ...Object.keys(paymentTypes).filter((x) => x !== "WALLET" && x),
  ];

  schema = {
    email: Joi.string().required().email().messages({
      "string.empty": "Email is Required",
    }),

    amount: Joi.number()
      .required()
      .min(5)
      .messages({
        "number.min": `Amount must be greater then or equal to ${5}`,
      }),
    base_currency: Joi.string()
      .required()
      .valid(...allowedCurrency)
      .messages({
        "string.empty": "Base Currency is Required",
      }),
    modes: Joi.array()
      .required()
      .items(Joi.string().valid(...allowedModes)),
  };

  const validationSchema = Joi.object({ ...schema });

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

export default linkMiddleware;
