import express from "express";
import Joi from "joi";

const paymentMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const method = req.method;
  const pathname = req.path;
  if (method === "GET") {
    return next();
  }

  let validateFields, schema;

  const allowedCurrency = [
    "BTC",
    "LTC",
    "DOGE",
    "ETH",
    "USDT-ERC20",
    "USDT-TRC20",
    "BSC",
    "TRX",
    "BCH",
  ];

  const { amount, redirect_uri, meta_data, currency } = req.body;

  const minValue = pathname.includes("createPayment") ? 5 : 1;

  if (pathname.includes("cryptoPayment")) {
    validateFields = { amount, currency, redirect_uri, meta_data };
    schema = {
      amount: Joi.number()
        .required()
        .min(minValue)
        .messages({
          "number.min": `Amount must be greater then or equal to ${minValue}`,
        }),
      currency: Joi.string()
        .valid(...allowedCurrency)
        .required(),
      redirect_uri: Joi.string().required(),
      meta_data: Joi.object()
        .keys({
          product_name: Joi.string(),
          product: Joi.string(),
        })
        .or("product_name", "product")
        .unknown(true)
        .optional(),
    };
  } else {
    validateFields = { amount, redirect_uri, meta_data };
    schema = {
      amount: Joi.number()
        .required()
        .min(minValue)
        .messages({
          "number.min": `Amount must be greater then or equal to ${minValue}`,
        }),
      redirect_uri: Joi.string().required(),
      meta_data: Joi.object()
        .keys({
          product_name: Joi.string(),
          product: Joi.string(),
        })
        .or("product_name", "product")
        .unknown(true)
        .optional(),
    };
  }

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

export default paymentMiddleware;
