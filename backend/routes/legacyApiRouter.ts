/**
 * Legacy API Router
 * 
 * Provides backward compatibility with the OLD Dynopay API (user-api.dynopay.com)
 * 
 * These routes are mounted at /api/user/* on the main backend (port 3300)
 * and support both OLD and NEW authentication flows.
 * 
 * OLD API Endpoints:
 *   POST /api/user/cryptoPayment - Create crypto payment (x-api-key + wallet_token)
 *   POST /api/user/createUser - Create customer (x-api-key only)
 * 
 * NEW API Endpoints (also supported):
 *   POST /api/user/createUser - Create customer (x-api-key)
 *   POST /api/user/cryptoPayment - Create crypto payment (x-api-key + customer JWT)
 */

import express from "express";
import jwt from "jsonwebtoken";
import Crypto from "crypto";
import axios from "axios";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import legacyApiAuthMiddleware, { validateApiKey } from "../middleware/legacyApiAuthMiddleware";
import { decrypt } from "../helper/encryption";
import { setRedisItem } from "../utils/redisInstance";

const router = express.Router();

// Supported crypto types
const CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'];

// Helper to get internal backend URL
const getBackendURL = () => {
  return process.env.INTERNAL_BACKEND_URL || process.env.SERVER_URL || 'http://localhost:3300';
};

// Helper to get available currencies for a company
const getAvailableCurrencies = async (userId: number, companyId: number): Promise<string[]> => {
  const wallets = await sequelize.query<{ wallet_type: string }>(
    `SELECT DISTINCT wallet_type FROM tbl_user_wallet 
     WHERE user_id = $1 
     AND company_id = $2 
     AND wallet_type IN (${CRYPTO_TYPES.map((_, i) => `$${i + 3}`).join(',')})
     AND wallet_address IS NOT NULL`,
    {
      bind: [userId, companyId, ...CRYPTO_TYPES],
      type: QueryTypes.SELECT,
    }
  );
  return wallets.map((w) => w.wallet_type);
};

/**
 * API Key validation middleware (for createUser - no customer auth needed)
 */
const apiKeyOnlyMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const apiKey = req.headers["x-api-key"] as string;
    
    if (!apiKey) {
      return res.status(403).json({
        success: false,
        message: "API key is required in x-api-key header"
      });
    }
    
    const apiKeyData = await validateApiKey(apiKey);
    if (!apiKeyData) {
      return res.status(403).json({
        success: false,
        message: "Invalid API key"
      });
    }
    
    res.locals.apiKeyData = apiKeyData;
    next();
  } catch (error) {
    console.error("[ApiKeyMiddleware] Error:", error);
    return res.status(500).json({
      success: false,
      message: "API key validation error"
    });
  }
};

/**
 * POST /api/user/createUser
 * Create a new customer for the merchant
 * 
 * Required: x-api-key header
 * Body: { name: string, email: string, mobile?: string }
 * Returns: { token: string, customer_id: string }
 */
router.post("/createUser", apiKeyOnlyMiddleware, async (req, res) => {
  try {
    const { name, email, mobile } = req.body;
    const data = res.locals.apiKeyData;
    
    // Validate required fields
    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
        errors: [
          !name ? { key: "name", error: "Name is Required" } : null,
          !email ? { key: "email", error: "Email is Required" } : null
        ].filter(Boolean)
      });
    }
    
    // Check if customer already exists for this company
    const existingCustomer = await sequelize.query<{ id: string; customer_id: number }>(
      `SELECT id, customer_id FROM tbl_customer WHERE email = $1 AND company_id = $2`,
      {
        bind: [email, data.company_id],
        type: QueryTypes.SELECT
      }
    );
    
    if (existingCustomer.length > 0) {
      // Return existing customer with new token
      const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
      if (!tokenSecret) {
        return res.status(500).json({ success: false, message: "Server configuration error" });
      }
      
      const token = jwt.sign({
        id: existingCustomer[0].id,
        customer_id: existingCustomer[0].customer_id,
        email,
        company_id: data.company_id
      }, tokenSecret);
      
      return res.status(200).json({
        success: true,
        message: "Customer already exists",
        data: {
          token,
          customer_id: existingCustomer[0].id
        }
      });
    }
    
    // Create new customer
    const customerId = Crypto.randomUUID();
    
    await sequelize.query(
      `INSERT INTO tbl_customer (id, customer_name, email, mobile, company_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      {
        bind: [customerId, name, email, mobile || null, data.company_id],
        type: QueryTypes.INSERT
      }
    );
    
    // Get the created customer
    const newCustomer = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT
      }
    );
    
    // Create wallet for customer
    const walletId = Crypto.randomUUID();
    await sequelize.query(
      `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 0, NOW(), NOW())`,
      {
        bind: [walletId, newCustomer[0].customer_id, data.base_currency || 'USD'],
        type: QueryTypes.INSERT
      }
    );
    
    // Generate token
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (!tokenSecret) {
      return res.status(500).json({ success: false, message: "Server configuration error" });
    }
    
    const token = jwt.sign({
      id: customerId,
      customer_id: newCustomer[0].customer_id,
      email,
      company_id: data.company_id
    }, tokenSecret);
    
    console.log(`[LegacyAPI] Created customer ${customerId} for company ${data.company_id}`);
    
    return res.status(200).json({
      success: true,
      message: "Registered Successful!",
      data: {
        token,
        customer_id: customerId
      }
    });
    
  } catch (error) {
    console.error("[LegacyAPI] createUser error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

/**
 * POST /api/user/cryptoPayment
 * Create a cryptocurrency payment
 * 
 * Supports both OLD and NEW authentication:
 * - OLD: x-api-key + wallet_token (auto-creates default customer)
 * - NEW: x-api-key + customer JWT token
 * 
 * Body: { amount: number, currency: string, redirect_uri?: string, meta_data?: object, ... }
 * Returns: { transaction_id, qr_code, address, amount, currency }
 */
router.post("/cryptoPayment", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    const data = res.locals.apiKeyData;
    
    const {
      amount,
      currency,
      redirect_uri,
      meta_data,
      topUp = false,
      fee_payer = 'company',
      callback_url,
      webhook_url,
      accepted_currencies,
    } = req.body;
    
    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required"
      });
    }
    
    if (!currency) {
      return res.status(400).json({
        success: false,
        message: "Currency is required",
        available_currencies: CRYPTO_TYPES
      });
    }
    
    // Get available currencies for this company
    const allConfiguredCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);
    
    if (allConfiguredCurrencies.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment."
      });
    }
    
    // Determine effective currencies
    let effectiveAvailableCurrencies = allConfiguredCurrencies;
    
    if (accepted_currencies && Array.isArray(accepted_currencies) && accepted_currencies.length > 0) {
      const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
      const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
      
      if (unconfiguredCurrencies.length > 0) {
        return res.status(400).json({
          success: false,
          message: `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Available currencies: ${allConfiguredCurrencies.join(', ')}`
        });
      }
      
      effectiveAvailableCurrencies = requestedCurrencies;
    }
    
    // Validate requested currency
    const normalizedCurrency = currency.toUpperCase().trim();
    if (!effectiveAvailableCurrencies.includes(normalizedCurrency)) {
      return res.status(400).json({
        success: false,
        message: `${currency} is not available for this payment. Available currencies: ${effectiveAvailableCurrencies.join(', ')}`
      });
    }
    
    // Get customer data
    const customerData = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE id = $1`,
      {
        bind: [userData.id],
        type: QueryTypes.SELECT
      }
    );
    
    if (customerData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Customer not found"
      });
    }
    
    const localCurrency = normalizedCurrency.includes("USDT") ? "usdt" : normalizedCurrency.toLowerCase();
    
    // Determine effective webhook URL
    const effectiveWebhookUrl = webhook_url || data.webhook_url || null;
    const effectiveWebhookSecret = data.webhook_secret || null;
    
    console.log(`[LegacyAPI] cryptoPayment - Company: ${data.company_id}, Amount: ${amount}, Currency: ${normalizedCurrency}`);
    
    // Get currency rates
    let currencyData;
    try {
      currencyData = await axios.post(
        getBackendURL() + "/api/pay/getCurrencyRatesInternal",
        {
          source: data.base_currency || 'USD',
          amount: amount,
          currencyList: [localCurrency],
          fixedDecimal: false,
          fee_payer: fee_payer,
        },
        {
          headers: {
            Authorization: `Bearer ${res.locals.token}`,
          },
          timeout: 10000
        }
      );
    } catch (rateError) {
      console.error("[LegacyAPI] Currency rate error:", rateError);
      return res.status(500).json({
        success: false,
        message: "Failed to get currency rates"
      });
    }
    
    // Build Redis payload
    const redisPayload = {
      customer_id: customerData[0].customer_id,
      company_id: data.company_id,
      adm_id: data.adm_id,
      base_currency: data.base_currency || 'USD',
      base_amount: amount,
      amount: amount,
      pathType: topUp ? "addFund" : "cryptoPayment",
      redirect_uri,
      fee_payer: fee_payer,
      available_currencies: effectiveAvailableCurrencies,
      all_configured_currencies: allConfiguredCurrencies,
      webhook_url: effectiveWebhookUrl,
      webhook_secret: effectiveWebhookSecret,
      callback_url: callback_url || null,
      ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
    };
    
    const transactionId = Crypto.randomBytes(24).toString("hex");
    
    await setRedisItem("customer-" + transactionId, redisPayload);
    
    // Create crypto payment
    const payload = {
      uniqueRef: transactionId,
      amount: currencyData.data.data[0].amount,
      currency: normalizedCurrency,
    };
    
    let paymentResult;
    try {
      paymentResult = await axios.post(
        getBackendURL() + "/api/pay/createCryptoPayment",
        payload,
        {
          headers: {
            Authorization: `Bearer ${res.locals.token}`,
          },
          timeout: 30000
        }
      );
    } catch (paymentError: any) {
      console.error("[LegacyAPI] createCryptoPayment error:", paymentError?.response?.data || paymentError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to create crypto payment",
        error: paymentError?.response?.data?.message || paymentError.message
      });
    }
    
    const { qr_code, address, transaction_id } = paymentResult.data.data;
    
    console.log(`[LegacyAPI] Payment created - TX: ${transaction_id}, Address: ${address}`);
    
    return res.status(200).json({
      success: true,
      message: "Payment Created!",
      data: {
        transaction_id,
        qr_code,
        address: normalizedCurrency === "BCH" ? "bitcoincash:" + address : address,
        amount: currencyData.data.data[0].amount,
        currency: normalizedCurrency,
        base_amount: amount,
        base_currency: data.base_currency || 'USD',
        redirect_uri
      }
    });
    
  } catch (error) {
    console.error("[LegacyAPI] cryptoPayment error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

/**
 * GET /api/user/getBalance
 * Get customer wallet balance
 */
router.get("/getBalance", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    
    const wallets = await sequelize.query<{ wallet_type: string; amount: number }>(
      `SELECT wallet_type, amount FROM tbl_customer_wallet 
       WHERE customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)`,
      {
        bind: [userData.id],
        type: QueryTypes.SELECT
      }
    );
    
    return res.status(200).json({
      success: true,
      message: "Balance retrieved",
      data: wallets
    });
    
  } catch (error) {
    console.error("[LegacyAPI] getBalance error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

/**
 * GET /api/user/getTransactions
 * Get customer transaction history
 */
router.get("/getTransactions", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    const transactions = await sequelize.query<any>(
      `SELECT * FROM tbl_customer_transaction 
       WHERE customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)
       ORDER BY "createdAt" DESC
       LIMIT $2 OFFSET $3`,
      {
        bind: [userData.id, Number(limit), offset],
        type: QueryTypes.SELECT
      }
    );
    
    return res.status(200).json({
      success: true,
      message: "Transactions retrieved",
      data: transactions
    });
    
  } catch (error) {
    console.error("[LegacyAPI] getTransactions error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

/**
 * GET /api/user/getSupportedCurrency
 * Get list of supported cryptocurrencies for this merchant
 */
router.get("/getSupportedCurrency", apiKeyOnlyMiddleware, async (req, res) => {
  try {
    const data = res.locals.apiKeyData;
    
    const currencies = await getAvailableCurrencies(data.adm_id, data.company_id);
    
    return res.status(200).json({
      success: true,
      message: "Supported currencies retrieved",
      data: {
        currencies,
        all_supported: CRYPTO_TYPES
      }
    });
    
  } catch (error) {
    console.error("[LegacyAPI] getSupportedCurrency error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

export default router;
