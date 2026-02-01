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
  // Priority: base_currency > currency > 'USD' (default)
  const normalizedCurrency = base_currency || currency || 'USD';
  // Priority: base_amount > amount
  const normalizedAmount = base_amount || amount;
  // Default modes to ['CRYPTO'] if not provided
  const normalizedModes = modes || ['CRYPTO'];

  // Update req.body with normalized/defaulted values
  req.body.currency = normalizedCurrency;
  req.body.base_currency = normalizedCurrency;
  req.body.modes = normalizedModes;

  const validateFields = { 
    email, 
    currency: normalizedCurrency, 
    amount: normalizedAmount, 
    modes: normalizedModes 
  };

  const allowedCurrency = [
    // Fiat - Major International
    "USD",
    "EUR",
    "GBP",
    "AUD",
    "CAD",
    "CHF",
    "CNY",
    "JPY",
    "HKD",
    "NZD",
    // Fiat - African
    "NGN",
    "KES",
    "UGX",
    "RWF",
    // Crypto
    "BTC",
    "LTC",
    "DOGE",
  ];
  const allowedModes = [
    ...Object.keys(paymentTypes).filter((x) => x !== "WALLET" && x),
  ];

  const schema = {
    email: Joi.string().optional().email().allow('', null).messages({
      "string.email": "Please provide a valid email address",
    }),

    amount: Joi.number()
      .required()
      .min(0.01)
      .messages({
        "number.min": `Amount must be greater than 0`,
        "any.required": "Amount is required. Please provide either 'amount' or 'base_amount' field.",
      }),
    currency: Joi.string()
      .optional()
      .valid(...allowedCurrency)
      .default('USD')
      .messages({
        "any.only": `Currency must be one of: ${allowedCurrency.join(', ')}`,
      }),
    modes: Joi.array()
      .optional()
      .items(Joi.string().valid(...allowedModes))
      .default(['CRYPTO']),
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
