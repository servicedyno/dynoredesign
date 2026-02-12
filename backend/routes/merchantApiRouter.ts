/**
 * Merchant API Router (unified)
 * 
 * Single source of truth for all merchant-facing API endpoints.
 * All endpoints use direct DB/controller calls — no HTTP self-calls.
 * 
 * Auth: x-api-key header (required) + customer JWT (optional for some endpoints)
 * 
 * Endpoints:
 *   POST /api/user/createUser          - Create a customer
 *   POST /api/user/cryptoPayment       - Create a direct crypto payment (returns QR + address)
 *   POST /api/user/createPayment       - Create a checkout payment (returns redirect URL)
 *   POST /api/user/addFunds            - Add funds to customer wallet (returns redirect URL)
 *   POST /api/user/useWallet           - Debit from customer wallet
 *   GET  /api/user/getBalance          - Get customer wallet balance
 *   GET  /api/user/getTransactions     - Get customer transaction history
 *   GET  /api/user/getSingleTransaction/:id - Get single transaction
 *   GET  /api/user/getCryptoTransaction/:address - Verify crypto payment by address
 *   GET  /api/user/getSupportedCurrency - Get supported currencies
 */

import express from "express";
import jwt from "jsonwebtoken";
import Crypto from "crypto";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import legacyApiAuthMiddleware, { validateApiKey } from "../middleware/legacyApiAuthMiddleware";
import { setRedisItem } from "../utils/redisInstance";
import { convertToMultiple } from "../utils/currencyUtils";
import { paymentController } from "../controller";

const router = express.Router();

// Supported crypto types
const CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];

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
 * API Key validation middleware (for endpoints that don't need customer auth)
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
    console.error("[MerchantAPI] apiKeyOnly error:", error);
    return res.status(500).json({
      success: false,
      message: "API key validation error"
    });
  }
};

// ============================================================
// POST /api/user/createUser
// Create a new customer for the merchant
// ============================================================
router.post("/createUser", apiKeyOnlyMiddleware, async (req, res) => {
  try {
    const { name, email, mobile } = req.body;
    const data = res.locals.apiKeyData;
    
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
        data: { token, customer_id: existingCustomer[0].id }
      });
    }
    
    const customerId = Crypto.randomUUID();
    
    await sequelize.query(
      `INSERT INTO tbl_customer (id, customer_name, email, mobile, company_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      {
        bind: [customerId, name, email, mobile || null, data.company_id],
        type: QueryTypes.INSERT
      }
    );
    
    const newCustomer = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT
      }
    );
    
    const walletId = Crypto.randomUUID();
    await sequelize.query(
      `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 0, NOW(), NOW())`,
      {
        bind: [walletId, newCustomer[0].customer_id, data.base_currency || 'USD'],
        type: QueryTypes.INSERT
      }
    );
    
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
    
    console.log(`[MerchantAPI] Created customer ${customerId} for company ${data.company_id}`);
    
    return res.status(200).json({
      success: true,
      message: "Registered Successful!",
      data: { token, customer_id: customerId }
    });
    
  } catch (error) {
    console.error("[MerchantAPI] createUser error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// POST /api/user/cryptoPayment
// Create a direct crypto payment (returns QR code + address)
// ============================================================
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
    
    console.log(`[MerchantAPI] cryptoPayment body keys: ${Object.keys(req.body).join(', ')}`);
    
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
    
    const allConfiguredCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);
    
    if (allConfiguredCurrencies.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment."
      });
    }
    
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
    
    const normalizedCurrency = currency.toUpperCase().trim();
    if (!effectiveAvailableCurrencies.includes(normalizedCurrency)) {
      return res.status(400).json({
        success: false,
        message: `${currency} is not available for this payment. Available currencies: ${effectiveAvailableCurrencies.join(', ')}`
      });
    }
    
    const customerData = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE id = $1`,
      {
        bind: [userData.id],
        type: QueryTypes.SELECT
      }
    );
    
    if (customerData.length === 0) {
      return res.status(400).json({ success: false, message: "Customer not found" });
    }
    
    // Direct currency conversion (no HTTP self-call)
    const localCurrency = normalizedCurrency.includes("USDT") ? "usdt" : normalizedCurrency.toLowerCase();
    let cryptoRates;
    try {
      cryptoRates = await convertToMultiple(
        data.base_currency || 'USD',
        [localCurrency],
        amount,
        false,
      );
    } catch (rateError) {
      console.error("[MerchantAPI] Currency rate error:", rateError);
      return res.status(500).json({ success: false, message: "Failed to get currency rates" });
    }
    
    if (!cryptoRates || cryptoRates.length === 0 || !cryptoRates[0]?.amount) {
      return res.status(500).json({ success: false, message: "Failed to get currency conversion rate" });
    }
    
    const cryptoAmount = cryptoRates[0].amount;
    
    const effectiveWebhookUrl = webhook_url || data.webhook_url || null;
    const effectiveWebhookSecret = data.webhook_secret || null;
    
    console.log(`[MerchantAPI] cryptoPayment - Company: ${data.company_id}, Amount: ${amount}, Currency: ${normalizedCurrency}`);
    console.log(`[MerchantAPI] webhook_url from body: ${webhook_url || 'NOT PROVIDED'}`);
    console.log(`[MerchantAPI] webhook_url from API key: ${data.webhook_url || 'NOT SET'}`);
    console.log(`[MerchantAPI] effectiveWebhookUrl: ${effectiveWebhookUrl || 'NULL'}`);
    console.log(`[MerchantAPI] callback_url: ${callback_url || 'NOT PROVIDED'}`);
    
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
      // Cached exchange rate avoids redundant ~100-300ms FastForex call in createCryptoPayment
      cached_transfer_rate: cryptoRates[0]?.transferRate || null,
      cached_crypto_amount: cryptoRates[0]?.amount || null,
      cached_crypto_currency: normalizedCurrency,
      ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
    };
    
    const transactionId = Crypto.randomBytes(24).toString("hex");
    await setRedisItem("customer-" + transactionId, redisPayload);
    
    // Direct controller call (no HTTP self-call)
    const paymentBody = {
      uniqueRef: transactionId,
      amount: cryptoAmount,
      currency: normalizedCurrency,
    };
    
    let capturedData: Record<string, unknown> | null = null;
    let capturedStatus = 200;
    
    const mockRes = {
      locals: { token: res.locals.token },
      status(code: number) {
        capturedStatus = code;
        return {
          json(body: unknown) {
            capturedData = body as Record<string, unknown>;
            return this;
          }
        };
      },
    } as unknown as express.Response;
    
    const mockReq = { ...req, body: paymentBody } as express.Request;
    
    await paymentController.createCryptoPayment(mockReq, mockRes);
    
    if (capturedStatus !== 200 || !capturedData) {
      console.error("[MerchantAPI] createCryptoPayment failed:", capturedData);
      return res.status(capturedStatus || 500).json({
        success: false,
        message: (capturedData as Record<string, unknown>)?.message || "Failed to create crypto payment",
      });
    }
    
    const paymentData = (capturedData as Record<string, unknown>).data as Record<string, unknown>;
    const { qr_code, address, transaction_id, destination_tag } = paymentData;
    
    console.log(`[MerchantAPI] Payment created - TX: ${transaction_id}, Address: ${address}${destination_tag ? `, Tag: ${destination_tag}` : ''}`);
    
    return res.status(200).json({
      success: true,
      message: "Payment Created!",
      data: {
        transaction_id,
        qr_code,
        address: normalizedCurrency === "BCH" ? "bitcoincash:" + address : address,
        amount: cryptoAmount,
        currency: normalizedCurrency,
        base_amount: amount,
        base_currency: data.base_currency || 'USD',
        redirect_uri,
        // XRP/RLUSD: Include destination tag so merchant can display it to customer
        ...(destination_tag && { destination_tag: Number(destination_tag) }),
      }
    });
    
  } catch (error) {
    console.error("[MerchantAPI] cryptoPayment error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// POST /api/user/createPayment
// Create a checkout payment (returns redirect URL for hosted checkout page)
// ============================================================
router.post("/createPayment", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    const data = res.locals.apiKeyData;
    
    const {
      amount,
      redirect_uri,
      meta_data,
      fee_payer,
      callback_url,
      webhook_url,
      accepted_currencies,
    } = req.body;
    
    if (!amount || amount < 5) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than or equal to 5"
      });
    }
    
    if (!redirect_uri) {
      return res.status(400).json({
        success: false,
        message: "redirect_uri is required"
      });
    }
    
    const allConfiguredCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);
    
    if (allConfiguredCurrencies.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment."
      });
    }
    
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
    
    const customerData = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE id = $1`,
      {
        bind: [userData.id],
        type: QueryTypes.SELECT
      }
    );
    
    if (customerData.length === 0) {
      return res.status(400).json({ success: false, message: "Customer not found" });
    }
    
    const effectiveWebhookUrl = webhook_url || data.webhook_url || null;
    const effectiveWebhookSecret = data.webhook_secret || null;
    
    console.log(`[MerchantAPI] createPayment - Company: ${data.company_id}, Amount: ${amount}`);
    
    const redisPayload = {
      customer_id: customerData[0].customer_id,
      company_id: data.company_id,
      adm_id: data.adm_id,
      base_currency: data.base_currency || 'USD',
      base_amount: amount,
      amount: amount,
      redirect_uri,
      pathType: "createPayment",
      fee_payer: fee_payer || 'company',
      available_currencies: effectiveAvailableCurrencies,
      all_configured_currencies: allConfiguredCurrencies,
      webhook_url: effectiveWebhookUrl,
      webhook_secret: effectiveWebhookSecret,
      callback_url: callback_url || null,
      ...(meta_data && { meta_data: JSON.stringify(meta_data) }),
    };
    
    const transactionId = Crypto.randomBytes(24).toString("hex");
    await setRedisItem("customer-" + transactionId, redisPayload);
    
    const checkoutUrl = process.env.CHECKOUT_URL || 'https://checkout.dynopay.com';
    const redirect_url = checkoutUrl + "/pay?d=" + transactionId;
    
    return res.status(200).json({
      success: true,
      message: "Link Generated!",
      data: {
        redirect_url,
        fee_payer: redisPayload.fee_payer,
        available_currencies: effectiveAvailableCurrencies,
        webhook_url: effectiveWebhookUrl ? 'configured' : 'not configured',
      }
    });
    
  } catch (error) {
    console.error("[MerchantAPI] createPayment error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// POST /api/user/addFunds
// Add funds to customer wallet (returns redirect URL)
// ============================================================
router.post("/addFunds", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    const data = res.locals.apiKeyData;
    
    const { amount, redirect_uri, fee_payer } = req.body;
    
    if (!amount || amount < 5) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than or equal to 5"
      });
    }
    
    if (!redirect_uri) {
      return res.status(400).json({
        success: false,
        message: "redirect_uri is required"
      });
    }
    
    const availableCurrencies = await getAvailableCurrencies(data.adm_id, data.company_id);
    
    if (availableCurrencies.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No crypto wallet configured. Please add at least one crypto wallet address before adding funds."
      });
    }
    
    const customerData = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE id = $1`,
      {
        bind: [userData.id],
        type: QueryTypes.SELECT
      }
    );
    
    if (customerData.length === 0) {
      return res.status(400).json({ success: false, message: "Customer not found" });
    }
    
    const redisPayload = {
      customer_id: customerData[0].customer_id,
      company_id: data.company_id,
      adm_id: data.adm_id,
      base_currency: data.base_currency || 'USD',
      base_amount: amount,
      amount: amount,
      redirect_uri,
      pathType: "addFund",
      fee_payer: fee_payer || 'company',
      available_currencies: availableCurrencies,
    };
    
    const transactionId = Crypto.randomBytes(24).toString("hex");
    await setRedisItem("customer-" + transactionId, redisPayload);
    
    const checkoutUrl = process.env.CHECKOUT_URL || 'https://checkout.dynopay.com';
    const redirect_url = checkoutUrl + "/pay?d=" + transactionId;
    
    return res.status(200).json({
      success: true,
      message: "Link Generated!",
      data: {
        redirect_url,
        fee_payer: redisPayload.fee_payer,
        available_currencies: availableCurrencies,
      }
    });
    
  } catch (error) {
    console.error("[MerchantAPI] addFunds error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// POST /api/user/useWallet
// Debit amount from customer wallet
// ============================================================
router.post("/useWallet", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    const data = res.locals.apiKeyData;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please add a valid amount"
      });
    }
    
    const customerData = await sequelize.query<{ customer_id: number }>(
      `SELECT customer_id FROM tbl_customer WHERE id = $1`,
      {
        bind: [userData.id],
        type: QueryTypes.SELECT
      }
    );
    
    if (customerData.length === 0) {
      return res.status(400).json({ success: false, message: "Customer not found" });
    }
    
    const customerId = customerData[0].customer_id;
    
    // Get wallet balance
    const walletData = await sequelize.query<{ amount: number; wallet_type: string }>(
      `SELECT amount, wallet_type FROM tbl_customer_wallet WHERE customer_id = $1 LIMIT 1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT
      }
    );
    
    if (walletData.length === 0) {
      return res.status(400).json({ success: false, message: "Wallet not found" });
    }
    
    if (walletData[0].amount < amount) {
      return res.status(400).json({ success: false, message: "Insufficient Balance!" });
    }
    
    const newAmount = Number(Number(walletData[0].amount) - Number(amount)).toFixed(2);
    
    // Debit wallet
    await sequelize.query(
      `UPDATE tbl_customer_wallet SET amount = $1, "updatedAt" = NOW() WHERE customer_id = $2`,
      {
        bind: [newAmount, customerId],
        type: QueryTypes.UPDATE
      }
    );
    
    // Get company name for transaction details
    const companyData = await sequelize.query<{ company_name: string }>(
      `SELECT company_name FROM tbl_company WHERE company_id = $1`,
      {
        bind: [data.company_id],
        type: QueryTypes.SELECT
      }
    );
    
    const companyName = companyData.length > 0 ? companyData[0].company_name : 'Unknown';
    
    // Create transaction record
    const txId = Crypto.randomUUID();
    const txRef = Crypto.randomUUID();
    
    await sequelize.query(
      `INSERT INTO tbl_customer_transaction 
       (id, company_id, customer_id, payment_mode, base_amount, base_currency, 
        paid_amount, paid_currency, transaction_type, transaction_details, 
        transaction_reference, status, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'WALLET', $4, $5, $4, $5, 'DEBIT', $6, $7, 'successful', NOW(), NOW())`,
      {
        bind: [
          txId,
          data.company_id,
          customerId,
          Number(amount).toFixed(2),
          data.base_currency || 'USD',
          `wallet transaction on ${companyName}`,
          txRef
        ],
        type: QueryTypes.INSERT
      }
    );
    
    console.log(`[MerchantAPI] useWallet - Debited ${amount} from customer ${customerId}`);
    
    return res.status(200).json({
      success: true,
      message: "amount debited successfully!",
      data: {
        new_balance: newAmount,
        transaction_id: txId,
      }
    });
    
  } catch (error) {
    console.error("[MerchantAPI] useWallet error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// GET /api/user/getBalance
// Get customer wallet balance
// ============================================================
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
    console.error("[MerchantAPI] getBalance error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// GET /api/user/getTransactions
// Get customer transaction history
// ============================================================
router.get("/getTransactions", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    const apiKeyData = res.locals.apiKeyData;
    const baseCurrency = apiKeyData?.base_currency || "USD";
    const { page = 1, limit = 10 } = req.query;
    
    const offset = (Number(page) - 1) * Number(limit);
    
    const transactions = await sequelize.query<Record<string, unknown>>(
      `SELECT ct.*,
        sc.conversion_id as auto_convert_id,
        sc.status as auto_convert_status,
        sc.source_currency as auto_convert_source_currency,
        sc.source_amount as auto_convert_source_amount,
        sc.source_amount_usd as auto_convert_source_amount_usd,
        sc.target_currency as auto_convert_target_currency,
        sc.target_amount as auto_convert_target_amount,
        sc.settlement_chain as auto_convert_settlement_chain,
        sc.conversion_rate as auto_convert_rate,
        sc.completed_at as auto_convert_completed_at
       FROM tbl_customer_transaction ct
       LEFT JOIN tbl_user_transaction ut ON ut.customer_id = ct.customer_id
         AND ut.base_amount = ct.base_amount
         AND ut."createdAt" BETWEEN ct."createdAt" - INTERVAL '5 minutes' AND ct."createdAt" + INTERVAL '5 minutes'
       LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id = ut.transaction_id
       WHERE ct.customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)
       ORDER BY ct."createdAt" DESC
       LIMIT $2 OFFSET $3`,
      {
        bind: [userData.id, Number(limit), offset],
        type: QueryTypes.SELECT
      }
    );

    // Map transactions with auto-convert data and base currency display
    const data = transactions.map((tx) => {
      const {
        auto_convert_id,
        auto_convert_status,
        auto_convert_source_currency,
        auto_convert_source_amount,
        auto_convert_source_amount_usd,
        auto_convert_target_currency,
        auto_convert_target_amount,
        auto_convert_settlement_chain,
        auto_convert_rate,
        auto_convert_completed_at,
        ...rest
      } = tx;
      return {
        ...rest,
        display_currency: baseCurrency,
        auto_converted: !!auto_convert_id,
        auto_convert: auto_convert_id
          ? {
              conversion_id: auto_convert_id,
              status: auto_convert_status,
              source_currency: auto_convert_source_currency,
              source_amount: auto_convert_source_amount ? Number(auto_convert_source_amount) : null,
              source_amount_usd: auto_convert_source_amount_usd ? Number(auto_convert_source_amount_usd) : null,
              target_currency: auto_convert_target_currency,
              target_amount: auto_convert_target_amount ? Number(auto_convert_target_amount) : null,
              settlement_chain: auto_convert_settlement_chain,
              conversion_rate: auto_convert_rate ? Number(auto_convert_rate) : null,
              completed_at: auto_convert_completed_at,
            }
          : null,
      };
    });
    
    return res.status(200).json({
      success: true,
      message: "Transactions retrieved",
      data,
      display_currency: baseCurrency,
    });
    
  } catch (error) {
    console.error("[MerchantAPI] getTransactions error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// GET /api/user/getSingleTransaction/:id
// Get a single transaction by ID
// ============================================================
router.get("/getSingleTransaction/:id", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const userData = res.locals.user;
    const apiKeyData = res.locals.apiKeyData;
    const baseCurrency = apiKeyData?.base_currency || "USD";
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid transaction_id!"
      });
    }
    
    const transaction = await sequelize.query<Record<string, unknown>>(
      `SELECT ct.id, ct.payment_mode, ct.base_amount, ct.base_currency, ct.paid_amount, ct.paid_currency,
              ct.transaction_type, ct.transaction_details, ct.transaction_reference, ct.status, ct."createdAt",
              sc.conversion_id as auto_convert_id,
              sc.status as auto_convert_status,
              sc.source_currency as auto_convert_source_currency,
              sc.source_amount as auto_convert_source_amount,
              sc.source_amount_usd as auto_convert_source_amount_usd,
              sc.target_currency as auto_convert_target_currency,
              sc.target_amount as auto_convert_target_amount,
              sc.settlement_chain as auto_convert_settlement_chain,
              sc.conversion_rate as auto_convert_rate,
              sc.completed_at as auto_convert_completed_at
       FROM tbl_customer_transaction ct
       LEFT JOIN tbl_user_transaction ut ON ut.customer_id = ct.customer_id
         AND ut.base_amount = ct.base_amount
         AND ut."createdAt" BETWEEN ct."createdAt" - INTERVAL '5 minutes' AND ct."createdAt" + INTERVAL '5 minutes'
       LEFT JOIN tbl_stablecoin_conversion sc ON sc.transaction_id = ut.transaction_id
       WHERE ct.customer_id = (SELECT customer_id FROM tbl_customer WHERE id = $1)
       AND ct.id = $2`,
      {
        bind: [userData.id, id],
        type: QueryTypes.SELECT
      }
    );
    
    if (transaction.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Please provide a valid transaction_id!"
      });
    }

    const txRaw = transaction[0];
    const {
      auto_convert_id,
      auto_convert_status,
      auto_convert_source_currency,
      auto_convert_source_amount,
      auto_convert_source_amount_usd,
      auto_convert_target_currency,
      auto_convert_target_amount,
      auto_convert_settlement_chain,
      auto_convert_rate,
      auto_convert_completed_at,
      ...txRest
    } = txRaw;
    const data = {
      ...txRest,
      display_currency: baseCurrency,
      auto_converted: !!auto_convert_id,
      auto_convert: auto_convert_id
        ? {
            conversion_id: auto_convert_id,
            status: auto_convert_status,
            source_currency: auto_convert_source_currency,
            source_amount: auto_convert_source_amount ? Number(auto_convert_source_amount) : null,
            source_amount_usd: auto_convert_source_amount_usd ? Number(auto_convert_source_amount_usd) : null,
            target_currency: auto_convert_target_currency,
            target_amount: auto_convert_target_amount ? Number(auto_convert_target_amount) : null,
            settlement_chain: auto_convert_settlement_chain,
            conversion_rate: auto_convert_rate ? Number(auto_convert_rate) : null,
            completed_at: auto_convert_completed_at,
          }
        : null,
    };
    
    return res.status(200).json({
      success: true,
      message: "Transaction retrieved",
      data,
      display_currency: baseCurrency,
    });
    
  } catch (error) {
    console.error("[MerchantAPI] getSingleTransaction error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// GET /api/user/getCryptoTransaction/:address
// Verify a crypto payment by blockchain address
// ============================================================
router.get("/getCryptoTransaction/:address", legacyApiAuthMiddleware, async (req, res) => {
  try {
    const { address } = req.params;
    
    if (!address) {
      return res.status(400).json({ success: false, message: "Please add address!" });
    }
    
    // Check if address exists in temp addresses
    const addressExists = await sequelize.query<{ wallet_address: string }>(
      `SELECT wallet_address FROM tbl_user_temp_address WHERE wallet_address = $1`,
      {
        bind: [address],
        type: QueryTypes.SELECT,
      }
    );
    
    if (addressExists.length === 0) {
      return res.status(400).json({ success: false, message: "Please add valid address!" });
    }
    
    // Direct controller call instead of HTTP self-call
    let capturedData: Record<string, unknown> | null = null;
    let capturedStatus = 200;
    
    const mockRes = {
      locals: { token: res.locals.token },
      status(code: number) {
        capturedStatus = code;
        return {
          json(body: unknown) {
            capturedData = body as Record<string, unknown>;
            return this;
          }
        };
      },
    } as unknown as express.Response;
    
    const mockReq = { ...req, body: { address } } as express.Request;
    
    await paymentController.verifyCryptoPayment(mockReq, mockRes);
    
    if (capturedStatus !== 200 || !capturedData) {
      return res.status(capturedStatus || 500).json({
        success: false,
        message: (capturedData as Record<string, unknown>)?.message || "Failed to verify crypto payment"
      });
    }
    
    return res.status(200).json({
      success: true,
      message: (capturedData as Record<string, unknown>)?.message || "Transaction verified",
      data: (capturedData as Record<string, unknown>)?.data
    });
    
  } catch (error) {
    console.error("[MerchantAPI] getCryptoTransaction error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

// ============================================================
// GET /api/user/getSupportedCurrency
// Get list of supported cryptocurrencies for this merchant
// ============================================================
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
    console.error("[MerchantAPI] getSupportedCurrency error:", error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error"
    });
  }
});

export default router;
