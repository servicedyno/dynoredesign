/**
 * Legacy API Authentication Middleware
 * 
 * Provides backward compatibility with the OLD Dynopay API (user-api.dynopay.com)
 * that used x-api-key + wallet_token authentication.
 * 
 * OLD API Flow:
 *   Headers: x-api-key + Authorization: Bearer {wallet_token}
 *   Direct call to /api/user/cryptoPayment
 * 
 * NEW API Flow:
 *   1. Create customer via /api/user/createUser
 *   2. Use customer JWT token for /api/user/cryptoPayment
 * 
 * This middleware bridges both flows by:
 *   1. Validating x-api-key (required for both)
 *   2. If Authorization contains a valid customer JWT → use NEW flow
 *   3. If Authorization is empty or invalid JWT → create/find default customer (OLD flow)
 */

import express from "express";
import { apiLogger } from "../utils/loggers";
import jwt from "jsonwebtoken";
import { QueryTypes } from "sequelize";
import sequelize from "../utils/dbInstance";
import { decrypt } from "../helper/encryption";

interface ApiKeyData {
  company_id: number;
  adm_id: number;
  base_currency: string;
  webhook_url?: string;
  webhook_secret?: string;
}

interface CustomerJwtPayload {
  id: string;
  customer_id?: number;
  email?: string;
  company_id?: number;
}

interface CustomerRecord {
  id: string;
  customer_id: number;
  customer_name: string;
  email: string;
  company_id: number;
}

/**
 * Validates API key and extracts company data
 */
const validateApiKey = async (apiKey: string): Promise<ApiKeyData | null> => {
  try {
    const decryptedData = decrypt(apiKey, process.env.API_SECRET || '');
    
    if (!decryptedData.includes("DYNOPAY_USER_API")) {
      apiLogger.info("[LegacyAuth] Invalid API key format");
      return null;
    }
    
    // Extract the JSON part after "DYNOPAY_USER_API-"
    const apiKeyPart = decryptedData.split("DYNOPAY_USER_API-")[1];
    const apiData = JSON.parse(apiKeyPart) as ApiKeyData;
    const { company_id, adm_id } = apiData;
    
    // Verify company exists
    const tempData = await sequelize.query<{ company_id: number }>(
      `SELECT company_id FROM tbl_company WHERE company_id=$1 AND user_id=$2`,
      { 
        bind: [company_id, adm_id],
        type: QueryTypes.SELECT 
      }
    );
    
    if (tempData.length === 0) {
      apiLogger.info("[LegacyAuth] Company not found for API key");
      return null;
    }
    
    // Fetch current base_currency + webhook config from DB (source of truth)
    // The encrypted key payload may have stale values if settings were updated after key creation
    const dbApiData = await sequelize.query<{ base_currency: string; webhook_url: string | null; webhook_secret: string | null }>(
      `SELECT base_currency, webhook_url, webhook_secret FROM tbl_api WHERE company_id=$1 AND user_id=$2 AND "apiKey"=$3 LIMIT 1`,
      {
        bind: [company_id, adm_id, apiKey],
        type: QueryTypes.SELECT
      }
    );
    
    if (dbApiData.length > 0) {
      apiData.base_currency = dbApiData[0].base_currency || apiData.base_currency;
      if (dbApiData[0].webhook_url) apiData.webhook_url = dbApiData[0].webhook_url;
      if (dbApiData[0].webhook_secret) apiData.webhook_secret = dbApiData[0].webhook_secret;
    }
    
    return apiData;
  } catch (error) {
    apiLogger.error("[LegacyAuth] API key validation error:", error);
    return null;
  }
};

/**
 * Validates customer JWT token
 */
const validateCustomerToken = (token: string): CustomerJwtPayload | null => {
  try {
    const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
    if (!tokenSecret) return null;
    
    const decoded = jwt.verify(token, tokenSecret) as CustomerJwtPayload;
    if (decoded && (decoded.id || decoded.customer_id)) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Finds or creates a default customer for legacy API calls
 */
const findOrCreateDefaultCustomer = async (
  companyId: number, 
  admId: number,
  baseCurrency: string
): Promise<CustomerRecord | null> => {
  try {
    // Look for existing default customer for this company
    const existingCustomer = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id 
       FROM tbl_customer 
       WHERE company_id = $1 AND email LIKE 'legacy-api-%'
       ORDER BY "createdAt" DESC LIMIT 1`,
      {
        bind: [companyId],
        type: QueryTypes.SELECT
      }
    );
    
    if (existingCustomer.length > 0) {
      apiLogger.info(`[LegacyAuth] Found existing default customer: ${existingCustomer[0].customer_id}`);
      return existingCustomer[0];
    }
    
    // Create a new default customer for legacy API calls
    const crypto = await import("crypto");
    const customerId = crypto.randomUUID();
    const defaultEmail = `legacy-api-${companyId}-${Date.now()}@dynopay.internal`;
    
    await sequelize.query(
      `INSERT INTO tbl_customer (id, customer_name, email, company_id, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      {
        bind: [customerId, 'Legacy API Customer', defaultEmail, companyId],
        type: QueryTypes.INSERT
      }
    );
    
    // Get the created customer with auto-generated customer_id
    const newCustomer = await sequelize.query<CustomerRecord>(
      `SELECT id, customer_id, customer_name, email, company_id 
       FROM tbl_customer WHERE id = $1`,
      {
        bind: [customerId],
        type: QueryTypes.SELECT
      }
    );
    
    if (newCustomer.length > 0) {
      // Create wallet for the customer
      const walletId = crypto.randomUUID();
      await sequelize.query(
        `INSERT INTO tbl_customer_wallet (id, customer_id, wallet_type, amount, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 0, NOW(), NOW())`,
        {
          bind: [walletId, newCustomer[0].customer_id, baseCurrency],
          type: QueryTypes.INSERT
        }
      );
      
      apiLogger.info(`[LegacyAuth] Created default customer: ${newCustomer[0].customer_id}`);
      return newCustomer[0];
    }
    
    return null;
  } catch (error) {
    apiLogger.error("[LegacyAuth] Error creating default customer:", error);
    return null;
  }
};

/**
 * Generate a temporary customer token for legacy API calls
 */
const generateCustomerToken = (customer: CustomerRecord): string => {
  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;
  if (!tokenSecret) throw new Error("ACCESS_TOKEN_SECRET not configured");
  
  const payload: CustomerJwtPayload = {
    id: customer.id,
    customer_id: customer.customer_id,
    email: customer.email,
    company_id: customer.company_id
  };
  
  return jwt.sign(payload, tokenSecret, { expiresIn: '365d' });
};

/**
 * Legacy API Authentication Middleware
 * 
 * Supports both OLD and NEW authentication flows:
 * - OLD: x-api-key + wallet_token (auto-creates default customer)
 * - NEW: x-api-key + customer JWT token
 */
const legacyApiAuthMiddleware = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    // Step 1: Validate x-api-key (required for both flows)
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
    
    // Store API key data for later use
    res.locals.apiKeyData = apiKeyData;
    
    // Step 2: Check Authorization header
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1];
    
    if (token) {
      // Try to validate as customer JWT (NEW flow)
      const customerData = validateCustomerToken(token);
      
      if (customerData) {
        // Valid customer JWT - use NEW flow
        apiLogger.info(`[LegacyAuth] Valid customer JWT for customer: ${customerData.id}`);
        res.locals.token = token;
        res.locals.user = customerData;
        return next();
      }
    }
    
    // Step 3: No valid customer token - use LEGACY flow
    // This handles: no auth header, invalid JWT, or wallet_token (old style)
    apiLogger.info(`[LegacyAuth] Using legacy flow - creating/finding default customer`);
    
    const defaultCustomer = await findOrCreateDefaultCustomer(
      apiKeyData.company_id,
      apiKeyData.adm_id,
      apiKeyData.base_currency || 'USD'
    );
    
    if (!defaultCustomer) {
      return res.status(500).json({
        success: false,
        message: "Failed to create customer context for legacy API"
      });
    }
    
    // Generate temporary token for this request
    const tempToken = generateCustomerToken(defaultCustomer);
    
    res.locals.token = tempToken;
    res.locals.user = {
      id: defaultCustomer.id,
      customer_id: defaultCustomer.customer_id,
      email: defaultCustomer.email,
      company_id: defaultCustomer.company_id
    };
    
    apiLogger.info(`[LegacyAuth] Legacy flow authenticated for company ${apiKeyData.company_id}`);
    next();
    
  } catch (error) {
    apiLogger.error("[LegacyAuth] Middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Authentication error: " + (error instanceof Error ? error.message : String(error))
    });
  }
};

export default legacyApiAuthMiddleware;
export { validateApiKey, validateCustomerToken, findOrCreateDefaultCustomer };
