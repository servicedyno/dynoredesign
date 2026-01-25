import express from "express";
import Joi, { LanguageMessages } from "joi";
import { paymentTypes } from "../utils/enums";

const linkMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const { 
    email, 
    base_currency,  // NEW format (recommended)
    currency,       // LEGACY format (backward compatibility)
    amount,         // Both formats use 'amount'
    base_amount,    // Alternative field name
    modes 
  } = req.body;

  // Support both new and legacy field names
  // Priority: base_currency > currency, base_amount > amount
  const normalizedCurrency = base_currency || currency;
  const normalizedAmount = base_amount || amount;

  const validateFields = { 
    email, 
    currency: normalizedCurrency, 
    amount: normalizedAmount, 
    modes 
  };

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

  const schema = {
    email: Joi.string().required().email().messages({
      "string.empty": "Email is Required",
    }),

    amount: Joi.number()
      .required()
      .min(5)
      .messages({
        "number.min": `Amount must be greater than or equal to ${5}`,
        "any.required": "Amount is required. Please provide either 'amount' or 'base_amount' field.",
      }),
    currency: Joi.string()
      .required()
      .valid(...allowedCurrency)
      .messages({
        "string.empty": "Currency is required. Please provide either 'currency' or 'base_currency' field.",
        "any.required": "Currency is required. Please provide either 'currency' or 'base_currency' field.",
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
