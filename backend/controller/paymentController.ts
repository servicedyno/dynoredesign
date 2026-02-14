import express from "express";
import { convertToUSD as convertToUSDUtil } from "../utils/currencyUtils";
import {
  currencyConvert,
  decrypt,
  errorResponseHelper,
  getErrorMessage,
  sendEmail,
  sendPaymentReceivedEmail,
  sendAdminFeeReceivedEmail,
  successResponseHelper,
} from "../helper";
import { apiLogger, cronLogger, webhookLogs } from "../utils/loggers";
import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
  softDeleteRedisItem,
  setRedisTTL,
} from "../utils/redisInstance";
import { formatAmountForDisplay, getCurrencyInfo } from "../utils/currencyUtils";
import sequelize from "../utils/dbInstance";
import { Op, QueryTypes } from "sequelize";
import jwt from "jsonwebtoken";
import {
  adminFeeModel,
  adminFeeTransactionModel,
  adminWalletModel,
  companyModel,
  customerModel,
  customerTransactionModel,
  customerWalletModel,
  userModel,
  userWalletModel,
  taxRateModel,
  kycModel,
} from "../models";
import { createNotification, NOTIFICATION_TYPES } from "./notificationController";
import {
  sendPartialPaymentNotification,
  sendPartialPaymentExpiredNotification,
} from "../services/pendingPaymentService";
import {
  sendCustomerPaymentConfirmationEmail,
} from "../services/emailService";
import {
  FW_API_Response,
  IFundData,
  ITemporaryAddress,
  IUserType,
  IVerifyResponse,
  IAdminData,
  PaymentUserJwtPayload,
} from "../utils/types";
import { paymentTypes } from "../utils/enums";
import flw from "../apis/flutterwaveApi";
import crypto from "crypto";
import axios from "axios";
import { autoGenerateInvoice } from "./invoiceController";
import { getClientIP, getCountryFromIP, getCountryFromTimezone } from "../utils/geolocation";

import {
  userTempAddressModel,
  userTransactionModel,
  paymentLinkModel,
  merchantTempAddressModel,
} from "../models";
import QR_Code from "qrcode";
import tatumApi from "../apis/tatumApi";
import blockchairApi from "../apis/blockchairApi";
import { getAdminWalletAddress } from "../utils/adminUtils";
import {
  getTransactionFee,
  getBlockchainFee,
  getDiscountedTransactionFee,
  calculateTransactionFees,
} from ".";
import { 
  getBlockchainNetworkFee, 
  getAllBlockchainFees, 
  calculateCustomerPaymentAmount 
} from "../services/blockchainFeeService";
import * as merchantPoolService from "../services/merchantPoolService";
import { callMerchantWebhook } from "../webhooks";
import { isTagBasedChain, getCryptoRedisKey } from "../services/merchantPool/merchantPoolConfig";
import { isStablecoin, isVolatileCrypto } from "../services/binanceService";
import { createConversionRecord } from "../services/conversionService";
import { stablecoinConversionModel } from "../models";

// ============================================
// CENTRALIZED TIMING CONFIGURATION
// ============================================
// All payment timing constants in one place for consistency
// These can be overridden by merchant settings in tbl_company
const PAYMENT_TIMING = {
  // Crypto invoice window - time to complete payment after selecting currency
  CRYPTO_INVOICE_MINUTES: 15,
  
  // Grace period for partial/underpayment completion
  GRACE_PERIOD_MINUTES: 30,
  
  // Redis TTL for soft-deleted payment data (matches grace period)
  REDIS_SOFT_DELETE_TTL_SECONDS: 30 * 60, // 1800 seconds
  
  // Default payment link expiry options
  LINK_EXPIRY: {
    '24h': 24 * 60,        // 24 hours in minutes
    '7d': 7 * 24 * 60,     // 7 days in minutes (default)
    '30d': 30 * 24 * 60,   // 30 days in minutes
    'never': null,
  },
  
  // Webhook/confirmation timeouts
  TRANSACTION_CONFIRMATION_TIMEOUT_MS: 90000, // 90 seconds
  
  // SQL interval constants (for parameterized queries)
  SQL_INTERVALS: {
    GRACE_PERIOD: '30 minutes',
    CRYPTO_INVOICE: '15 minutes', 
    RECENT_TRANSACTIONS: '2 days',
    MONTHLY_TRANSACTIONS: '30 days',
  },
};

// ============================================
// CENTRALIZED ADMIN CONFIGURATION
// ============================================
const ADMIN_CONFIG = {
  // Admin email for notifications (from env, no hardcoded fallback exposed)
  EMAIL: process.env.ADMIN_EMAIL || process.env.SMTP_USER || '',
  
  // JWT expiry times
  JWT_EXPIRY: {
    ADMIN: '30d',
    USER: '7d',
    API_KEY: '365d',
    CHECKOUT: '1h',
  },
};

// Retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 2000,
};


/**
 * Convert crypto amount to USD
 * Used for displaying pending amounts in USD
 */
const convertToUSD = async (amount: number, currency: string): Promise<number> => {
  try {
    if (!amount || amount <= 0) return 0;
    return await convertToUSDUtil(currency, amount);
  } catch (error) {
    console.error(`[convertToUSD] Failed to convert ${amount} ${currency} to USD:`, error);
    return 0;
  }
};

/**
 * Retry helper with exponential backoff for blockchain operations
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES
): Promise<T> => {
  let lastError: Error = new Error('Operation failed');
  
  // Hard failures that should NOT be retried (invalid data, auth issues, permanent errors)
  const NON_RETRYABLE_ERRORS = [
    'invalid address',
    'invalid private key',
    'insufficient balance',
    'insufficient funds',
    'nonce too low',
    'replacement transaction underpriced',
    'already known',
    'invalid signature',
    'bad request',
    'unauthorized',
    'forbidden',
    'not found',
    '400',
    '401', 
    '403',
    '404',
  ];
  
  const isRetryable = (error: Error): boolean => {
    const message = error.message?.toLowerCase() || '';
    return !NON_RETRYABLE_ERRORS.some(pattern => message.includes(pattern.toLowerCase()));
  };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const message = getErrorMessage(error);
      
      // Check if error is retryable (soft failure like network timeout, rate limit)
      if (!isRetryable(lastError)) {
        console.error(`[PaymentController] ❌ ${operationName} failed with non-retryable error: ${message}`);
        throw lastError; // Don't retry hard failures
      }
      
      if (attempt < maxRetries) {
        const waitTime = RETRY_CONFIG.INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[PaymentController] ⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${message}`);
        console.warn(`[PaymentController] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`[PaymentController] ❌ ${operationName} failed after ${maxRetries} attempts: ${message}`);
      }
    }
  }
  
  throw lastError;
};

// Tax calculation constants
const TAX_DATA_API_URL = process.env.TAX_DATA_API_URL || "https://api.apilayer.com/tax_data";
const TAX_DATA_API_KEY = process.env.TAX_DATA_API_KEY;

// Fallback VAT rates for major countries
const FALLBACK_TAX_RATES: Record<string, number> = {
  AT: 20, BE: 21, BG: 20, CY: 19, CZ: 21, DE: 19, DK: 25, EE: 22, ES: 21,
  FI: 24, FR: 20, GR: 24, HR: 25, HU: 27, IE: 23, IT: 22, LT: 21, LU: 17,
  LV: 21, MT: 18, NL: 21, PL: 23, PT: 23, RO: 19, SE: 25, SI: 22, SK: 20,
  GB: 20, CH: 8.1, NO: 25, IS: 24, LI: 8.1,
  US: 0, CA: 5, AU: 10, NZ: 15, JP: 10, SG: 9, IN: 18,
};

// Tax acronyms by country
const TAX_ACRONYMS: Record<string, string> = {
  AT: "VAT", BE: "VAT", BG: "VAT", CY: "VAT", CZ: "VAT", DE: "VAT", DK: "VAT",
  EE: "VAT", ES: "IVA", FI: "VAT", FR: "TVA", GR: "VAT", HR: "VAT", HU: "VAT",
  IE: "VAT", IT: "IVA", LT: "VAT", LU: "VAT", LV: "VAT", MT: "VAT", NL: "VAT",
  PL: "VAT", PT: "IVA", RO: "VAT", SE: "VAT", SI: "VAT", SK: "VAT",
  GB: "VAT", CH: "VAT", NO: "VAT", IS: "VAT", LI: "VAT",
  US: "Tax", CA: "GST", AU: "GST", NZ: "GST", JP: "Tax", SG: "GST", IN: "GST",
};

// Country names
const COUNTRY_NAMES: Record<string, string> = {
  AT: "Austria", BE: "Belgium", BG: "Bulgaria", CY: "Cyprus", CZ: "Czech Republic",
  DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain", FI: "Finland",
  FR: "France", GR: "Greece", HR: "Croatia", HU: "Hungary", IE: "Ireland",
  IT: "Italy", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MT: "Malta",
  NL: "Netherlands", PL: "Poland", PT: "Portugal", RO: "Romania", SE: "Sweden",
  SI: "Slovenia", SK: "Slovakia", GB: "United Kingdom", US: "United States",
  CA: "Canada", AU: "Australia", NZ: "New Zealand", IN: "India", JP: "Japan",
  CH: "Switzerland", NO: "Norway", SG: "Singapore",
};

/**
 * Calculate tax for checkout based on customer location
 * Called internally by getData when apply_tax is enabled
 */
const calculateTaxForCheckout = async (
  countryCode: string,
  amount: number,
  currency: string
): Promise<{
  tax_enabled: boolean;
  tax_rate: number;
  tax_acronym: string;
  tax_amount: number;
  country_code: string;
  country_name: string;
  subtotal: number;
  total: number;
  currency: string;
} | null> => {
  try {
    const upperCountryCode = countryCode.toUpperCase();
    
    let taxRate = 0;
    let taxAcronym = TAX_ACRONYMS[upperCountryCode] || 'Tax';
    let countryName = COUNTRY_NAMES[upperCountryCode] || countryCode;
    
    // Define type for cached rate
    interface CachedTaxRate {
      dataValues: {
        standard_rate?: string | number;
        tax_acronym?: string;
        country_name?: string;
      };
    }
    
    // Check database cache first
    const cachedRate = await taxRateModel.findOne({
      where: { country_code: upperCountryCode }
    }) as CachedTaxRate | null;

    if (cachedRate) {
      taxRate = parseFloat(String(cachedRate.dataValues.standard_rate)) || 0;
      taxAcronym = String(cachedRate.dataValues.tax_acronym || taxAcronym);
      countryName = String(cachedRate.dataValues.country_name || countryName);
      console.log(`[Tax] Using cached rate for ${upperCountryCode}: ${taxRate}%`);
    } else if (TAX_DATA_API_KEY) {
      // Try to fetch from API
      try {
        const response = await axios.get(`${TAX_DATA_API_URL}/tax_rates`, {
          headers: { apikey: TAX_DATA_API_KEY },
          params: { country: upperCountryCode },
          timeout: 5000
        });

        if (response.data && response.data.standard_rate !== undefined) {
          taxRate = response.data.standard_rate;
          console.log(`[Tax] Fetched rate from API for ${upperCountryCode}: ${taxRate}%`);
          
          // Cache the result
          await taxRateModel.create({
            country_code: upperCountryCode,
            country_name: countryName,
            tax_acronym: taxAcronym,
            standard_rate: taxRate,
          }).catch(() => {}); // Ignore cache errors
        }
      } catch (apiError: unknown) {
        console.log(`[Tax] API error for ${upperCountryCode}, using fallback:`, getErrorMessage(apiError));
        taxRate = FALLBACK_TAX_RATES[upperCountryCode] || 0;
      }
    } else {
      // No API key, use fallback
      taxRate = FALLBACK_TAX_RATES[upperCountryCode] || 0;
      console.log(`[Tax] Using fallback rate for ${upperCountryCode}: ${taxRate}%`);
    }

    // Calculate tax
    const taxAmount = (amount * taxRate) / 100;
    const total = amount + taxAmount;

    return {
      tax_enabled: true,
      tax_rate: taxRate,
      tax_acronym: taxAcronym,
      tax_amount: parseFloat(taxAmount.toFixed(2)),
      country_code: upperCountryCode,
      country_name: countryName,
      subtotal: parseFloat(amount.toFixed(2)),
      total: parseFloat(total.toFixed(2)),
      currency
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Tax] Error calculating tax:`, errorMessage);
    return null;
  }
};

const getData = async (req: express.Request, res: express.Response) => {
  try {
    const { data, timezone } = req.body;  // Accept timezone hint from frontend

    // Validate data parameter is provided
    if (!data) {
      return errorResponseHelper(res, 400, "Payment reference is required");
    }

    // Define interface for incomplete payment data
    interface IncompletePaymentData {
      currency: string;
      address: string;
      pending_amount: number | string;
      timestamp: string | Date;
      qr_code?: string;
      destination_tag?: number | null; // XRP/RLUSD destination tag for tag-based chains
    }

    // Define interface for Redis payment item
    interface RedisPaymentItem {
      pathType?: string;
      company_id?: number;
      base_amount?: number;
      amount?: number;
      base_currency?: string;
      email?: string;
      transaction_id?: string;
      link_id?: number;
      description?: string;
      allowedModes?: string;
      fee_payer?: 'customer' | 'company';
      apply_tax?: boolean;
      expires_at?: string | Date;
      redirect_url?: string;
      callback_url?: string;
      webhook_url?: string;
      createdAt?: string | Date;
      customer_id?: string;
      incomplete_payment?: IncompletePaymentData;
      available_currencies?: string[] | string;  // Can be array or comma-separated string
      accepted_currencies?: string;
      customer_name?: string;  // Optional customer name
    }

    const item = await getRedisItem("customer-" + data) as RedisPaymentItem | null;

    // Only log for debugging when item exists or in development
    if (process.env.NODE_ENV === 'development' || (item && Object.keys(item).length > 0)) {
      console.log("[getData] Payment lookup:", { hasItem: !!item && Object.keys(item).length > 0, dataRef: data?.substring(0, 10) + '...' });
    }
    
    // Check if item exists
    if (!item || Object.keys(item).length === 0) {
      return errorResponseHelper(res, 404, "Payment link not found or expired");
    }
    
    // Get company info if company_id exists
    let companyInfo: Record<string, unknown> | null = null;
    let paymentSettings = {
      initial_window_minutes: PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES,      // Default: 15 minutes to pay after selecting crypto
      grace_period_minutes: PAYMENT_TIMING.GRACE_PERIOD_MINUTES,        // Default: 30 minutes to complete partial payment
      overpayment_threshold_usd: 5,    // Default: $5 minimum overpayment to handle
      underpayment_threshold_usd: 1,   // Default: $1 maximum underpayment to accept as full payment
    };
    
    // Define company data interface
    interface CompanyDataValues {
      company_name?: string;
      photo?: string;
      grace_period_minutes?: number | string;
      overpayment_threshold_usd?: number | string;
      underpayment_threshold_usd?: number | string;
    }
    
    if (item.company_id) {
      try {
        const company = await companyModel.findByPk(item.company_id);
        if (company) {
          const companyData = (company as { dataValues: CompanyDataValues }).dataValues;
          companyInfo = {
            company_name: String(companyData.company_name || '') || null,
            company_logo: String(companyData.photo || '') || null,  // Only include if available
          };
          
          // Override defaults with company-specific settings if configured
          if (companyData.grace_period_minutes !== undefined && companyData.grace_period_minutes !== null) {
            paymentSettings.grace_period_minutes = Math.min(parseInt(String(companyData.grace_period_minutes)), 30); // Max 30 minutes
          }
          if (companyData.overpayment_threshold_usd !== undefined && companyData.overpayment_threshold_usd !== null) {
            paymentSettings.overpayment_threshold_usd = parseFloat(String(companyData.overpayment_threshold_usd));
          }
          if (companyData.underpayment_threshold_usd !== undefined && companyData.underpayment_threshold_usd !== null) {
            paymentSettings.underpayment_threshold_usd = parseFloat(String(companyData.underpayment_threshold_usd));
          }
        }
      } catch (companyError) {
        console.warn(`[getData] Failed to fetch company info:`, companyError);
      }
    }
    
    // Get fee configuration (internal calculation - not exposed to public)
    const transactionFeePercent = Number(process.env.TRANSACTION_FEE_PERCENT) || 1.5;
    const feeTiers = (await import("../utils/feeConfigUtils")).getFeeTiers();
    const amount = Number(item.base_amount || item.amount || 0);
    
    // Find applicable fee tier based on amount
    let fixedFee = 0;
    for (const tier of feeTiers) {
      if (amount >= tier.min && (tier.max === null || amount <= tier.max)) {
        fixedFee = tier.fixed;
        break;
      }
    }
    
    // Calculate total processing fee (internal - details not exposed)
    // Total fees = transaction fee % + fixed fee + network fee
    const feeAmountPercent = (amount * transactionFeePercent) / 100;
    
    // Include blockchain network fee for consistency with getCurrencyRates
    let networkFeeUSD = 0;
    try {
      const networkFee = await getBlockchainNetworkFee('ETH'); // Use ETH as default for USD display
      networkFeeUSD = Number(networkFee.feeInUSD) || 0;
    } catch (e) {
      console.log('[getData] Could not fetch network fee, using 0');
    }
    
    const totalProcessingFee = parseFloat((feeAmountPercent + fixedFee + networkFeeUSD).toFixed(2));
    // totalWithFees calculated but not used - kept for reference
    
    // Calculate expiry countdown
    let expiryInfo: Record<string, unknown> | null = null;
    if (item.expires_at) {
      const expiresAt = new Date(item.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      
      if (diffMs > 0) {
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        
        expiryInfo = {
          expires_at: item.expires_at,
          is_expired: false,
          countdown: {
            days,
            hours,
            minutes,
            seconds,
            formatted: `${days}d : ${hours.toString().padStart(2, '0')}h : ${minutes.toString().padStart(2, '0')}m : ${seconds.toString().padStart(2, '0')}s`
          }
        };
      } else {
        // Payment link has expired - return error response
        console.log(`[getData] Payment link expired at ${item.expires_at}`);
        return errorResponseHelper(
          res, 
          410, 
          "This payment link has expired. Please contact the merchant for a new payment link."
        );
      }
    }
    
    // Generate order reference (format: PREFIX-YEAR-SEQUENCE)
    const orderReference = item.transaction_id 
      ? `INV-${new Date().getFullYear()}-${item.link_id || item.transaction_id.substring(0, 8).toUpperCase()}`
      : null;
    
    // Define tax info type
    interface TaxInfo {
      tax_enabled: boolean;
      tax_rate: number;
      tax_acronym?: string;
      tax_amount: number;
      country_code?: string;
      country_name?: string;
      country_detected?: boolean;
      subtotal: number;
      total: number;
      currency?: string;
      message?: string;
    }
    
    // Tax calculation - only if merchant enabled apply_tax
    let taxInfo: TaxInfo | null = null;
    if (item.apply_tax) {
      console.log(`[getData] Tax enabled for this payment link, detecting customer location...`);
      
      // Log all relevant headers for debugging
      console.log(`[getData] Headers received:`, {
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'x-real-ip': req.headers['x-real-ip'],
        'cf-connecting-ip': req.headers['cf-connecting-ip'],
        'cf-ipcountry': req.headers['cf-ipcountry'],
        'true-client-ip': req.headers['true-client-ip'],
        'x-client-ip': req.headers['x-client-ip'],
      });
      console.log(`[getData] Timezone hint from frontend: ${timezone || 'not provided'}`);
      
      // Get customer IP and detect country
      const clientIP = getClientIP(req);
      console.log(`[getData] Customer IP: ${clientIP}`);
      
      // Check if IP is localhost/private (unreliable for geolocation)
      const isPrivateIP = clientIP === '127.0.0.1' || 
                          clientIP === 'localhost' ||
                          clientIP.startsWith('192.168.') ||
                          clientIP.startsWith('10.') ||
                          clientIP.startsWith('172.') ||
                          clientIP === '::1';
      
      let geoLocation = null;
      
      // If timezone is provided and IP is private/localhost, prefer timezone
      if (timezone && isPrivateIP) {
        console.log(`[getData] Private/localhost IP detected (${clientIP}), using timezone: ${timezone}`);
        geoLocation = getCountryFromTimezone(timezone);
      } else {
        // Try IP-based geolocation first
        geoLocation = await getCountryFromIP(clientIP, req.headers);
        
        // If IP detection failed or returned unreliable result, and timezone provided, use timezone
        if ((!geoLocation || !geoLocation.country_code) && timezone) {
          console.log(`[getData] IP detection failed, trying timezone fallback: ${timezone}`);
          geoLocation = getCountryFromTimezone(timezone);
        }
      }
      
      if (geoLocation && geoLocation.country_code) {
        console.log(`[getData] Detected country: ${geoLocation.country_name} (${geoLocation.country_code}) via ${geoLocation.source || 'ip'}`);
        
        // Calculate tax based on detected country
        taxInfo = await calculateTaxForCheckout(
          geoLocation.country_code,
          amount,
          item.base_currency
        );
        
        if (taxInfo) {
          console.log(`[getData] Tax calculated: ${taxInfo.tax_rate}% ${taxInfo.tax_acronym} = ${taxInfo.tax_amount} ${taxInfo.currency}`);
        }
      } else {
        console.log(`[getData] Could not detect customer country, tax not applied`);
        taxInfo = {
          tax_enabled: true,
          country_detected: false,
          tax_rate: 0,
          tax_amount: 0,
          subtotal: amount,
          total: amount,
          currency: item.base_currency,
          message: "Country could not be detected. Please ensure your browser allows timezone detection."
        };
      }
    }
    
    // Calculate grand total including tax (if applicable)
    const taxAmount = taxInfo?.tax_amount || 0;
    // Total should ALWAYS include tax, regardless of fee_payer
    // For customer pays fees: Don't include processing fee in total_amount yet
    // The exact fee depends on selected crypto and will be calculated by getCurrencyRates
    const subtotalWithTax = amount + taxAmount;
    // grandTotal calculated but not used - kept for reference: amount + totalProcessingFee + taxAmount
    
    // Convert incomplete payment amount to USD if exists
    let incompletePaymentUSD = 0;
    if (item.incomplete_payment?.pending_amount && item.incomplete_payment?.currency) {
      incompletePaymentUSD = await convertToUSD(
        Number(item.incomplete_payment.pending_amount),
        item.incomplete_payment.currency
      );
    }
    
    let payload;
    
    // Parse available_currencies for frontend display
    let availableCurrenciesList: string[] = [];
    if (item.available_currencies) {
      if (Array.isArray(item.available_currencies)) {
        availableCurrenciesList = item.available_currencies;
      } else if (typeof item.available_currencies === 'string') {
        availableCurrenciesList = item.available_currencies.split(',').map((c: string) => c.trim());
      }
    }
    
    // Also check accepted_currencies from payment link record if available_currencies is empty
    if (availableCurrenciesList.length === 0 && item.accepted_currencies) {
      if (typeof item.accepted_currencies === 'string') {
        availableCurrenciesList = item.accepted_currencies.split(',').map((c: string) => c.trim());
      }
    }
    
    // Normalize USDC-ERC20 → USDC for checkout frontend compatibility
    // Checkout only has "USDC" in its cryptoOptions (no network selection for USDC)
    availableCurrenciesList = [...new Set(availableCurrenciesList.map(c => c === 'USDC-ERC20' ? 'USDC' : c))];
    
    if (item.pathType === "createLink") {
      payload = {
        amount: amount, // Use the converted number instead of item.base_amount
        base_currency: item.base_currency,
        token: await getLinkAccessToken(
          item.email,
          data,
          item.pathType,
          item.transaction_id
        ),
        payment_mode: item.pathType,
        allowedModes: item.allowedModes,
        fee_payer: item.fee_payer || 'company',
        // Customer name - displayed on checkout page if provided
        ...(item.customer_name && { customer_name: item.customer_name }),
        // Enhanced checkout data
        transaction_id: item.transaction_id,
        order_reference: orderReference,
        description: item.description || null,
        merchant: companyInfo,
        // Payment timing settings - passed upfront for checkout to display
        payment_settings: paymentSettings,
        // Available currencies - filtered by merchant's accepted_currencies selection
        // If empty, frontend should call /configured-currencies endpoint
        ...(availableCurrenciesList.length > 0 && { available_currencies: availableCurrenciesList }),
        // Simplified fee info - always include subtotal and total with tax
        fee_info: {
          fee_payer: item.fee_payer || 'company',
          subtotal: parseFloat(amount.toFixed(2)),
          tax_amount: parseFloat(taxAmount.toFixed(2)),
          // Total always includes tax, regardless of fee_payer
          total_amount: parseFloat(subtotalWithTax.toFixed(2)),
          // For customer pays fees: show estimated processing fee
          ...(item.fee_payer === 'customer' && {
            // Processing fee is ESTIMATED - actual fee depends on selected cryptocurrency
            // Frontend should call getCurrencyRates after crypto selection to get exact fee
            estimated_processing_fee: parseFloat(totalProcessingFee.toFixed(2)),
            fees_pending_crypto_selection: true, // Flag to indicate fee is estimated
          }),
          // For company pays fees: NO processing_fee returned (hidden from customer)
        },
        expiry: expiryInfo,
        created_at: item.createdAt || new Date().toISOString(),
        // Post-payment settings - redirect_url for customer redirection after payment
        // Only include if configured (callback_url and webhook_url are backend-only for security)
        ...(item.redirect_url && { redirect_url: item.redirect_url }),
        // Tax information - only included if merchant enabled apply_tax
        apply_tax: item.apply_tax || false,
        ...(taxInfo && { tax_info: taxInfo }),
        // PHASE 12: Include incomplete payment info if exists (for currency lock on frontend)
        ...(item.incomplete_payment && {
          incomplete_payment: {
            exists: true,
            currency: item.incomplete_payment.currency,
            address: item.incomplete_payment.address,
            pending_amount: item.incomplete_payment.pending_amount,
            pending_usd: incompletePaymentUSD, // Properly converted to USD
            timestamp: item.incomplete_payment.timestamp,
            remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
            qr_code: item.incomplete_payment.qr_code,
            // XRP/RLUSD: Include destination tag for tag-based chains
            ...(item.incomplete_payment.destination_tag && { destination_tag: Number(item.incomplete_payment.destination_tag) }),
            ...(item.incomplete_payment.destination_tag && { memo: String(item.incomplete_payment.destination_tag) }),
          }
        }),
      };
    } else {
      // Validate customer_id exists before calling getAccessToken
      if (!item.customer_id) {
        console.warn(`[getData] Missing customer_id for non-createLink payment:`, item);
        // Try to use link-style token generation as fallback
        payload = {
          amount: item.amount || item.base_amount,
          base_currency: item.base_currency,
          token: await getLinkAccessToken(
            item.email,
            data,
            item.pathType || 'payment',
            item.transaction_id
          ),
          payment_mode: item.pathType,
          fee_payer: item.fee_payer || 'company',
          // Enhanced checkout data
          transaction_id: item.transaction_id,
          order_reference: orderReference,
          description: item.description || null,
          merchant: companyInfo,
          // Payment timing settings - passed upfront for checkout to display
          payment_settings: paymentSettings,
          // Available currencies - filtered by merchant's accepted_currencies selection
          ...(availableCurrenciesList.length > 0 && { available_currencies: availableCurrenciesList }),
          // Simplified fee info - no internal breakdown exposed
          fee_info: {
            fee_payer: item.fee_payer || 'company',
            ...(item.fee_payer === 'customer' && {
              estimated_processing_fee: parseFloat(totalProcessingFee.toFixed(2)),
              fees_pending_crypto_selection: true,
              subtotal: parseFloat(amount.toFixed(2)),
              tax_amount: parseFloat(taxAmount.toFixed(2)),
              total_amount: parseFloat(subtotalWithTax.toFixed(2)),
            })
          },
          expiry: expiryInfo,
          // Post-payment settings - redirect_url for customer redirection after payment
          ...(item.redirect_url && { redirect_url: item.redirect_url }),
          // Tax information
          apply_tax: item.apply_tax || false,
          ...(taxInfo && { tax_info: taxInfo }),
          // PHASE 12: Include incomplete payment info if exists
          ...(item.incomplete_payment && {
            incomplete_payment: {
              exists: true,
              currency: item.incomplete_payment.currency,
              address: item.incomplete_payment.address,
              pending_amount: item.incomplete_payment.pending_amount,
              pending_usd: incompletePaymentUSD, // Properly converted to USD
              timestamp: item.incomplete_payment.timestamp,
              remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
              qr_code: item.incomplete_payment.qr_code,
              // XRP/RLUSD: Include destination tag for tag-based chains
              ...(item.incomplete_payment.destination_tag && { destination_tag: Number(item.incomplete_payment.destination_tag) }),
            ...(item.incomplete_payment.destination_tag && { memo: String(item.incomplete_payment.destination_tag) }),
            }
          }),
        };
      } else {
        payload = {
          amount: item.amount,
          base_currency: item.base_currency,
          token: await getAccessToken(item.customer_id, data),
          payment_mode: item.pathType,
          fee_payer: item.fee_payer || 'company',
          // Enhanced checkout data
          transaction_id: item.transaction_id,
          order_reference: orderReference,
          description: item.description || null,
          merchant: companyInfo,
          // Payment timing settings - passed upfront for checkout to display
          payment_settings: paymentSettings,
          // Available currencies - filtered by merchant's accepted_currencies selection
          ...(availableCurrenciesList.length > 0 && { available_currencies: availableCurrenciesList }),
          // Simplified fee info - no internal breakdown exposed
          fee_info: {
            fee_payer: item.fee_payer || 'company',
            ...(item.fee_payer === 'customer' && {
              estimated_processing_fee: parseFloat(totalProcessingFee.toFixed(2)),
              fees_pending_crypto_selection: true,
              subtotal: parseFloat(amount.toFixed(2)),
              tax_amount: parseFloat(taxAmount.toFixed(2)),
              total_amount: parseFloat(subtotalWithTax.toFixed(2)),
            })
          },
          expiry: expiryInfo,
          // Post-payment settings - redirect_url for customer redirection after payment
          ...(item.redirect_url && { redirect_url: item.redirect_url }),
          // Tax information
          apply_tax: item.apply_tax || false,
          ...(taxInfo && { tax_info: taxInfo }),
          // PHASE 12: Include incomplete payment info if exists
          ...(item.incomplete_payment && {
            incomplete_payment: {
              exists: true,
              currency: item.incomplete_payment.currency,
              address: item.incomplete_payment.address,
              pending_amount: item.incomplete_payment.pending_amount,
              pending_usd: incompletePaymentUSD, // Properly converted to USD
              timestamp: item.incomplete_payment.timestamp,
              remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
              qr_code: item.incomplete_payment.qr_code,
              // XRP/RLUSD: Include destination tag for tag-based chains
              ...(item.incomplete_payment.destination_tag && { destination_tag: Number(item.incomplete_payment.destination_tag) }),
            ...(item.incomplete_payment.destination_tag && { memo: String(item.incomplete_payment.destination_tag) }),
            }
          }),
        };
      }
    }

    console.log(payload);
    successResponseHelper(res, 200, "Payment link details retrieved successfully", payload);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, new Error(e));
    errorResponseHelper(res, 404, "Sorry! No transaction found");
  }
};

const getLinkAccessToken = async (email, ref, pathType, id) => {
  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  if (tokenSecret) {
    const token = jwt.sign({ email, ref, pathType, transaction_id: id }, tokenSecret);
    return token;
  }
};

const getAccessToken = async (id, ref) => {
  const user = await customerModel.findOne({
    where: {
      customer_id: id,
    },
  });

  const tokenSecret = process.env.ACCESS_TOKEN_SECRET;

  const { customer_id, company_id, ...userData } = user.dataValues;
  console.log(userData);
  if (tokenSecret) {
    const token = jwt.sign({ ...userData, ref, pathType: "" }, tokenSecret);
    return token;
  }
};

const addPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;

  try {
    const { data } = req.body;
    const userData = jwt.decode(res.locals.token) as IUserType;
    if (data) {
      const value: IFundData = JSON.parse(decrypt(data));
      if (typeof value === "object") {
        let finalRes;
        const items = await getRedisItem("customer-" + userData.ref);
        if (value.paymentType === paymentTypes.CARD) {
          const { paymentRes, uniqueRef } = await cardPayment(value, userData);
          console.log(paymentRes);
          if (paymentRes.status !== "successful") {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };
            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem(uniqueRef, {
                ...items,
                hash: data,
                mode: paymentTypes.CARD,
              });
            } else {
              await setRedisItem(uniqueRef, {
                ...items,
                id: paymentRes.data.id,
                mode: paymentTypes.CARD,
              });
            }
          }
        }

        if (value.paymentType === paymentTypes.BANK_TRANSFER) {
          const { paymentRes, uniqueRef } = await bankTransfer(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          const { transfer_reference, ...rest } = paymentRes.meta.authorization;
          finalRes = { hash: uniqueRef, ...rest };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.BANK_TRANSFER,
          });
        }

        if (value.paymentType === paymentTypes.USSD) {
          const { paymentRes, uniqueRef } = await USSD(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          const ussdResponse = paymentRes as { meta?: { authorization?: { note?: string } }; data?: { payment_code?: string } };
          const { note } = ussdResponse.meta?.authorization || {};
          const { payment_code } = ussdResponse.data || {};
          finalRes = { hash: uniqueRef, note, payment_code };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.USSD,
          });
        }

        if (value.paymentType === paymentTypes.MOBILE_MONEY) {
          const { paymentRes, uniqueRef } = await MobileMoney(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          const mobileResponse = paymentRes as { meta?: { authorization?: Record<string, unknown> } };
          if (value.currency === "KES") {
            finalRes = { hash: uniqueRef };
          } else {
            finalRes = { hash: uniqueRef, ...mobileResponse?.meta?.authorization };
          }
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.MOBILE_MONEY,
          });
        }
        if (value.paymentType === paymentTypes.BANK_ACCOUNT) {
          const { paymentRes, uniqueRef } = await bankAccount(value, userData);
          console.log(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.BANK_ACCOUNT,
          });
        }
        if (value.paymentType === paymentTypes.QR_CODE) {
          const { paymentRes, uniqueRef } = await QRCode(value, userData);
          console.log(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = { hash: uniqueRef, ...paymentRes?.meta?.authorization };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.QR_CODE,
          });
        }
        if (value.paymentType === paymentTypes.WALLET) {
          const status = await userWallet(value, userData);

          await setRedisItem("customer-" + userData.ref, {
            ...items,
            mode: paymentTypes.WALLET,
            status: status ? "successful" : "failed",
            paid_amount: value.amount,
            paid_currency: value.currency,
            id: userData.ref,
          });

          finalRes = {
            status: status ? "successful" : "failed",
            txRef: "customer-" + userData.ref,
          };
        }

        if (
          value.paymentType === paymentTypes.GOOGLE_PAY ||
          value.paymentType === paymentTypes.APPLE_PAY
        ) {
          const { paymentRes, uniqueRef } = await googleApplePay(
            value,
            userData
          );
          console.log(
            "paymentRes=============>",
            paymentRes,
            uniqueRef,
            paymentRes.data?.meta
          );
          finalRes = {
            hash: uniqueRef,
            ...paymentRes.data?.meta?.authorization,
          };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: value.paymentType,
          });
        }
        if (value.paymentType === paymentTypes.CRYPTO) {
          // Normalize checkout currency aliases to internal wallet types
          // Checkout sends "USDC" but wallets are "USDC-ERC20", "RLUSD-XRPL" but wallets are "RLUSD"
          const cryptoAliasMap: Record<string, string> = {
            'USDC': 'USDC-ERC20',
            'RLUSD-XRPL': 'RLUSD',
          };
          if (cryptoAliasMap[value.currency]) {
            console.log(`[addPayment] Normalizing currency: ${value.currency} → ${cryptoAliasMap[value.currency]}`);
            value.currency = cryptoAliasMap[value.currency];
          }
          
          const { paymentRes, uniqueRef } = await Crypto(value, {
            ...userData,
            adm_id: items.adm_id,
            customer_id: items.customer_id,
            company_id: items.company_id,  // Pass company_id for proper wallet filtering
          }, true);  // Use crypto-specific webhook for proper verification
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          
          // Calculate remaining minutes for crypto invoice (uses centralized config)
          const CRYPTO_INVOICE_MINUTES = PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES;
          finalRes = { 
            hash: uniqueRef, 
            ...paymentRes,
            remaining_minutes: CRYPTO_INVOICE_MINUTES,  // Frontend uses this for invoice countdown timer
          };
          
          // Get fee_payer mode from original payment link data
          const fee_payer = items.fee_payer || 'company';
          const baseAmountRaw = Number(items.base_amount || items.amount || 0);
          const baseCurrency = items.base_currency || 'USD';
          
          // Convert base amount to USD if not already USD (e.g., EUR → USD)
          let baseAmountUSD = baseAmountRaw;
          if (baseCurrency !== 'USD') {
            try {
              const usdConversionResult = await currencyConvert({
                currency: ['USD'],
                sourceCurrency: baseCurrency,
                amount: baseAmountRaw,
                fixedDecimal: true,
              });
              baseAmountUSD = Number(usdConversionResult?.[0]?.amount || baseAmountRaw);
              console.log(`[addPayment] Converted ${baseAmountRaw} ${baseCurrency} → $${baseAmountUSD.toFixed(2)} USD`);
            } catch (convErr) {
              console.log(`[addPayment] Currency conversion failed (${baseCurrency}→USD), using raw amount:`, convErr);
            }
          }
          
          // Calculate fees using tier-based structure (2% + fixed + buffer)
          let merchant_amount_crypto = 0;
          let total_fees_crypto = 0;
          const crypto_amount = Number(value.amount);
          
          // Check if tax applies
          let taxAmount = 0;
          let taxAmountCrypto = 0;
          let taxInfo = null;
          
          if (items.apply_tax) {
            try {
              const clientIP = req.headers['x-forwarded-for']?.toString().split(',')[0] || req.ip || '';
              const geoLocation = await getCountryFromIP(clientIP, req.headers);
              if (geoLocation && geoLocation.country_code) {
                taxInfo = await calculateTaxForCheckout(geoLocation.country_code, baseAmountUSD, items.base_currency || 'USD');
                if (taxInfo) {
                  taxAmount = taxInfo.tax_amount || 0;
                  // Calculate tax portion in crypto
                  const totalWithTax = baseAmountUSD + taxAmount;
                  taxAmountCrypto = crypto_amount * (taxAmount / totalWithTax);
                }
              }
            } catch (e) {
              console.log('[addPayment] Tax calculation failed:', e);
            }
          }
          
          // Calculate fees using tier-based structure
          // Fee = 1.5% transaction fee + fixed fee (tier-based)
          try {
            const { totalDeduction, fixedFee, transactionFee } = await calculateTransactionFees(
              value.currency,
              baseAmountUSD  // Fee calculation based on USD amount
            );
            
            // Convert fee percentage to crypto
            const feePercentage = totalDeduction / baseAmountUSD;
            
            if (fee_payer === 'customer') {
              // Customer pays fees - fees are added on top, merchant gets full base + tax
              // crypto_amount already includes fees (customer paid more)
              const baseWithTax = baseAmountUSD + taxAmount;
              const baseCryptoRatio = baseWithTax / (baseWithTax + totalDeduction);
              merchant_amount_crypto = crypto_amount * baseCryptoRatio;
              total_fees_crypto = crypto_amount - merchant_amount_crypto;
            } else {
              // Company pays fees - fees deducted from received amount
              total_fees_crypto = crypto_amount * feePercentage;
              merchant_amount_crypto = crypto_amount - total_fees_crypto;
            }
            
            console.log(`[addPayment] Fee calculation:
              - Base USD: $${baseAmountUSD}
              - Fee breakdown: $${transactionFee.toFixed(2)} (pct) + $${fixedFee.toFixed(2)} (fixed)
              - Total fee: $${totalDeduction.toFixed(2)} (${(feePercentage * 100).toFixed(2)}%)
              - Fee payer: ${fee_payer}`);
          } catch (feeError) {
            console.error('[addPayment] Fee calculation error, using fallback:', feeError);
            // Fallback to simple 2% if tier calculation fails
            const fallbackFeePercent = parseFloat(process.env.TRANSACTION_FEE_PERCENT || '2.0') / 100;
            total_fees_crypto = crypto_amount * fallbackFeePercent;
            merchant_amount_crypto = crypto_amount - total_fees_crypto;
          }
          
          // Clear any existing data for this address before setting new payment data
          const cryptoRedisKey = getCryptoRedisKey(paymentRes.address, paymentRes.destination_tag);
          await deleteRedisItem(cryptoRedisKey);
          
          // FIX: Store crypto invoice expiry timestamp (15 minutes from now)
          // This is separate from payment link expiry - crypto invoice has shorter window
          const cryptoInvoiceExpiresAt = new Date(Date.now() + CRYPTO_INVOICE_MINUTES * 60 * 1000).toISOString();
          
          await setRedisItem(cryptoRedisKey, {
            mode: paymentTypes.CRYPTO,
            amount: crypto_amount,                    // Crypto amount customer should pay
            merchant_amount: merchant_amount_crypto,  // Amount merchant should receive
            total_fees: total_fees_crypto,            // Admin's portion
            fee_payer: fee_payer,                     // Who pays fees
            base_amount_usd: baseAmountUSD,           // Original USD amount
            total_amount_usd: baseAmountUSD + taxAmount, // Total USD with tax
            status: "pending",
            ref: uniqueRef,
            currency: value.currency,
            // FIX: Use payment link's transaction_id for linking, and user_tx_id for user transaction
            payment_id: items.transaction_id,         // Payment link's transaction_id (for updating payment link)
            unique_tx_id: items.transaction_id,       // Payment link's transaction_id
            user_tx_id: paymentRes.transaction_id,    // User transaction ID (for updating tbl_user_transaction)
            walletType: "customer",
            temp_id: paymentRes.temp_id,
            is_merchant_pool: paymentRes.is_merchant_pool ? "true" : "false",
            // XRP/RLUSD: Store destination tag for tag-based chains (needed for incomplete payment UI)
            ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
            // FIX: Store crypto invoice expiry for polling countdown
            crypto_invoice_expires_at: cryptoInvoiceExpiresAt,
            // BUGFIX: Store merchant webhook info directly in crypto-{address}
            // Ensures callMerchantWebhook finds the URL even if customer-{ref} is lost
            webhook_url: items?.webhook_url || null,
            callback_url: items?.callback_url || null,
            webhook_secret: items?.webhook_secret || null,
            company_id: items?.company_id || null,
            link_id: items?.link_id || null,
            // Tax tracking
            ...(taxInfo && {
              tax_enabled: "true",
              tax_amount_usd: taxAmount,
              tax_amount_crypto: taxAmountCrypto,
              tax_rate: taxInfo.tax_rate,
              tax_country_code: taxInfo.country_code,
            }),
          });
          
          console.log(`[addPayment] Crypto payment created:
            - Currency: ${value.currency}
            - Amount: ${crypto_amount}
            - Fee Payer: ${fee_payer}
            - Merchant Amount: ${merchant_amount_crypto}
            - Fees: ${total_fees_crypto}
            - Tax: ${taxAmount} USD (${taxAmountCrypto} crypto)`);
          
          // PHASE 12.1: Store active_crypto_address (including destination_tag) in customer session
          // This is CRITICAL for verifyCryptoPayment to resolve tag-based chains (XRP/RLUSD)
          // Without this, polling can't find the correct crypto-{addr}-tag-{tag} Redis key
          const customerSessionKey = "customer-" + userData.ref;
          const customerSessionData = await getRedisItem(customerSessionKey);
          if (customerSessionData && Object.keys(customerSessionData).length > 0) {
            const updatedSession = {
              ...customerSessionData,
              active_crypto_address: {
                currency: value.currency,
                address: paymentRes.address,
                payment_id: paymentRes.transaction_id,
                created_at: new Date().toISOString(),
                ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
              },
              // Also store destination_tag at top level for direct access
              ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
            };
            await setRedisItem(customerSessionKey, updatedSession);
            console.log(`[addPayment] Phase 12.1: Stored active_crypto_address in ${customerSessionKey}: ${paymentRes.address}${paymentRes.destination_tag ? `:${paymentRes.destination_tag}` : ''}`);
          }
        }
        successResponseHelper(res, 200, "Payment created successfully", finalRes);
      } else {
        throw { message: "Please enter valid data!" };
      }
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const createCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const DEBUG = process.env.DEBUG_MODE === 'true';
  if (DEBUG) console.log('[DEBUG] Step 1: JWT decoded successfully');
  
  try {
    const data: IFundData = req.body;
    if (DEBUG) console.log('[DEBUG] Step 2: Request body parsed:', { uniqueRef: data?.uniqueRef, currency: data?.currency });
    
    if (data) {
      let finalRes;
      
      // NORMALIZE: Ensure uniqueRef always uses "customer-" prefix for consistent Redis key lookups
      // Normal flow passes "customer-{ref}", Legacy API passes just "{transactionId}"
      const rawRef = data.uniqueRef;
      const normalizedRef = rawRef.startsWith("customer-") ? rawRef : "customer-" + rawRef;
      
      if (DEBUG) console.log('[DEBUG] Step 3: About to call getRedisItem with key:', normalizedRef);
      
      const items = await getRedisItem(normalizedRef);
      
      if (DEBUG) console.log('[DEBUG] Step 4: Redis item retrieved successfully:', { adm_id: items?.adm_id, company_id: items?.company_id });

      // ========================================
      // KYC ENFORCEMENT: Block payment processing if merchant's KYC required but not approved
      // Threshold: $10,000 USD with 90-day grace period
      // ========================================
      const merchantUserId = items?.adm_id;
      const merchantCompanyId = items?.company_id;
      
      if (merchantUserId) {
        // Calculate merchant's total transaction volume
        const merchantVolumeQuery = merchantCompanyId
          ? `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
             FROM tbl_customer_transaction 
             WHERE company_id = :companyId AND status = 'successful'`
          : `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
             FROM tbl_customer_transaction 
             WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) AND status = 'successful'`;
        
        const merchantVolumeResult = await sequelize.query<{ total_volume: string }>(
          merchantVolumeQuery,
          {
            replacements: { userId: merchantUserId, companyId: merchantCompanyId },
            type: QueryTypes.SELECT,
          }
        );
        
        const merchantTotalVolume = parseFloat(String(merchantVolumeResult[0]?.total_volume || "0"));
        const kycThreshold = 10000; // $10,000 USD threshold
        const kycGracePeriodDays = 90; // 90-day grace period
        
        if (merchantTotalVolume >= kycThreshold) {
          // Merchant KYC is required - check if it's approved
          const merchantKycWhereClause: Record<string, unknown> = {
            user_id: merchantUserId,
          };
          if (merchantCompanyId) {
            merchantKycWhereClause.company_id = merchantCompanyId;
          }
          
          const merchantKycRecord = await kycModel.findOne({
            where: merchantKycWhereClause,
            order: [["created_at", "DESC"]],
          });
          
          const merchantKycStatus = merchantKycRecord ? merchantKycRecord.get("status") as string : "not_started";
          
          if (merchantKycStatus !== "approved") {
            // Check 90-day grace period
            const thresholdReachedQuery = merchantCompanyId
              ? `SELECT MIN("createdAt") as threshold_date
                 FROM (
                   SELECT "createdAt", 
                          SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
                   FROM tbl_customer_transaction 
                   WHERE company_id = :companyId AND status = 'successful'
                 ) sub
                 WHERE running_total >= :threshold`
              : `SELECT MIN("createdAt") as threshold_date
                 FROM (
                   SELECT "createdAt", 
                          SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
                   FROM tbl_customer_transaction 
                   WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) AND status = 'successful'
                 ) sub
                 WHERE running_total >= :threshold`;
            
            const thresholdResult = await sequelize.query<{ threshold_date: string }>(
              thresholdReachedQuery,
              {
                replacements: { userId: merchantUserId, companyId: merchantCompanyId, threshold: kycThreshold },
                type: QueryTypes.SELECT,
              }
            );
            
            const thresholdDate = thresholdResult[0]?.threshold_date ? new Date(thresholdResult[0].threshold_date) : null;
            const now = new Date();
            
            if (thresholdDate) {
              const gracePeriodEnd = new Date(thresholdDate);
              gracePeriodEnd.setDate(gracePeriodEnd.getDate() + kycGracePeriodDays);
              
              if (now >= gracePeriodEnd) {
                // Grace period expired - block checkout
                console.log(`[KYC BLOCK - Checkout] Merchant ${merchantUserId} grace period expired. Volume: $${merchantTotalVolume.toFixed(2)}, KYC status: ${merchantKycStatus}`);
                
                return errorResponseHelper(
                  res,
                  503,
                  "This payment cannot be processed at this time. The merchant's account requires verification. Please contact the merchant for assistance. [MERCHANT_KYC_REQUIRED]"
                );
              } else {
                // Within grace period - allow but log
                const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                console.log(`[KYC GRACE - Checkout] Merchant ${merchantUserId} within grace period. Days remaining: ${daysRemaining}`);
              }
            }
          } else {
            console.log(`[KYC OK - Checkout] Merchant ${merchantUserId} KYC approved. Volume: $${merchantTotalVolume.toFixed(2)}`);
          }
        }
      }
      // ========================================
      // END KYC ENFORCEMENT
      // ========================================

      // Check if payment link has expired
      if (items.expires_at) {
        const expiresAt = new Date(items.expires_at);
        const now = new Date();
        if (expiresAt.getTime() <= now.getTime()) {
          console.log(`[Expiry Check] Payment link expired at ${items.expires_at}, current time: ${now.toISOString()}`);
          return errorResponseHelper(
            res,
            410,
            "This payment link has expired and can no longer be used for payments."
          );
        }
        console.log(`[Expiry Check] Payment link valid until ${items.expires_at}`);
      }

      // Phase 11: Validate requested currency is in available_currencies list
      let requestedCurrency = data.currency;
      
      // Normalize checkout currency aliases to internal wallet types
      // Checkout sends "USDC" but wallets are stored as "USDC-ERC20"
      // Checkout sends "RLUSD-XRPL" but wallets are stored as "RLUSD"
      const currencyAliasMap: Record<string, string> = {
        'USDC': 'USDC-ERC20',
        'RLUSD-XRPL': 'RLUSD',
      };
      const internalCurrency = currencyAliasMap[requestedCurrency] || requestedCurrency;
      
      // Parse available_currencies - could be array or comma-separated string from Redis
      let availableCurrenciesList: string[] = [];
      if (items.available_currencies) {
        if (Array.isArray(items.available_currencies)) {
          availableCurrenciesList = items.available_currencies;
        } else if (typeof items.available_currencies === 'string') {
          availableCurrenciesList = items.available_currencies.split(',').map((c: string) => c.trim());
        }
      }
      
      if (availableCurrenciesList.length > 0) {
        // Check both the original and internal currency names for validation
        if (!availableCurrenciesList.includes(requestedCurrency) && !availableCurrenciesList.includes(internalCurrency)) {
          console.log(`[Phase 11] Currency ${requestedCurrency} (internal: ${internalCurrency}) not in available list:`, availableCurrenciesList);
          return errorResponseHelper(
            res,
            400,
            `${requestedCurrency} is not available for this payment. Available currencies: ${availableCurrenciesList.join(', ')}`
          );
        }
        console.log(`[Phase 11] Currency ${requestedCurrency} (internal: ${internalCurrency}) validated against available list:`, availableCurrenciesList);
      }
      
      // Use internal currency name for wallet lookup and payment processing
      requestedCurrency = internalCurrency;

      // PHASE 12: Check for existing incomplete payment - prevent currency switching
      // This ensures customer completes partial payment on same currency before switching
      if (items.incomplete_payment) {
        const incompletePayment = items.incomplete_payment;
        const incompleteTimestamp = new Date(incompletePayment.timestamp);
        const gracePeriodMs = PAYMENT_TIMING.GRACE_PERIOD_MINUTES * 60 * 1000; // From centralized config
        const now = new Date();
        const graceExpiry = new Date(incompleteTimestamp.getTime() + gracePeriodMs);
        
        // Check if grace period has NOT expired
        if (now < graceExpiry) {
          const remainingMs = graceExpiry.getTime() - now.getTime();
          const remainingMinutes = Math.ceil(remainingMs / 60000);
          
          // If trying to switch to DIFFERENT currency - BLOCK
          if (incompletePayment.currency !== requestedCurrency) {
            console.log(`[Phase 12] ❌ Blocking currency switch: Incomplete ${incompletePayment.currency} payment exists, requested ${requestedCurrency}`);
            return errorResponseHelper(
              res,
              400,
              `You have an incomplete payment of ${incompletePayment.pending_amount} ${incompletePayment.currency}. ` +
              `Please complete it or wait for expiry (${remainingMinutes} minutes remaining) before switching currencies.`
            );
          }
          
          // If SAME currency - return existing address info (don't create new)
          console.log(`[Phase 12] ✓ Same currency requested, returning existing incomplete payment address`);
          return successResponseHelper(res, 200, "Continue existing payment", {
            address: incompletePayment.address,
            amount: incompletePayment.pending_amount,
            currency: incompletePayment.currency,
            qr_code: incompletePayment.qr_code,
            remaining_minutes: remainingMinutes,
            is_continuation: true,
            // XRP/RLUSD: Include destination tag for tag-based chains
            ...(incompletePayment.destination_tag && { destination_tag: Number(incompletePayment.destination_tag) }),
            message: `You have ${remainingMinutes} minutes to complete your payment of ${incompletePayment.pending_amount} ${incompletePayment.currency}`
          });
        } else {
          // Grace period expired - clear incomplete payment info and allow new payment
          console.log(`[Phase 12] Grace period expired for incomplete payment, clearing and allowing new payment`);
          const updatedItems = { ...items };
          delete updatedItems.incomplete_payment;
          await setRedisItem("customer-" + data.uniqueRef, updatedItems);
        }
      }

      // PHASE 12.1: Check if an address already exists for this payment link + currency combination
      // This prevents generating multiple addresses for the same payment link when customer refreshes page
      if (items.active_crypto_address && items.active_crypto_address.currency === requestedCurrency) {
        const existingAddress = items.active_crypto_address.address;
        const existingDestTag = items.active_crypto_address.destination_tag ? Number(items.active_crypto_address.destination_tag) : null;
        const existingRedisData = await getRedisItem(getCryptoRedisKey(existingAddress, existingDestTag));
        
        // Only return existing address if it's still pending (not completed/expired)
        if (existingRedisData && existingRedisData.status === 'pending') {
          console.log(`[Phase 12.1] ✓ Returning existing address for same payment link + currency: ${existingAddress}${existingDestTag ? ` (tag: ${existingDestTag})` : ''}`);
          return successResponseHelper(res, 200, "Using existing payment address", {
            qr_code: items.active_crypto_address.qr_code,
            address: existingAddress,
            // XRP/RLUSD: Include destination tag for tag-based chains
            ...(existingDestTag && { destination_tag: existingDestTag }),
            ...(existingDestTag && { memo: String(existingDestTag) }),
            transaction_id: existingRedisData.payment_id || existingRedisData.unique_tx_id,
            amount: existingRedisData.amount,
            currency: requestedCurrency,
            merchant_amount: existingRedisData.merchant_amount,
            fee_payer: existingRedisData.fee_payer,
            is_existing_address: true,
            message: `Payment address already generated. Send ${existingRedisData.amount} ${requestedCurrency} to complete payment.`
          });
        } else {
          // Address exists but status changed (completed/expired) - clear and generate new
          console.log(`[Phase 12.1] Existing address status changed, clearing active_crypto_address`);
          const updatedItems = { ...items };
          delete updatedItems.active_crypto_address;
          await setRedisItem("customer-" + data.uniqueRef, updatedItems);
        }
      } else if (items.active_crypto_address && items.active_crypto_address.currency !== requestedCurrency) {
        // User is switching to a DIFFERENT currency (allowed since no incomplete_payment)
        // Clear the old active_crypto_address since they're changing currency
        console.log(`[Phase 12.1] User switching from ${items.active_crypto_address.currency} to ${requestedCurrency}, clearing old active_crypto_address`);
        const updatedItemsForSwitch = { ...items };
        delete updatedItemsForSwitch.active_crypto_address;
        await setRedisItem("customer-" + data.uniqueRef, updatedItemsForSwitch);
      }

      // Phase 10 Task 10.3: Validate currency is configured using userWalletModel
      console.log(`[Phase 10 Validation] Checking wallet for currency: ${requestedCurrency}, user_id: ${items.adm_id}, company_id: ${items.company_id}`);
      
      // Parse user_id safely
      const userId = parseInt(items.adm_id);
      if (isNaN(userId)) {
        return errorResponseHelper(res, 400, "Invalid user ID");
      }
      
      const whereClause: Record<string, unknown> = {
        user_id: userId,
        wallet_type: requestedCurrency,
        wallet_address: { [Op.not]: null },
      };
      
      // Handle company_id: if provided and valid, add to query
      // MULTI-TENANT FIX: Require company_id for proper isolation when available
      let hasWallet;
      if (items.company_id && items.company_id !== '' && items.company_id !== 'undefined' && items.company_id !== 'null') {
        const companyId = parseInt(items.company_id);
        if (!isNaN(companyId)) {
          whereClause.company_id = companyId;
        }
        console.log('[Phase 10 Validation] Where clause (with company_id):', JSON.stringify(whereClause));
        hasWallet = await userWalletModel.findOne({ where: whereClause });
        
        // MULTI-TENANT FIX: If company_id is set but no wallet found, DO NOT fallback
        if (!hasWallet) {
          console.error(`[Phase 10 Validation] ❌ MULTI-TENANT: No wallet found for company_id ${whereClause.company_id}. NOT falling back.`);
          return errorResponseHelper(
            res,
            400,
            `No wallet address configured for ${requestedCurrency} in this company. Please add a ${requestedCurrency} wallet for this company first.`
          );
        }
      } else {
        // If company_id not provided, try to find wallet with null company_id first (legacy support)
        console.log('[Phase 10 Validation] No company_id provided, searching with null company_id');
        
        // First try with null company_id (legacy wallets)
        whereClause.company_id = null;
        console.log('[Phase 10 Validation] Where clause (null company_id):', JSON.stringify(whereClause));
        hasWallet = await userWalletModel.findOne({ where: whereClause });
        
        // If not found with null, get the FIRST company for this user and use its wallet
        if (!hasWallet) {
          console.log('[Phase 10 Validation] No null company_id wallet, finding user default company');
          // Parse adm_id to integer for proper SQL comparison
          const admIdInt = parseInt(String(items.adm_id), 10);
          if (isNaN(admIdInt)) {
            return errorResponseHelper(res, 400, "Invalid admin user ID");
          }
          const userCompany = await companyModel.findOne({
            where: { user_id: admIdInt },
            order: [['createdAt', 'ASC']]  // Get the first/oldest company
          });
          
          if (userCompany) {
            whereClause.company_id = userCompany.dataValues.company_id;
            console.log('[Phase 10 Validation] Using default company_id:', whereClause.company_id);
            hasWallet = await userWalletModel.findOne({ where: whereClause });
            
            if (hasWallet) {
              items.company_id = userCompany.dataValues.company_id;
              console.log('[Phase 10 Validation] Found wallet with default company_id:', items.company_id);
            }
          }
        }
      }
      
      console.log('[Phase 10 Validation] Wallet found:', hasWallet ? 'YES' : 'NO');

      if (!hasWallet) {
        return errorResponseHelper(
          res,
          400,
          `No wallet address configured for ${requestedCurrency}. Please add a ${requestedCurrency} wallet first.`
        );
      }

      const tokenData: Partial<IUserType> = {
        ref: data.uniqueRef,
        adm_id: items.adm_id,
        customer_id: items.customer_id,
        company_id: items.company_id || hasWallet.dataValues.company_id,  // Include company_id from Redis or wallet
      };
      const { paymentRes, uniqueRef } = await Crypto(data, tokenData as IUserType, true);
      
      // Determine fee_payer mode
      const fee_payer = items.fee_payer || 'company';
      
      // Get base amount in original currency (could be USD, AUD, EUR, etc.)
      const baseAmountOriginal = Number(items.base_amount || items.amount || 0);
      const baseCurrency = items.base_currency || 'USD';
      
      // Convert base amount to USD for fee tier calculation
      // Fee tiers are defined in USD, so we need accurate USD amount
      let baseAmountUSD = baseAmountOriginal;
      if (baseCurrency !== 'USD') {
        try {
          const usdConversion = await currencyConvert({
            sourceCurrency: baseCurrency,
            currency: ['USD'],
            amount: baseAmountOriginal,
            fixedDecimal: true,
          });
          baseAmountUSD = Number(usdConversion[0]?.amount || baseAmountOriginal);
          console.log(`[createCryptoPayment] Converted ${baseAmountOriginal} ${baseCurrency} → ${baseAmountUSD} USD for fee calculation`);
        } catch (conversionError) {
          console.warn(`[createCryptoPayment] USD conversion failed, using original amount:`, conversionError);
          // Fallback to original amount if conversion fails
        }
      }
      
      let taxAmount = 0;
      let taxAmountUSD = 0;  // Tax in USD for fee calculation
      
      // Define tax info type
      interface CryptoPaymentTaxInfo {
        tax_enabled: boolean;
        tax_rate: number;
        tax_acronym?: string;
        tax_amount: number;
        country_code?: string;
        country_name?: string;
        subtotal: number;
        total: number;
        currency?: string;
      }
      
      let taxInfo: CryptoPaymentTaxInfo | null = null;
      
      // TAX HANDLING: If apply_tax is enabled, calculate tax based on customer location
      if (items.apply_tax) {
        console.log(`[createCryptoPayment] Tax enabled, detecting customer location...`);
        
        // Get customer IP and detect country
        const clientIP = getClientIP(req);
        const geoLocation = await getCountryFromIP(clientIP, req.headers);
        
        if (geoLocation && geoLocation.country_code) {
          console.log(`[createCryptoPayment] Detected country: ${geoLocation.country_name} (${geoLocation.country_code})`);
          
          // Calculate tax using the same function as getData (in original currency)
          const calculatedTax = await calculateTaxForCheckout(
            geoLocation.country_code,
            baseAmountOriginal,
            baseCurrency
          );
          
          if (calculatedTax) {
            taxInfo = calculatedTax as CryptoPaymentTaxInfo;
          }
          
          if (taxInfo && taxInfo.tax_amount > 0) {
            taxAmount = taxInfo.tax_amount;  // Tax in original currency
            // Convert tax to USD for fee calculation if needed
            if (baseCurrency !== 'USD') {
              taxAmountUSD = taxAmount * (baseAmountUSD / baseAmountOriginal);
            } else {
              taxAmountUSD = taxAmount;
            }
            console.log(`[createCryptoPayment] Tax calculated: ${taxInfo.tax_rate}% ${taxInfo.tax_acronym} = ${taxAmount} ${baseCurrency} (${taxAmountUSD.toFixed(2)} USD)`);
            console.log(`[createCryptoPayment] Total with tax: ${taxInfo.total} ${baseCurrency}`);
          }
        } else {
          console.log(`[createCryptoPayment] Could not detect customer country, no tax applied`);
        }
      }
      
      // Total amount customer should pay in original currency (base + tax if applicable)
      const totalAmountWithTax = baseAmountOriginal + taxAmount;
      
      let crypto_amount = 0;           // What customer should pay (includes tax)
      let merchant_amount_crypto = 0;  // What merchant receives (base amount only, no tax)
      let total_fees_crypto = 0;       // Admin fees
      let tax_amount_crypto = 0;       // Tax in crypto (goes to merchant as collected tax)
      let exchange_rate = 0;
      
      try {
        // PERFORMANCE FIX: Use cached exchange rate if available
        // This avoids a redundant ~100-300ms external API call to FastForex
        const cachedRate = items?.cached_transfer_rate ? parseFloat(String(items.cached_transfer_rate)) : 0;
        const cachedCurrency = items?.cached_crypto_currency || null;
        const hasCachedRate = cachedRate > 0 && cachedCurrency === requestedCurrency && taxAmount === 0;
        console.log(`[createCryptoPayment] Cache debug: rate=${items?.cached_transfer_rate}, currency=${items?.cached_crypto_currency}, parsed=${cachedRate}, requested=${requestedCurrency}, tax=${taxAmount}, hasCached=${hasCachedRate}`);
        
        // Stablecoin shortcut: USD ↔ USDT/USDC is exactly 1:1 (no exchange rate variance)
        const normalizedCrypto = requestedCurrency.replace(/-.*$/, '').toUpperCase(); // USDT-TRC20 → USDT
        const isStablecoinPayment = ['USDT', 'USDC'].includes(normalizedCrypto) && baseCurrency === 'USD';
        
        let total_crypto_amount: number;
        if (isStablecoinPayment) {
          // Stablecoins are pegged 1:1 to USD — no rate conversion needed
          total_crypto_amount = totalAmountWithTax;
          exchange_rate = 1;
          console.log(`[createCryptoPayment] 💵 Stablecoin 1:1 peg: $${totalAmountWithTax} USD = ${total_crypto_amount} ${requestedCurrency} (exact)`);
        } else if (hasCachedRate) {
          // Use cached rate — same currency, no tax adjustment needed
          total_crypto_amount = totalAmountWithTax * cachedRate;
          exchange_rate = cachedRate;
          console.log(`[createCryptoPayment] Using cached exchange rate: 1 ${baseCurrency} = ${cachedRate} ${requestedCurrency} (saved ~200ms)`);
        } else {
          // Fresh conversion needed (different currency, tax involved, or no cache)
          const cryptoRates = await currencyConvert({
            sourceCurrency: baseCurrency,
            currency: [requestedCurrency],
            amount: totalAmountWithTax,
            fixedDecimal: false,
          });
          total_crypto_amount = parseFloat(cryptoRates[0]?.amount?.toString() || '0');
          exchange_rate = parseFloat(cryptoRates[0]?.transferRate?.toString() || '0');
        }
        
        // Calculate base crypto amount (without tax) for merchant amount calculation
        // Use ratio from original currency amounts
        const base_crypto_amount = taxAmount > 0 
          ? total_crypto_amount * (baseAmountOriginal / totalAmountWithTax)
          : total_crypto_amount;
        
        // Calculate tax amount in crypto
        tax_amount_crypto = taxAmount > 0 
          ? total_crypto_amount * (taxAmount / totalAmountWithTax)
          : 0;
        
        console.log(`[createCryptoPayment] Crypto amount calculated:
          - Base amount: ${baseAmountOriginal} ${baseCurrency} (${baseAmountUSD.toFixed(2)} USD)
          - Tax amount: ${taxAmount} ${baseCurrency}
          - Total with tax: ${totalAmountWithTax} ${baseCurrency}
          - Total crypto: ${total_crypto_amount} ${requestedCurrency}
          - Base crypto: ${base_crypto_amount} ${requestedCurrency}
          - Tax crypto: ${tax_amount_crypto} ${requestedCurrency}
          - Exchange rate: 1 ${baseCurrency} = ${exchange_rate} ${requestedCurrency}`);
        
        // Calculate fees using tier-based structure: 1.5% + fixed
        // IMPORTANT: Use USD amount for fee tier selection (tiers are defined in USD)
        const { totalDeduction, fixedFee, transactionFee } = await calculateTransactionFees(
          requestedCurrency,
          baseAmountUSD  // Fee calculation based on USD amount (ensures correct tier)
        );
        
        // Fee percentage for crypto conversion (based on USD fee / USD amount)
        const feePercentage = totalDeduction / baseAmountUSD;
        
        console.log(`[createCryptoPayment] Fee calculation (USD-based for tier accuracy):
          - Base original: ${baseAmountOriginal} ${baseCurrency}
          - Base USD: $${baseAmountUSD.toFixed(2)}
          - Fee breakdown: 1.5%=$${transactionFee.toFixed(2)} + Fixed=$${fixedFee.toFixed(2)}
          - Total fee: $${totalDeduction.toFixed(2)} (${(feePercentage * 100).toFixed(2)}% of base)`);
        
        // TAX HANDLING IN FEE CALCULATION:
        // - Admin fees are calculated on BASE amount only (not on tax)
        // - Tax goes entirely to merchant (they must remit to tax authority)
        // - Merchant receives: base_amount (after fees) + tax_amount
        
        if (fee_payer === 'customer') {
          // CUSTOMER PAYS FEES:
          // - Customer pays: base_amount + fees + tax
          // - Merchant receives: full base_amount + tax (what they requested + tax collected)
          // - Admin receives: fees only (swept from temp wallet)
          
          const merchant_base_crypto = base_crypto_amount;  // Merchant gets full base
          total_fees_crypto = base_crypto_amount * feePercentage;  // Calculate fees using tier-based percentage
          merchant_amount_crypto = merchant_base_crypto + tax_amount_crypto;  // Merchant gets base + tax
          crypto_amount = merchant_base_crypto + total_fees_crypto + tax_amount_crypto;  // Customer pays base + fees + tax
          
          console.log(`[createCryptoPayment] CUSTOMER PAYS FEES mode (with tax):
            - Customer pays: ${crypto_amount.toFixed(8)} ${requestedCurrency} (base + fees + tax)
            - Merchant receives: ${merchant_amount_crypto.toFixed(8)} ${requestedCurrency} (base + tax)
            - Admin fees: ${total_fees_crypto.toFixed(8)} ${requestedCurrency} (${(feePercentage * 100).toFixed(2)}% of base)
            - Tax collected: ${tax_amount_crypto.toFixed(8)} ${requestedCurrency} (included in merchant amount)`);
            
        } else {
          // COMPANY (MERCHANT) PAYS FEES:
          // - Customer pays: base_amount + tax
          // - Merchant receives: base_amount * (1 - fee_percent) + tax
          // - Admin receives: base_amount * fee_percent (swept from temp wallet)
          
          crypto_amount = total_crypto_amount;  // Customer pays base + tax
          const merchant_base_after_fees = base_crypto_amount * (1 - feePercentage);
          merchant_amount_crypto = merchant_base_after_fees + tax_amount_crypto;
          total_fees_crypto = base_crypto_amount * feePercentage;
          
          console.log(`[createCryptoPayment] COMPANY PAYS FEES mode (with tax):
            - Customer pays: ${crypto_amount.toFixed(8)} ${requestedCurrency} (base + tax)
            - Merchant receives: ${merchant_amount_crypto.toFixed(8)} ${requestedCurrency} (${((1 - feePercentage) * 100).toFixed(2)}% base + tax)
            - Admin fees: ${total_fees_crypto.toFixed(8)} ${requestedCurrency} (${(feePercentage * 100).toFixed(2)}% of base)
            - Tax collected: ${tax_amount_crypto.toFixed(8)} ${requestedCurrency} (included in merchant amount)`);
        }
      } catch (calcError) {
        console.error('[createCryptoPayment] Crypto/fee calculation error:', calcError);
        // Fallback to simple 2% if calculation fails
        crypto_amount = data.amount || 0;
        const fallbackFeePercent = parseFloat(process.env.TRANSACTION_FEE_PERCENT || '2.0') / 100;
        total_fees_crypto = crypto_amount * fallbackFeePercent;
        merchant_amount_crypto = crypto_amount - total_fees_crypto;
      }
      
      // Add crypto amount and rate to response
      // Calculate remaining minutes for crypto invoice (uses centralized config)
      const CRYPTO_INVOICE_MINUTES = PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES;
      finalRes = { 
        hash: uniqueRef, 
        ...paymentRes,
        amount: crypto_amount,
        merchant_amount: merchant_amount_crypto,
        fees: total_fees_crypto,
        fee_payer: fee_payer,
        base_amount: baseAmountOriginal,          // Original amount in merchant's currency
        base_amount_usd: baseAmountUSD,           // Converted to USD (for reference)
        base_currency: baseCurrency,
        rate: exchange_rate,
        remaining_minutes: CRYPTO_INVOICE_MINUTES,  // Frontend uses this for invoice countdown timer
        // Tax info (if applicable)
        ...(taxInfo && {
          tax_info: {
            tax_amount: taxAmount,                // Tax in original currency
            tax_amount_usd: taxAmountUSD,         // Tax in USD
            tax_amount_crypto: tax_amount_crypto,
            tax_rate: taxInfo.tax_rate,
            tax_acronym: taxInfo.tax_acronym,
            country_code: taxInfo.country_code,
          }
        }),
      };

      console.log("paymentRes=============>", paymentRes, uniqueRef, {
        mode: paymentTypes.CRYPTO,
        amount: crypto_amount,
        merchant_amount: merchant_amount_crypto,
        fees: total_fees_crypto,
        status: "pending",
        ref: uniqueRef,
        currency: data.currency,
        walletType: "customer",
        fee_payer,
        // Tax info for logging
        ...(taxInfo && { tax_enabled: true, tax_amount: taxAmount }),
      });

      // Clear any existing data for this address before setting new payment data
      // This is important when an address is reused for a new payment
      const directCryptoRedisKey = getCryptoRedisKey(paymentRes.address, paymentRes.destination_tag);
      await deleteRedisItem(directCryptoRedisKey);
      
      // FIX: Store crypto invoice expiry timestamp (15 minutes from now)
      // This is separate from payment link expiry - crypto invoice has shorter window
      const cryptoInvoiceExpiresAt = new Date(Date.now() + CRYPTO_INVOICE_MINUTES * 60 * 1000).toISOString();
      
      await setRedisItem(directCryptoRedisKey, {
        mode: paymentTypes.CRYPTO,
        amount: crypto_amount,                  // Crypto amount customer should pay (includes tax)
        merchant_amount: merchant_amount_crypto, // Amount merchant should receive (includes tax)
        total_fees: total_fees_crypto,          // Total fees (admin's portion - from base only)
        fee_payer: fee_payer,                   // Who pays fees
        // Store both original and USD amounts for accurate fee calculations
        base_amount_original: baseAmountOriginal,  // Original amount in merchant's currency
        base_currency: baseCurrency,              // Merchant's currency (e.g., AUD)
        base_amount_usd: baseAmountUSD,           // Converted USD amount (for fee tier)
        total_amount_original: totalAmountWithTax, // Total in original currency (with tax)
        total_amount_usd: baseAmountUSD + (taxAmountUSD || 0),  // Total USD amount (with tax if applicable)
        status: "pending",
        ref: uniqueRef,
        currency: data.currency,
        payment_id: paymentRes.transaction_id,  // Internal payment ID (NOT blockchain txId)
        unique_tx_id: paymentRes.transaction_id,  // Alias for backward compatibility with cryptoVerification
        walletType: "customer",
        temp_id: paymentRes.temp_id,
        is_merchant_pool: paymentRes.is_merchant_pool ? "true" : "false",  // CRITICAL: Include merchant pool flag
        // XRP/RLUSD: Store destination tag for tag-based chains (needed for incomplete payment UI)
        ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
        // FIX: Store crypto invoice expiry for polling countdown
        crypto_invoice_expires_at: cryptoInvoiceExpiresAt,
        // BUGFIX: Store merchant webhook info directly in crypto-{address}
        // Previously only stored in customer-{ref}, which made webhook delivery fragile.
        // If customer-{ref} was lost (Redis eviction, DB reconstruction fallback),
        // callMerchantWebhook would find NO webhook URL and silently skip notification.
        webhook_url: items?.webhook_url || null,
        callback_url: items?.callback_url || null,
        webhook_secret: items?.webhook_secret || null,
        company_id: items?.company_id || null,
        link_id: items?.link_id || null,
        // Tax tracking
        ...(taxInfo && {
          tax_enabled: "true",
          tax_amount_original: taxAmount,       // Tax in original currency
          tax_amount_usd: taxAmountUSD,         // Tax in USD
          tax_amount_crypto: tax_amount_crypto,
          tax_rate: taxInfo.tax_rate,
          tax_country_code: taxInfo.country_code,
        }),
      });

      // PHASE 12.1: Store active crypto address in customer Redis key
      // This prevents generating multiple addresses for the same payment link when customer refreshes
      // Note: uniqueRef already has "customer-" prefix, so use it directly
      const customerRedisData = await getRedisItem(uniqueRef);
      if (customerRedisData) {
        const updatedCustomerData = {
          ...customerRedisData,
          active_crypto_address: {
            currency: data.currency,
            address: paymentRes.address,
            qr_code: paymentRes.qr_code,
            payment_id: paymentRes.transaction_id,
            created_at: new Date().toISOString(),
            // XRP/RLUSD: Store destination tag for tag-based chains
            ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
          },
          // Also store destination_tag at top level for direct access by verifyCryptoPayment
          ...(paymentRes.destination_tag && { destination_tag: paymentRes.destination_tag }),
        };
        await setRedisItem(uniqueRef, updatedCustomerData);
        console.log(`[Phase 12.1] Stored active_crypto_address for ${uniqueRef}: ${paymentRes.address}${paymentRes.destination_tag ? `:${paymentRes.destination_tag}` : ''}`);
      }

      // Also update the temp address record in database for partial payment handling
      // Note: Only update if NOT a merchant pool address (userTempAddressModel is for legacy addresses)
      if (!paymentRes.is_merchant_pool) {
        await userTempAddressModel.update(
          {
            fee_payer: fee_payer,
            merchant_amount: merchant_amount_crypto,
            base_amount_usd: baseAmountUSD,
          },
          { where: { temp_id: paymentRes.temp_id } }
        );
      }

      successResponseHelper(res, 200, "Payment created successfully", finalRes);
    } else {
      throw { message: "Please enter valid currency!" };
    }
  } catch (e) {
    console.log("####e", e);
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const authStep = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { data } = req.body;
    const value: IFundData = JSON.parse(decrypt(data));
    if (typeof value === "object") {
      let finalRes;
      if (value.paymentType === paymentTypes.CARD) {
        const tempData = await getRedisItem("customer-" + userData.ref);

        console.log(value.uniqueRef);
        if (value.mode === "otp") {
          const flw_ref = tempData?.flw_ref;
          const res = await flw.Charge.validate({
            otp: value.otp,
            flw_ref,
          });

          console.log(res);
          const transactionId = res.data.id;
          const { data }: IVerifyResponse = await flw.Transaction.verify({
            id: transactionId,
          });
          finalRes = {
            id: data.id,
            flwRef: data.flw_ref,
            status: data.status,
          };
        } else {
          const cardData: IFundData = JSON.parse(decrypt(tempData?.hash));
          const { paymentRes, uniqueRef } = await cardPayment(
            { ...value, ...cardData },
            userData,
            true
          );
          console.log(paymentRes);
          if (
            paymentRes.status !== "error" &&
            paymentRes.data?.status !== "successful"
          ) {
            finalRes = { ...paymentRes.meta.authorization, hash: uniqueRef };

            if (paymentRes.meta.authorization.mode !== "redirect") {
              await setRedisItem(uniqueRef, {
                flw_ref: paymentRes.data.flw_ref,
                ...tempData,
              });
            } else {
              await setRedisItem(uniqueRef, {
                id: paymentRes.data.id,
                ...tempData,
              });
            }
          } else if (paymentRes.data?.status === "successful") {
            finalRes = {
              flwRef: paymentRes.data.flw_ref,
              txRef: uniqueRef,
            };
          } else {
            finalRes = { ...paymentRes, txRef: uniqueRef };
          }
        }
      }

      successResponseHelper(res, 200, "Payment authenticated successfully", finalRes);
    } else {
      throw { message: "Please enter valid data!" };
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const verifyPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem(uniqueRef);

    let finalRes;
    console.log(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      const { data }: IVerifyResponse = await flw.Transaction.verify({
        id: transactionId,
      });
      console.log(data);
      finalRes = {
        txRef: uniqueRef,
      };
      successResponseHelper(res, 200, "Payment verified successfully", finalRes);
    } else {
      errorResponseHelper(res, 500, "Transaction still in progress!");
    }
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const confirmPayment = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  const transaction = await sequelize.transaction();
  try {
    const { uniqueRef } = req.body;

    const tempData = await getRedisItem(uniqueRef);

    console.log(tempData, uniqueRef);
    const transactionId = tempData?.id;
    if (transactionId) {
      if (tempData?.pathType === "createLink") {
        const { data }: IVerifyResponse = await flw.Transaction.verify({
          id: transactionId,
        });
        console.log(data);

        const linkData = (
          await paymentLinkModel.findOne({
            where: { transaction_id: tempData?.transaction_id },
          })
        ).dataValues;

        // Multi-tenant fix: Include company_id in wallet lookup
        const walletWhereClause: Record<string, unknown> = {
          user_id: Number(linkData.user_id),
          wallet_type: data.currency,
        };
        
        // Add company_id filter if present
        if (linkData.company_id && linkData.company_id !== '' && linkData.company_id !== 'undefined' && linkData.company_id !== 'null') {
          const companyId = parseInt(linkData.company_id);
          if (!isNaN(companyId)) {
            walletWhereClause.company_id = companyId;
          }
        } else {
          walletWhereClause.company_id = null;
        }
        
        const walletData = await userWalletModel.findOne({
          where: walletWhereClause,
          transaction,
        });

        const transaction_fee = await getTransactionFee();
        const blockchain_fee = await getBlockchainFee();
        const platformCharge = (data.amount * Number(transaction_fee)) / 100;
        const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

        await adminWalletModel.increment("fee", {
          by: platformCharge + blockchainCharge,
          where: { wallet_type: data.currency },
        });

        // Send admin fee notification email for card payments
        try {
          const adminEmail = process.env.ADMIN_EMAIL;
          const totalFee = platformCharge + blockchainCharge;
          if (adminEmail && totalFee > 0) {
            const merchantAmount = data.amount_settled - platformCharge - blockchainCharge;
            await sendAdminFeeReceivedEmail(
              adminEmail,
              "Dynopay Admin",
              totalFee.toFixed(2),
              data.currency,
              (data as { transaction_id?: string }).transaction_id || String(data.id),
              linkData?.company_name || "Unknown Company",
              merchantAmount.toFixed(2),
              data.amount_settled.toFixed(2)
            );
            
            console.log(`[Admin Fee Notification - Card] Sent email for ${totalFee} ${data.currency} from Company ${linkData?.company_id || 'N/A'}`);
          }
        } catch (emailError) {
          console.error("[Admin Fee Notification - Card] Email failed:", emailError);
        }

        await userWalletModel.update(
          {
            amount: Number(
              walletData.dataValues.amount +
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
          },
          {
            where: {
              wallet_id: walletData.dataValues.wallet_id,
            },
            transaction,
          }
        );

        await paymentLinkModel.update(
          {
            paid_currency: data.currency,
            paid_amount: data.amount,
            status: data.status,
            wallet_id: walletData.dataValues.wallet_id,
            transaction_reference: data.flw_ref,
            payment_mode: tempData.mode,
          },
          {
            where: {
              transaction_id: tempData?.transaction_id,
            },
          }
        );

        // Increment times_used counter
        await paymentLinkModel.increment('times_used', {
          by: 1,
          where: {
            transaction_id: tempData?.transaction_id,
          },
        });

        transaction.commit();
        
        // Use stored redirect_url or callback_url if available
        const returnData = {
          transaction_reference: data.flw_ref,
          status: data.status,
          redirect: false,
          ...(linkData.redirect_url && { redirect_url: linkData.redirect_url }),
          ...(linkData.callback_url && { callback_url: linkData.callback_url }),
        };
        
        // Call webhook if webhook_url is configured
        if (linkData.webhook_url) {
          // Validate webhook URL - localhost URLs won't work from cloud server
          if (linkData.webhook_url.includes('localhost') || linkData.webhook_url.includes('127.0.0.1')) {
            webhookLogs.error("Payment link webhook uses localhost URL which is unreachable", { 
              webhook_url: linkData.webhook_url,
              suggestion: "Use a public URL for webhooks"
            });
          } else {
            try {
              await axios.post(linkData.webhook_url, returnData, { timeout: 30000 });
              webhookLogs.log("info", "Payment link webhook sent successfully!", {
                webhook_url: linkData.webhook_url,
                ...returnData,
              });
            } catch (webhookError) {
              const errorMsg = webhookError.code === 'ECONNREFUSED' 
                ? `Connection refused - server at ${linkData.webhook_url} is not reachable`
                : webhookError.message;
              webhookLogs.error("Payment link webhook failed", { 
                webhook_url: linkData.webhook_url,
                error: errorMsg
              });
            }
          }
        }
        
        // FIXED: Use soft delete with TTL for checkout status polling
        await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS); // Grace period TTL
        successResponseHelper(res, 200, "Payment confirmed successfully", returnData);
      } else {
        const company_data = (
          await companyModel.findOne({
            where: { company_id: tempData.company_id },
          })
        ).dataValues;

        let product_name;

        if (tempData?.meta_data) {
          const meta_data = JSON.parse(tempData?.meta_data);
          product_name = meta_data?.product_name ?? meta_data?.product;
        }

        if (tempData.mode !== paymentTypes.WALLET) {
          const { data }: IVerifyResponse = await flw.Transaction.verify({
            id: transactionId,
          });
          console.log(data);

          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: data.amount.toFixed(2),
            paid_currency: data.currency,
            transaction_reference: data.flw_ref,
            transaction_type: tempData?.pathType?.includes("addFund")
              ? "CREDIT"
              : "PAYMENT",
            ...(!tempData?.pathType?.includes("addFund") && {
              transaction_details: product_name
                ? "Made payment for " +
                product_name +
                " on " +
                company_data?.company_name
                : "Made payment for " +
                (company_data?.company_name || "Company") +
                " product",
            }),
            status: data.status,
          };

          // Multi-tenant fix: Include company_id in wallet lookup
          const createPaymentWalletWhere: Record<string, unknown> = {
            user_id: Number(tempData.adm_id),
            wallet_type: data.currency,
          };
          
          // Add company_id filter if present
          if (tempData.company_id && tempData.company_id !== '' && tempData.company_id !== 'undefined' && tempData.company_id !== 'null') {
            const companyId = parseInt(tempData.company_id);
            if (!isNaN(companyId)) {
              createPaymentWalletWhere.company_id = companyId;
            }
          } else {
            createPaymentWalletWhere.company_id = null;
          }
          
          const walletData = await userWalletModel.findOne({
            where: createPaymentWalletWhere,
            transaction,
          });

          const transaction_fee = await getTransactionFee();
          const blockchain_fee = await getBlockchainFee();
          const platformCharge = (data.amount * Number(transaction_fee)) / 100;
          const blockchainCharge = (data.amount * Number(blockchain_fee)) / 100;

          await adminWalletModel.increment("fee", {
            by: platformCharge + blockchainCharge,
            where: { wallet_type: data.currency },
          });

          // Send admin fee notification email for create payment
          try {
            const adminEmail = process.env.ADMIN_EMAIL;
            const totalFee = platformCharge + blockchainCharge;
            if (adminEmail && totalFee > 0) {
              const merchantAmount = data.amount_settled - platformCharge - blockchainCharge;
              const companyData = await companyModel.findOne({
                where: { company_id: tempData.company_id },
              });
              
              await sendAdminFeeReceivedEmail(
                adminEmail,
                "Dynopay Admin",
                totalFee.toFixed(2),
                data.currency,
                (data as { transaction_id?: string }).transaction_id || String(data.id),
                companyData?.dataValues?.company_name || "Unknown Company",
                merchantAmount.toFixed(2),
                data.amount_settled.toFixed(2)
              );
              
              console.log(`[Admin Fee Notification - CreatePayment] Sent email for ${totalFee} ${data.currency} from Company ${tempData.company_id || 'N/A'}`);
            }
          } catch (emailError) {
            console.error("[Admin Fee Notification - CreatePayment] Email failed:", emailError);
          }

          const customerWalletData = await customerWalletModel.findOne({
            where: {
              customer_id: Number(tempData.customer_id),
            },
          });

          await userWalletModel.update(
            {
              amount: Number(
                walletData.dataValues.amount +
                data.amount_settled -
                platformCharge -
                blockchainCharge
              ).toFixed(2),
            },
            {
              where: {
                wallet_id: walletData.dataValues.wallet_id,
              },
              transaction,
            }
          );

          const userPayload = {
            id: uniqueRef,
            wallet_id: walletData.dataValues.wallet_id,
            user_id: walletData.dataValues.user_id,
            payment_mode: tempData.mode,
            base_amount: (
              data.amount_settled -
              platformCharge -
              blockchainCharge
            ).toFixed(2),
            base_currency: data.currency,
            transaction_reference: data.flw_ref,
            transaction_type: "CREDIT",
            status: data.status,
            customer_id: Number(tempData.customer_id),
            company_id: tempData.company_id || null,  // Include company_id from Redis
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );
          await userTransactionModel.create(
            { ...userPayload },
            { transaction }
          );
          if (tempData?.pathType?.includes("addFund")) {
            await customerWalletModel.update(
              {
                amount: Number(
                  customerWalletData.dataValues.amount + Number(tempData.amount)
                ).toFixed(2),
              },
              {
                where: {
                  customer_id: Number(tempData.customer_id),
                },
                transaction,
              }
            );
          }
          transaction.commit();

          // Auto-generate invoice for completed transaction
          if (tempData.company_id && userPayload.id) {
            autoGenerateInvoice(
              Number(userPayload.id),
              Number(tempData.company_id)
            ).catch(err => {
              console.error("Failed to generate invoice:", err);
            });
          }

          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          // FIXED: Use soft delete with TTL for checkout status polling
          await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        } else {
          const customerPayload = {
            id: crypto.randomUUID(),
            company_id: Number(tempData.company_id),
            customer_id: Number(tempData.customer_id),
            payment_mode: tempData.mode,
            base_amount: Number(tempData.amount).toFixed(2),
            base_currency: tempData.base_currency,
            paid_amount: Number(tempData.paid_amount).toFixed(2),
            paid_currency: tempData.paid_currency,
            transaction_reference: tempData.id,
            transaction_type: "DEBIT",
            transaction_details: product_name
              ? "Made payment for " +
              product_name +
              " on " +
              company_data?.company_name
              : "Made payment for " +
              (company_data?.company_name || "Company") +
              " product",

            status: tempData.status,
          };

          await customerTransactionModel.create(
            { ...customerPayload },
            { transaction }
          );

          transaction.commit();
          const redirect_uri =
            tempData.redirect_uri +
            `?transaction_id=${customerPayload.id}&status=${customerPayload.status
            }&meta_data=${tempData?.meta_data ?? null}&payment_type=${tempData.mode
            }`;

          const returnData = {
            transaction_id: customerPayload.id,
            status: customerPayload.status,
            redirect: true,
            redirect_uri,
          };
          // FIXED: Use soft delete with TTL for checkout status polling
          await softDeleteRedisItem(uniqueRef, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
          successResponseHelper(
            res,
            200,
            "transaction successful!",
            returnData
          );
        }
      }
    } else {
      transaction.rollback();
      errorResponseHelper(
        res,
        500,
        "Transaction Not found! Please contact support"
      );
    }
  } catch (e) {
    const message = getErrorMessage(e);
    transaction.rollback();
    apiLogger.error(
      message,
      { customer_id: userData.customer_id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, message);
  }
};

const cardPayment = async (
  data: IFundData,
  tokenData: IUserType,
  revalidate = false
) => {
  const expiry = data.expiry.split("/");
  const uniqueRef = "customer-" + tokenData.ref;
  console.log("from card=============>", data);
  const payload = {
    card_number: data.number,
    expiry_month: expiry[0],
    expiry_year: expiry[1],
    cvv: data.cvc,
    currency: data.currency ?? "USD",
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
    enckey: process.env.FLW_ENCRYPTION_KEY,
    ...(revalidate && {
      authorization: {
        mode: data.mode,
        ...(data.mode === "pin"
          ? { pin: data.pin }
          : {
            city: data.city,
            address: data.address,
            state: data.state,
            country: "IN",
            zipcode: data.zipcode,
          }),
      },
    }),
    redirect_url: (process.env.CHECKOUT_URL || '').trim() + "/pay/verify",
  };

  console.log("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.card(payload);

  return { paymentRes, uniqueRef };
};

const bankTransfer = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  const paymentRes: FW_API_Response = await flw.Charge.bank_transfer(payload);

  return { paymentRes, uniqueRef };
};

const bankAccount = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  let paymentRes: FW_API_Response;

  if (payload.currency === "NGN") {
    paymentRes = await flw.Charge.ng(payload);
  } else {
    try {
      paymentRes = await axios.post(
        "https://api.flutterwave.com/v3/charges?type=account-ach-uk",
        {
          ...payload,
          is_token_io: 1,
        },
        {
          headers: {
            Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
          },
        }
      );
    } catch (e) {
      console.log(e);
    }
  }

  return { paymentRes, uniqueRef };
};

const googleApplePay = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef + "_success_mock",
  };

  console.log("payload==========>", payload);

  const type =
    data.paymentType === paymentTypes.GOOGLE_PAY ? "googlepay" : "applepay";

  const response = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=" + type,
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
      },
    }
  );
  const paymentRes = response.data;

  return { paymentRes, uniqueRef };
};

const USSD = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: "NGN",
    account_bank: data.account_number,
    amount: data.amount,
    email: tokenData.email,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
  };

  console.log("payload==========>", payload);

  const paymentRes = await flw.Charge.ussd(payload);

  return { paymentRes, uniqueRef };
};

const MobileMoney = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: data.currency,
    amount: data.amount,
    ...((data.currency === "UGX" || data.currency === "GHS") && {
      network: data.network,
    }),
    ...(data.currency === "RWF" && {
      order_id: uniqueRef,
    }),
    email: tokenData.email,
    phone_number: data?.mobile,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
    ...(data.currency !== "KES" && {
      redirect_url: (process.env.CHECKOUT_URL || '').trim() + "/pay/verify",
    }),
  };

  console.log("payload==========>", payload);
  let paymentRes;
  if (data.currency === "KES")
    paymentRes = await flw.MobileMoney.mpesa(payload);
  else if (data.currency === "GHS")
    paymentRes = await flw.MobileMoney.ghana(payload);
  else if (data.currency === "UGX")
    paymentRes = await flw.MobileMoney.uganda(payload);
  else if (data.currency === "RWF")
    paymentRes = await flw.MobileMoney.rwanda(payload);

  return { paymentRes, uniqueRef };
};

const QRCode = async (data: IFundData, tokenData: IUserType) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const payload = {
    currency: "NGN",
    amount: data.amount,
    email: tokenData.email,
    phone_number: tokenData?.mobile,
    fullname: tokenData?.customer_name,
    tx_ref: uniqueRef,
    is_nqr: "1",
  };

  console.log("payload==========>", payload);

  const resData = await axios.post(
    "https://api.flutterwave.com/v3/charges?type=qr",
    {
      ...payload,
    },
    {
      headers: {
        Authorization: "Bearer " + process.env.FLW_SECRET_KEY,
      },
    }
  );

  const paymentRes = resData.data;

  return { paymentRes, uniqueRef };
};

const Crypto = async (
  data: IFundData,
  tokenData: IUserType,
  onlyCrypto = false
) => {
  const uniqueRef = "customer-" + tokenData.ref;
  const currency = data.currency;
  const userId = tokenData.adm_id;
  const companyId = tokenData.company_id;
  
  // Supported merchant pool crypto types
  const MERCHANT_POOL_CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
  
  // Use merchant pool for supported currencies
  if (MERCHANT_POOL_CRYPTO_TYPES.includes(currency)) {
    console.log(`[Crypto] Using MERCHANT POOL for ${currency} payment`);
    console.log(`[Crypto]   - Merchant (user_id): ${userId}`);
    console.log(`[Crypto]   - Company: ${companyId}`);
    
    // Validate IDs
    if (!userId || isNaN(Number(userId))) {
      throw { message: "Invalid user ID for payment" };
    }
    
    // Validate and parse company_id - it can be null but not NaN
    const parsedCompanyId = companyId ? parseInt(String(companyId)) : null;
    if (companyId && isNaN(parsedCompanyId as number)) {
      throw { message: "Invalid company ID for payment" };
    }
    
    // Generate unique payment ID
    const paymentId = crypto.randomUUID();
    
    // Reserve address from merchant's pool
    // This will:
    // 1. Create merchant's xpub if not exists (lazy initialization)
    // 2. Initialize pool if empty
    // 3. Find available address with highest admin_fee_balance
    // 4. Reserve it for this payment
    const poolAddressResult = await merchantPoolService.reserveAddress(
      currency,
      paymentId,
      Number(userId),
      parsedCompanyId || 0,  // Pass 0 if no company_id (will be treated as null in DB)
      Number(data.amount) || 0
    );
    const poolAddress = poolAddressResult as { dataValues: { wallet_address: string; temp_address_id: number; destination_tag?: number } };
    
    const address = poolAddress.dataValues.wallet_address;
    const destinationTag = poolAddress.dataValues.destination_tag || null;
    console.log(`[Crypto] ✅ Reserved merchant pool address: ${address}${destinationTag ? ` (tag: ${destinationTag})` : ''}`);
    
    // Generate QR code — for tag-based chains, include the destination tag in the QR
    let qr_code;
    if (address) {
      // For XRP/RLUSD: Include destination tag in QR payload for wallet compatibility
      const qrPayload = destinationTag ? `${address}?dt=${destinationTag}` : address;
      const url = await QR_Code.toDataURL(qrPayload, { width: 300 });
      qr_code = url;
    }
    
    // Create transaction record — use merchant's own wallet (FK references tbl_user_wallet)
    const merchantWalletLookup: Record<string, unknown> = {
      user_id: Number(userId),
      wallet_type: currency,
    };
    if (companyId && !isNaN(Number(companyId))) {
      merchantWalletLookup.company_id = Number(companyId);
    }
    const walletDetails = await userWalletModel.findOne({
      where: merchantWalletLookup,
    });
    
    const walletId = walletDetails?.dataValues.wallet_id;
    
    const userPayload = {
      id: paymentId,
      wallet_id: walletId ? Number(walletId) : null,
      user_id: Number(userId),
      payment_mode: "CRYPTO",
      base_amount: isNaN(Number(data.amount)) ? 0 : Number(data.amount),
      base_currency: currency,
      transaction_type: "CREDIT",
      status: "pending",
      customer_id: (tokenData.customer_id && !isNaN(Number(tokenData.customer_id))) ? Number(tokenData.customer_id) : null,
      company_id: (companyId && !isNaN(Number(companyId))) ? Number(companyId) : null,
    };
    console.log("[Crypto] Merchant pool userPayload:", JSON.stringify(userPayload));
    
    await userTransactionModel.create({ ...userPayload });
    
    const paymentRes = {
      qr_code,
      address: address,
      destination_tag: destinationTag,
      // XRP/RLUSD: Return memo field (string form of destination_tag) for checkout display
      ...(destinationTag && { memo: String(destinationTag) }),
      transaction_id: paymentId,
      temp_id: poolAddress.dataValues.temp_address_id,
      is_merchant_pool: true,  // Flag to identify merchant pool address
    };
    
    return { paymentRes, uniqueRef };
  }
  
  // Fallback: Use legacy admin wallet system for unsupported currencies
  console.log(`[Crypto] Using LEGACY admin wallet for ${currency} payment`);
  
  const adminWallet = await adminWalletModel.findOne({
    where: {
      wallet_type: currency,
    },
  });
  
  if (!adminWallet) {
    throw { message: `No wallet configured for ${currency}. Please contact the merchant.` };
  }
  
  const walletDetails = adminWallet.dataValues;

  if (Object.keys(walletDetails).length > 0) {
    const decrytedData = await tatumApi.decryptSymmetric(
      walletDetails.xpub_mnemonic,
      process.env.XPUB_KEY_ID
    );
    const walletData = JSON.parse(decrytedData);

    const userXPub = walletData.xpub;
    const userMnemonic = walletData.mnemonic;
    // Fix: Handle null/undefined/NaN last_index values
    const currentIndex = walletDetails.last_index;
    let latestIndex = (currentIndex === null || currentIndex === undefined || isNaN(Number(currentIndex))) 
      ? 1 
      : Number(currentIndex) + 1;
    
    // Extra safeguard: ensure latestIndex is a valid integer
    if (isNaN(latestIndex) || !Number.isFinite(latestIndex)) {
      latestIndex = 1;
    }

    let { address, privateKey } = await tatumApi.generateUserAddress({
      currency,
      xpub: userXPub,
      index: latestIndex,
      mnemonic: userMnemonic,
    });

    if (currency === "BCH") {
      address = address.split(":")[1];
      console.log(address);
    }

    console.log("address: ", address);

    // Try to create subscription, but don't fail if Tatum API has issues
    let id = null;
    try {
      const subscription = await tatumApi.createSubscription(
        address,
        walletDetails.wallet_type,
        onlyCrypto
      );
      id = subscription.id;
      console.log("Tatum subscription created:", id);
    } catch (subscriptionError) {
      console.log("⚠️ Tatum subscription failed (using local monitoring):", subscriptionError.message);
      id = `local-${Date.now()}`; // Use local subscription ID as fallback
    }

    const cipherText = await tatumApi.encryptSymmetric(
      privateKey,
      process.env.TEMP_KEY_ID
    );

    // Validate IDs before creating temp address
    const tempUserId = tokenData.adm_id;
    const tempCompanyId = tokenData.company_id;
    
    if (!tempUserId || isNaN(Number(tempUserId))) {
      throw { message: "Invalid user ID for payment" };
    }

    const tempPayload = {
      user_id: Number(tempUserId),
      company_id: (tempCompanyId && !isNaN(Number(tempCompanyId))) ? Number(tempCompanyId) : null,
      wallet_type: walletDetails.wallet_type,
      wallet_address: address,
      subscription_id: id,
      privateKey: cipherText,
    };

    const tempData = await userTempAddressModel.create({ ...tempPayload });

    let qr_code;

    if (address) {
      const url = await QR_Code.toDataURL(address, {
        width: 300,
      });
      qr_code = url;
    }
    // Ensure user_id is a valid integer
    const userId = tokenData.adm_id;
    if (!userId || isNaN(Number(userId))) {
      throw { message: "Invalid user ID for transaction" };
    }
    
    // Look up merchant's own wallet (FK references tbl_user_wallet, not tbl_admin_wallet)
    const legacyWalletLookup: Record<string, unknown> = {
      user_id: Number(userId),
      wallet_type: currency,
    };
    const legacyCompanyId = tokenData.company_id;
    if (legacyCompanyId && !isNaN(Number(legacyCompanyId))) {
      legacyWalletLookup.company_id = Number(legacyCompanyId);
    }
    const merchantWalletForTx = await userWalletModel.findOne({
      where: legacyWalletLookup,
    });
    const walletId = merchantWalletForTx?.dataValues.wallet_id;
    if (!walletId || isNaN(Number(walletId))) {
      throw { message: "Invalid wallet configuration — no merchant wallet found for " + currency };
    }
    
    const userPayload = {
      id: crypto.randomUUID(),
      wallet_id: Number(walletId),
      user_id: Number(userId),
      payment_mode: "CRYPTO",
      base_amount: isNaN(Number(data.amount)) ? 0 : Number(data.amount),
      base_currency: currency,
      transaction_type: "CREDIT",
      status: "pending",
      customer_id: (tokenData.customer_id && !isNaN(Number(tokenData.customer_id))) ? Number(tokenData.customer_id) : null,
      company_id: (tokenData.company_id && !isNaN(Number(tokenData.company_id))) ? Number(tokenData.company_id) : null,
    };
    console.log("Crypto userPayload:", JSON.stringify(userPayload));

    await userTransactionModel.create({ ...userPayload });
    await adminWalletModel.update(
      {
        last_index: latestIndex,
      },
      {
        where: {
          wallet_id: walletDetails.wallet_id,
        },
      }
    );
    const paymentRes = {
      qr_code,
      address: address,
      destination_tag: null as number | null,
      transaction_id: userPayload.id,
      temp_id: tempData.dataValues.temp_id,
      is_merchant_pool: false,  // Legacy admin wallet system
    };

    return { paymentRes, uniqueRef };
  } else {
    throw { message: "Please enter valid currency!" };
  }
};

const settleCryptoTransaction = async ({
  tempAddressData,
  receivedAmount,
  currency,
  transactionId,
  userAmount,
  userAddress,
  merchantDestinationTag,
  isMerchantPool,
}: {
  tempAddressData: {
    address: string;
    wallet_address?: string;  // Alternative name for address
    private_key?: string;
    privateKey?: string;
    wallet_type?: string;
    is_merchant_pool?: boolean;
    payment_id?: string;
  };
  receivedAmount: number;  // This is the admin fee amount
  currency: string;
  transactionId: string;
  userAmount?: number;     // This is the merchant amount
  userAddress?: string;    // Merchant wallet address
  merchantDestinationTag?: number | null; // XRP/RLUSD destination tag for merchant's exchange address
  isMerchantPool?: boolean; // Whether this is a merchant pool address
}) => {
  // Get the address - use wallet_address if available, otherwise use address
  const fromAddress = tempAddressData.wallet_address || tempAddressData.address;
  
  try {
    const adminWalletAddress = getAdminWalletAddress(currency);

    if (!adminWalletAddress) {
      throw new Error(
        `Admin wallet address not configured for ${currency} in environment variables.`
      );
    }

    // Get private key - merchant pool addresses use different field names
    const privateKeyField = isMerchantPool ? tempAddressData.private_key : tempAddressData.privateKey;
    const privateKey = await tatumApi.decryptSymmetric(
      privateKeyField,
      process.env.TEMP_KEY_ID
    );

    let fees;
    let merchantTransactionDetails;
    let totalBlockchainFee = 0;
    let merchantSendAmount = 0;
    let gasFundingResult: { funded: boolean; amount: number; txId?: string; reason?: string } = { funded: false, amount: 0 };

    // NEW APPROACH: Single transfer to merchant, admin fee stays in temp address for later sweep
    // This eliminates nonce collision issues for account-based chains (ETH, TRX, BSC)
    // and is more gas efficient as admin fees can be collected in batches

    if (!userAmount || userAmount <= 0 || !userAddress) {
      // No merchant amount (under threshold or error) - nothing to transfer now
      // Admin fee stays in temp address for sweep cron
      console.log(`[settleCryptoTransaction] No merchant transfer needed. Admin fee ${receivedAmount} ${currency} stays in temp address for sweep.`);
      return {
        transactionDetails: null,
        userTransactionDetails: null,
        sendAmount: 0,
        blockchainFee: 0,
        adminFeeRetained: receivedAmount,
      };
    }

    // Calculate fees for merchant transfer
    if (currency === "USDT-TRC20" || currency === "USDT-ERC20" || currency === "USDC-ERC20" || currency === "RLUSD" || currency === "RLUSD-ERC20" || currency === "USDT-POLYGON") {
      // Token transfers (handled separately)
      const wallet_type_map: Record<string, string> = {
        "USDT-TRC20": "TRX",
        "USDT-ERC20": "ETH",
        "USDC-ERC20": "ETH",
        "RLUSD": "XRP",
        "RLUSD-ERC20": "ETH",
        "USDT-POLYGON": "POLYGON",
      };
      const wallet_type = wallet_type_map[currency] || "ETH";
      const adminFeeWallet = await adminFeeModel.findOne({
        where: { wallet_type },
      });

      if (!adminFeeWallet) {
        throw new Error(`Admin fee wallet not found for ${wallet_type}.`);
      }

      let contractAddress;
      if (currency === "USDT-ERC20") {
        contractAddress = process.env.ETH_CONTRACT;
      } else if (currency === "USDC-ERC20") {
        contractAddress = process.env.USDC_CONTRACT;
      } else if (currency === "RLUSD-ERC20") {
        contractAddress = process.env.RLUSD_ERC20_CONTRACT;
      } else if (currency === "USDT-POLYGON") {
        contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
      } else if (currency === "RLUSD") {
        contractAddress = null; // RLUSD uses XRP Ledger tokens, not contract
      } else {
        contractAddress = process.env.TRX_CONTRACT;
      }

      fees = await tatumApi.feeEstimation(
        currency,
        fromAddress,
        userAddress,
        Number(userAmount),
        contractAddress
      );

      // Deduct gas cost from merchant's token payout (consistent with UTXO/native chains)
      // TWO gas costs: (1) merchant transfer gas + (2) estimated sweep gas for admin fee collection
      // Gas is in native currency (ETH/TRX/XRP/POL), so convert to USD equivalent for stablecoin deduction
      let merchantTransferGasUSD = 0;
      let estimatedSweepGasUSD = 0;
      try {
        const networkFee = await getBlockchainNetworkFee(currency);
        merchantTransferGasUSD = Number(networkFee.feeInUSD) || 0;
        // Sweep is same type of token transfer on same chain → same gas estimate
        estimatedSweepGasUSD = merchantTransferGasUSD;
        console.log(`[settleCryptoTransaction] Token ${currency}: Transfer gas ≈ $${merchantTransferGasUSD.toFixed(4)}, Sweep gas ≈ $${estimatedSweepGasUSD.toFixed(4)} (both deducted from merchant)`);
      } catch (feeErr) {
        // Fallback: convert raw native fee to USD using price lookup
        const rawFee = Number(fees?.fast ?? fees?.slow ?? 0);
        try {
          const nativePrices: Record<string, number> = { ETH: 2300, TRX: 0.25, XRP: 2.5, POLYGON: 0.5 };
          const nativePrice = nativePrices[wallet_type] || 1;
          merchantTransferGasUSD = rawFee * nativePrice;
          estimatedSweepGasUSD = merchantTransferGasUSD; // Same chain, same tx type
          console.warn(`[settleCryptoTransaction] Token ${currency}: Fallback gas: ${rawFee} ${wallet_type} × $${nativePrice} = $${merchantTransferGasUSD.toFixed(4)} per tx (×2 for transfer + sweep)`);
        } catch {
          merchantTransferGasUSD = rawFee;
          estimatedSweepGasUSD = rawFee;
          console.warn(`[settleCryptoTransaction] Token ${currency}: Using raw native fee ${rawFee} as token deduction (price lookup failed)`);
        }
      }

      const totalGasDeductionToken = merchantTransferGasUSD + estimatedSweepGasUSD;
      merchantSendAmount = Number((Number(userAmount) - totalGasDeductionToken).toFixed(6));
      if (merchantSendAmount <= 0) {
        throw new Error(`Merchant token amount after gas deduction is non-positive. Amount: ${userAmount}, TransferGas: ${merchantTransferGasUSD}, SweepGas: ${estimatedSweepGasUSD}`);
      }

      console.log(`[settleCryptoTransaction] Token ${currency}: Merchant gets ${merchantSendAmount} (was ${userAmount}, transfer gas $${merchantTransferGasUSD.toFixed(4)} + sweep gas $${estimatedSweepGasUSD.toFixed(4)} = $${totalGasDeductionToken.toFixed(4)} total)`);

      // === SmartGas: Fund gas (TRX/ETH) to temp address BEFORE token transfer ===
      try {
        if (isMerchantPool) {
          const poolAddressRecord = await merchantTempAddressModel.findOne({
            where: { wallet_address: fromAddress },
          });
          if (poolAddressRecord) {
            console.log(`[settleCryptoTransaction] 🔧 SmartGas: Checking ${wallet_type} gas for ${currency} merchant transfer (${merchantSendAmount} → ${userAddress})...`);
            gasFundingResult = await merchantPoolService.fundGasIfNeeded(
              poolAddressRecord as unknown as { dataValues: { wallet_address: string }; update: (data: Record<string, unknown>) => Promise<void> },
              currency, merchantSendAmount, userAddress
            );
          } else {
            console.warn(`[settleCryptoTransaction] ⚠️ Pool address record not found for ${fromAddress}, skipping SmartGas`);
          }
        } else {
          // Legacy temp address — use lightweight wrapper (no DB gas tracking)
          console.log(`[settleCryptoTransaction] 🔧 SmartGas: Checking ${wallet_type} gas for legacy ${currency} transfer...`);
          gasFundingResult = await merchantPoolService.fundGasIfNeeded(
            { dataValues: { wallet_address: fromAddress }, update: async () => {} },
            currency, merchantSendAmount, userAddress
          );
        }

        // Wait for gas funding TX to confirm before attempting the token transfer
        if (gasFundingResult.funded && gasFundingResult.txId) {
          console.log(`[settleCryptoTransaction] ⏳ Waiting for gas funding TX ${gasFundingResult.txId} confirmation (${wallet_type})...`);
          const gasConfirmation = await tatumApi.waitForTransactionConfirmation(
            gasFundingResult.txId,
            wallet_type,
            30000  // 30s timeout — TRX ~3s blocks, ETH ~12s blocks
          );
          if (gasConfirmation.confirmed) {
            console.log(`[settleCryptoTransaction] ✅ Gas funding confirmed in block ${gasConfirmation.blockNumber}`);
          } else {
            console.warn(`[settleCryptoTransaction] ⚠️ Gas funding TX not confirmed in timeout — proceeding with retry logic`);
          }
        } else if (!gasFundingResult.funded && gasFundingResult.reason) {
          console.log(`[settleCryptoTransaction] ℹ️ SmartGas: ${gasFundingResult.reason}`);
        }
      } catch (gasError) {
        console.error(`[settleCryptoTransaction] ⚠️ SmartGas funding failed: ${getErrorMessage(gasError)} — proceeding anyway (retry may succeed)`);
      }
      // === End SmartGas ===

      // Retry merchant transfer for token transfers
      merchantTransactionDetails = await withRetry(
        () => tatumApi.assetToOtherAddress({
          currency,
          fromAddress: fromAddress,
          toAddress: userAddress,
          privateKey: privateKey,
          amount: merchantSendAmount,
          fee: fees,
          _contractAddress: contractAddress,
        }),
        `Token merchant transfer (${currency})`
      );

      totalBlockchainFee = Number(fees?.fast ?? 0);
      // Record the total gas deduction (transfer + sweep) for accounting
      console.log(`[settleCryptoTransaction] Token ${currency}: totalBlockchainFee (native gas) = ${totalBlockchainFee}, totalGasDeductionFromMerchant (USD) = $${totalGasDeductionToken.toFixed(4)} (includes sweep gas)`);

    } else {
      // Native currency transfers
      const canUseSingleUTXO = ["BTC", "LTC", "DOGE", "BCH"].includes(currency);

      if (canUseSingleUTXO) {
        // UTXO chains: Create single transaction with two outputs (merchant + admin)
        fees = await tatumApi.feeEstimation(
          currency,
          fromAddress,
          userAddress,
          Number(receivedAmount) + Number(userAmount)
        );

        const feeToDeduct = fees?.fast ?? 0;
        const adminAmount = Number(receivedAmount);
        merchantSendAmount = Number(userAmount) - Number(feeToDeduct);

        // Lookup the correct UTXO output index for this address (instead of assuming index 0)
        const utxoIndex = await tatumApi.findUtxoOutputIndex(transactionId, fromAddress, currency);

        // Retry merchant transfer for UTXO chains
        merchantTransactionDetails = await withRetry(
          () => tatumApi.assetToOtherAddress({
            currency,
            fromAddress: fromAddress,
            toAddress: userAddress,  // Primary recipient is merchant
            privateKey: privateKey,
            amount: merchantSendAmount,
            fee: String(fees.fast),
            fromUTXO: [
              {
                txHash: transactionId,
                index: utxoIndex,
              },
            ],
            toUTXO: [
              {
                address: userAddress,
                value: Number(merchantSendAmount),
              },
              {
                address: adminWalletAddress,
                value: Number(adminAmount),
              },
            ],
          }),
          `UTXO merchant transfer (${currency})`
        );

        totalBlockchainFee = feeToDeduct;
        
        console.log(`[settleCryptoTransaction] UTXO chain ${currency}: Single TX with merchant ${merchantSendAmount} + admin ${adminAmount}`);

      } else {
        // Account-based chains (ETH, TRX, BSC, SOL, XRP, POLYGON): Single transfer to merchant only
        // TWO gas costs deducted from merchant:
        //   (1) Merchant transfer gas — gas to send merchant their crypto
        //   (2) Estimated sweep gas — gas for later admin fee sweep from temp address
        // This prevents: sweep gas eroding the admin fee (reducing platform revenue)
        fees = await tatumApi.feeEstimation(
          currency,
          fromAddress,
          userAddress,
          Number(userAmount)
        );

        // Use `fast` tier for gas deduction — this is the actual gas cost the transaction will incur.
        const merchantTransferGas = Number(fees?.fast ?? fees?.slow ?? 0);
        // Sweep gas estimate: same chain, same type of native transfer → approximately same gas
        const estimatedSweepGas = merchantTransferGas;
        const totalGasDeduction = merchantTransferGas + estimatedSweepGas;

        // Deduct both gas costs from merchant payout — merchant pays for gas (consistent with UTXO)
        merchantSendAmount = Number((Number(userAmount) - totalGasDeduction).toFixed(8));

        if (merchantSendAmount <= 0) {
          throw new Error(`Merchant amount after gas deduction is non-positive. Amount: ${userAmount}, TransferGas: ${merchantTransferGas}, SweepGas: ${estimatedSweepGas}`);
        }

        console.log(`[settleCryptoTransaction] Account chain ${currency}: Merchant gets ${merchantSendAmount} ${currency} (transfer gas ${merchantTransferGas} + sweep gas ${estimatedSweepGas} = ${totalGasDeduction} deducted from merchant)`);

        // Retry merchant transfer for account chains (ETH, TRX, SOL, XRP, POLYGON)
        merchantTransactionDetails = await withRetry(
          () => tatumApi.assetToOtherAddress({
            currency,
            fromAddress: fromAddress,
            toAddress: userAddress,
            privateKey: privateKey,
            amount: merchantSendAmount,
            fee: fees,
            destinationTag: merchantDestinationTag,
          }),
          `Account chain merchant transfer (${currency})`
        );

        totalBlockchainFee = totalGasDeduction;
        console.log(`[settleCryptoTransaction] Account chain ${currency}: totalBlockchainFee = ${totalBlockchainFee} (includes sweep gas estimate)`);
      }
    }

    // FIX: Verify merchant transaction was actually mined for account-based chains
    // This prevents marking payment complete when TX is stuck due to low gas
    if (["ETH", "BSC", "TRX", "USDT-ERC20", "USDC-ERC20", "RLUSD-ERC20", "USDT-TRC20", "SOL", "XRP", "RLUSD", "POLYGON", "USDT-POLYGON"].includes(currency)) {
      const txHash = merchantTransactionDetails?.txId;
      if (txHash) {
        console.log(`[settleCryptoTransaction] Waiting for TX confirmation: ${txHash}`);
        const { confirmed, blockNumber } = await tatumApi.waitForTransactionConfirmation(txHash, currency, PAYMENT_TIMING.TRANSACTION_CONFIRMATION_TIMEOUT_MS);
        
        if (!confirmed) {
          console.error(`[settleCryptoTransaction] WARNING: TX ${txHash} not confirmed within timeout!`);
          // Don't throw - allow flow to continue but log the issue
          // The sweep will detect unspent balance and retry later
        } else {
          console.log(`[settleCryptoTransaction] TX ${txHash} confirmed in block ${blockNumber}`);
        }
      }
    }

    return {
      transactionDetails: merchantTransactionDetails,  // Now this is merchant tx, not admin
      userTransactionDetails: null,  // No separate user tx needed
      sendAmount: merchantSendAmount,
      blockchainFee: totalBlockchainFee,
      adminFeeRetained: Number(receivedAmount),  // Track admin fee for sweep
      gasFunded: gasFundingResult.amount || 0,  // SmartGas: amount of TRX/ETH funded
      gasFundingTxId: gasFundingResult.txId || null,  // SmartGas: gas funding TX hash
    };
  } catch (error) {
    const message = getErrorMessage(error);
    apiLogger.error(
      "Failed to transfer funds",
      {
        currency,
        tempAddress: fromAddress,
        receivedAmount,
        userAmount,
        error: message,
      },
      new Error(error instanceof Error ? error.message : String(error))
    );
    throw error;
  }
};

const verifyCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { address, destination_tag } = req.body;
    const userData = jwt.decode(res.locals.token) as { ref?: string; transaction_id?: string; [key: string]: unknown } | null;
    
    console.log("[verifyCryptoPayment] Checking address:", address, destination_tag ? `tag: ${destination_tag}` : '', `session: ${userData?.ref || 'unknown'}`);
    
    // SECURE: Resolve destination_tag from customer session if not provided
    // For tag-based chains (XRP, RLUSD), the same master address handles many concurrent payments.
    // The only secure way to identify the correct payment is via the destination_tag,
    // which is stored in the customer session (customer-{ref}) under active_crypto_address.
    let resolvedTag = destination_tag ? Number(destination_tag) : null;
    
    if (!resolvedTag && userData?.ref) {
      try {
        const customerSessionKey = `customer-${userData.ref}`;
        const customerSession = await getRedisItem(customerSessionKey);
        // Priority: active_crypto_address.destination_tag (most recent user action) > top-level destination_tag (set by settlement)
        // This prevents stale tags from previous payments interfering with current session
        const sessionTag = customerSession?.active_crypto_address?.destination_tag || customerSession?.destination_tag;
        if (sessionTag) {
          resolvedTag = Number(sessionTag);
          console.log(`[verifyCryptoPayment] Resolved destination_tag ${resolvedTag} from session ${customerSessionKey}`);
        }
      } catch (sessionErr) {
        console.log("[verifyCryptoPayment] Session lookup error:", sessionErr);
      }
    }
    
    // Build Redis key using resolved tag (secure, session-specific)
    const verifyRedisKey = resolvedTag ? getCryptoRedisKey(address, resolvedTag) : `crypto-${address}`;
    const tempData = await getRedisItem(verifyRedisKey);
    
    console.log("[verifyCryptoPayment] Redis key:", verifyRedisKey, "data:", tempData?.status, tempData?.txId ? "has txId" : "no txId");
    
    if (!tempData || Object.keys(tempData).length === 0) {
      // No payment data found - payment hasn't been initiated or address is invalid
      console.log("[verifyCryptoPayment] No Redis data found for address");
      return successResponseHelper(res, 200, "Waiting for payment", {
        status: "waiting",
        message: "No payment detected yet"
      });
    }
    
    const redisStatus = tempData?.status;
    const expectedAmount = parseFloat(tempData?.amount || '0');
    const receivedAmount = parseFloat(tempData?.receivedAmount || '0');
    const previousAmount = parseFloat(tempData?.previousAmount || '0');
    const currency = tempData?.currency;
    
    // Get customer data for payment link info
    const customerData = await getRedisItem(tempData?.ref);
    
    // Calculate remaining seconds from payment link expiry or partial payment timestamp
    let remainingSeconds = PAYMENT_TIMING.CRYPTO_INVOICE_MINUTES * 60; // Default from centralized config
    let gracePeriodMinutes = 30; // Default grace period for underpayment completion
    
    // Default merchant settings
    let merchantOverpaymentThreshold = 5; // Default $5 overpayment threshold
    let merchantUnderpaymentThreshold = 1; // Default $1 underpayment threshold
    
    // Try to fetch merchant-specific settings from company
    if (customerData?.company_id || tempData?.company_id) {
      try {
        const company = await companyModel.findOne({
          where: { company_id: customerData?.company_id || tempData?.company_id }
        });
        if (company?.dataValues?.overpayment_threshold_usd !== undefined && 
            company?.dataValues?.overpayment_threshold_usd !== null) {
          merchantOverpaymentThreshold = parseFloat(company.dataValues.overpayment_threshold_usd);
        }
        if (company?.dataValues?.underpayment_threshold_usd !== undefined && 
            company?.dataValues?.underpayment_threshold_usd !== null) {
          merchantUnderpaymentThreshold = parseFloat(company.dataValues.underpayment_threshold_usd);
        }
        if (company?.dataValues?.grace_period_minutes !== undefined && 
            company?.dataValues?.grace_period_minutes !== null) {
          gracePeriodMinutes = Math.min(parseInt(company.dataValues.grace_period_minutes), 30); // Max 30 minutes
        }
      } catch (e) {
        console.log("[verifyCryptoPayment] Could not fetch merchant settings:", e);
      }
    }
    
    const merchantSettings = {
      overpayment_threshold_usd: merchantOverpaymentThreshold,
      underpayment_threshold_usd: merchantUnderpaymentThreshold,
      grace_period_minutes: gracePeriodMinutes,
    };
    
    // FIX: Use crypto_invoice_expires_at from Redis for accurate countdown
    // This is the 15-minute window from when crypto payment was initiated
    // NOT the payment link expiry (which could be 7 days)
    if (tempData?.crypto_invoice_expires_at) {
      const cryptoExpiresAt = new Date(tempData.crypto_invoice_expires_at);
      const now = new Date();
      remainingSeconds = Math.max(0, Math.floor((cryptoExpiresAt.getTime() - now.getTime()) / 1000));
      console.log(`[verifyCryptoPayment] Using crypto invoice expiry: ${tempData.crypto_invoice_expires_at}, remaining: ${remainingSeconds}s`);
    } else {
      // Fallback: Try to get payment link expiry (legacy behavior)
      const linkId = customerData?.payment_link_id;
      const paymentId = tempData?.payment_id;
      
      if (linkId || paymentId) {
        try {
          // Build where clause only with valid values
          const whereConditions: Array<Record<string, unknown>> = [];
          if (linkId && linkId !== undefined && linkId !== null) {
            whereConditions.push({ link_id: linkId });
          }
          if (paymentId && paymentId !== undefined && paymentId !== null) {
            whereConditions.push({ transaction_id: paymentId });
          }
          
          if (whereConditions.length > 0) {
            const paymentLink = await paymentLinkModel.findOne({
              where: {
                [Op.or]: whereConditions
              }
            });
            
            if (paymentLink) {
              const linkData = paymentLink.dataValues;
              // FIX: For crypto invoice, use 15 minutes from creation, NOT payment link expiry
              const createdAt = new Date(linkData.createdAt);
              const cryptoWindowMinutes = String(tempData?.incomplete) === "true" ? gracePeriodMinutes : 15;
              const expiresAt = new Date(createdAt.getTime() + cryptoWindowMinutes * 60 * 1000);
              const now = new Date();
              remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
            }
          }
        } catch (e) {
          console.log("[verifyCryptoPayment] Could not fetch payment link expiry:", e);
        }
      }
    }
    
    // For partial payments, calculate remaining time from partial payment timestamp
    if (String(tempData?.incomplete) === "true" && tempData?.partialPaymentTimestamp) {
      const partialTimestamp = new Date(tempData.partialPaymentTimestamp);
      const graceExpiresAt = new Date(partialTimestamp.getTime() + gracePeriodMinutes * 60 * 1000);
      const now = new Date();
      remainingSeconds = Math.max(0, Math.floor((graceExpiresAt.getTime() - now.getTime()) / 1000));
    }
    
    // Get base currency info for USD conversion
    // FIX: Also check customerData for base_amount since tempData may not have it stored
    // FIX: The crypto-{address} Redis key stores as 'base_amount_usd', not 'base_amount'
    const baseCurrency = tempData?.base_currency || customerData?.base_currency || "USD";
    const baseAmount = parseFloat(tempData?.base_amount || tempData?.base_amount_usd || customerData?.base_amount || "0");
    
    // IMPORTANT: Check for SUCCESSFUL status FIRST before checking underpaid
    // This prevents returning stale underpaid data after payment completes
    if (redisStatus === "successful") {
      // Payment confirmed - check for overpayment
      const totalReceived = receivedAmount > 0 ? receivedAmount : parseFloat(tempData?.amount || '0');
      const originalExpected = tempData?.originalExpectedAmount ? parseFloat(tempData.originalExpectedAmount) : expectedAmount;
      const isOverpayment = totalReceived > originalExpected && originalExpected > 0;
      const overpaymentAmount = isOverpayment ? (totalReceived - originalExpected) : 0;
      
      // Calculate overpayment in USD to compare against threshold
      // Only flag as "overpaid" if excess exceeds merchant's overpayment_threshold_usd
      let overpaymentUsd = 0;
      if (isOverpayment && originalExpected > 0 && baseAmount > 0) {
        overpaymentUsd = (overpaymentAmount / originalExpected) * baseAmount;
      }
      const isSignificantOverpayment = isOverpayment && overpaymentUsd > merchantOverpaymentThreshold;
      
      // FIXED: Don't re-call cryptoVerification if already processed - just return the status
      // The payment was already distributed when status became "successful"
      console.log("[verifyCryptoPayment] Payment already successful, returning confirmed status");
      console.log(`[verifyCryptoPayment] Overpayment check: excess=${overpaymentAmount.toFixed(8)} ${currency}, excessUsd=$${overpaymentUsd.toFixed(2)}, threshold=$${merchantOverpaymentThreshold}, significant=${isSignificantOverpayment}`);
      
      // Get redirect URL from customerData if available
      let redirectUrl = null;
      if (customerData?.redirect_uri) {
        redirectUrl = customerData.redirect_uri + 
          `?transaction_id=${tempData.payment_id || tempData.unique_tx_id}&status=successful&payment_type=CRYPTO`;
      }
      
      // Calculate USD amounts — use base_amount from customer data if available
      const actualBaseAmount = baseAmount > 0 ? baseAmount : parseFloat(customerData?.base_amount || tempData?.base_amount || '0');
      let paidAmountUsd = 0;
      let expectedAmountUsd = actualBaseAmount;
      
      if (totalReceived > 0 && originalExpected > 0 && actualBaseAmount > 0) {
        paidAmountUsd = actualBaseAmount * (totalReceived / originalExpected);
        expectedAmountUsd = actualBaseAmount;
      }
      
      // Build response matching checkout page expected format
      // Checkout expects: status "confirmed" for success, "overpaid" only for significant overpayments
      // Minor overpayments (below merchant threshold) are treated as normal "confirmed"
      const responseData: Record<string, unknown> = {
        status: isSignificantOverpayment ? "overpaid" : "confirmed",
        message: isSignificantOverpayment ? "Payment confirmed with overpayment" : "Payment confirmed",
        redirect: redirectUrl,
        txId: tempData.txId,
        paidAmount: parseFloat(totalReceived.toFixed(6)),
        expectedAmount: parseFloat(originalExpected.toFixed(6)),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // USD amounts
        paidAmountUsd: parseFloat(paidAmountUsd.toFixed(2)),
        expectedAmountUsd: parseFloat(expectedAmountUsd.toFixed(2)),
        baseCurrency: baseCurrency,
        completedAt: tempData.completedAt,
        // Timer and settings (for consistency across all responses)
        remaining_seconds: 0, // Payment complete, no time remaining
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings,
      };

      if (isSignificantOverpayment) {
        responseData.excessAmount = parseFloat(overpaymentAmount.toFixed(6));
        responseData.excessAmountUsd = parseFloat(overpaymentUsd.toFixed(2));
      }

      // DEBUG: Log the exact response being sent
      console.log("[verifyCryptoPayment] Sending CONFIRMED response:", JSON.stringify(responseData, null, 2));

      return successResponseHelper(res, 200, responseData.message as string, responseData);
    }
    
    // Check if this is a partial payment scenario (incomplete flag set OR underpaid status)
    // Only return underpaid if NOT already successful
    // Redis stores values as strings, so convert to string for comparison
    if (String(tempData?.incomplete) === "true" || redisStatus === "underpaid") {
      // Use originalExpectedAmount if available (set by webhook), otherwise calculate from previousAmount
      const originalExpected = parseFloat(tempData?.originalExpectedAmount || '0') || (expectedAmount + previousAmount);
      const totalPaid = previousAmount > 0 ? previousAmount : receivedAmount;
      const remainingAmount = originalExpected - totalPaid;
      
      // Calculate USD amounts for underpayment
      let paidAmountUsd = 0;
      let expectedAmountUsd = baseAmount;
      let remainingAmountUsd = 0;
      
      // Use customerData already fetched above
      const actualBaseAmount = baseAmount > 0 ? baseAmount : parseFloat(customerData?.base_amount || "0");
      
      if (totalPaid > 0 && originalExpected > 0 && actualBaseAmount > 0) {
        const paidRatio = totalPaid / originalExpected;
        paidAmountUsd = actualBaseAmount * paidRatio;
        expectedAmountUsd = actualBaseAmount;
        remainingAmountUsd = actualBaseAmount - paidAmountUsd;
      }
      
      console.log(`[verifyCryptoPayment] Underpayment detected:
        - Total Paid: ${totalPaid} ${currency}
        - Original Expected: ${originalExpected} ${currency}
        - Remaining: ${remainingAmount} ${currency}
        - Paid USD: $${paidAmountUsd.toFixed(2)}
        - Expected USD: $${expectedAmountUsd.toFixed(2)}
        - Remaining USD: $${remainingAmountUsd.toFixed(2)}
        - Remaining Seconds: ${remainingSeconds}`);
      
      // FIXED: Use "underpaid" status and camelCase fields to match checkout page expectations
      return successResponseHelper(res, 200, "Partial payment received", {
        status: "underpaid",
        message: "Partial payment received. Please pay the remaining amount.",
        paidAmount: parseFloat(totalPaid.toFixed(6)),
        expectedAmount: parseFloat(originalExpected.toFixed(6)),
        remainingAmount: parseFloat(remainingAmount.toFixed(6)),
        currency: currency,
        // USD amounts
        paidAmountUsd: parseFloat(paidAmountUsd.toFixed(2)),
        expectedAmountUsd: parseFloat(expectedAmountUsd.toFixed(2)),
        remainingAmountUsd: parseFloat(remainingAmountUsd.toFixed(2)),
        baseCurrency: baseCurrency || customerData?.base_currency || "USD",
        txId: tempData?.previousTxId || tempData?.txId,
        address: address, // Include address so user can send remaining payment
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // NEW: Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings,
        partial_payment_timestamp: tempData?.partialPaymentTimestamp
      });
    }
    
    // Return status based on Redis state
    // Status flow: pending -> processing -> successful OR failed
    if (redisStatus === "pending" && !tempData?.txId) {
      // Payment initiated but no transaction detected yet
      return successResponseHelper(res, 200, "Waiting for payment", {
        status: "waiting",
        message: "Payment address generated, waiting for transaction",
        expected_amount: expectedAmount.toFixed(6),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // NEW: Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    if (redisStatus === "pending" && tempData?.txId) {
      // Transaction detected but not yet processed (legacy state)
      return successResponseHelper(res, 200, "Payment pending", {
        status: "pending",
        message: "Payment detected, awaiting confirmation",
        txId: tempData.txId,
        amount: tempData.receivedAmount || tempData.amount,
        expected_amount: expectedAmount.toFixed(6),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    if (redisStatus === "processing" || redisStatus === "retrying") {
      // Transaction detected and being processed
      return successResponseHelper(res, 200, "Payment pending", {
        status: "pending",
        message: "Payment detected, awaiting confirmation",
        txId: tempData.txId,
        amount: tempData.receivedAmount || tempData.amount,
        expected_amount: expectedAmount.toFixed(6),
        currency: currency,
        // XRP/RLUSD: Include destination tag for tag-based chains
        ...(tempData?.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
        ...(tempData?.destination_tag && { memo: String(tempData.destination_tag) }),
        // Timer and settings
        remaining_seconds: remainingSeconds,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    if (redisStatus === "failed") {
      return successResponseHelper(res, 200, "Payment failed", {
        status: "failed",
        message: tempData.lastError || "Payment processing failed",
        txId: tempData.txId,
        // Timer and settings (for consistency)
        remaining_seconds: 0,
        grace_period_minutes: gracePeriodMinutes,
        merchant_settings: merchantSettings
      });
    }
    
    // Fallback - try original verification with the resolved tag-based key
    const result = await cryptoVerification(address, false, verifyRedisKey !== `crypto-${address}` ? verifyRedisKey : undefined);
    console.log("result===========>", result, address);
    const { message, status } = result;
    if (status === 500) {
      errorResponseHelper(res, status, message);
    } else {
      const returnData =
        typeof result === "object" && result !== null && "resData" in result
          ? (result as { resData: unknown }).resData
          : result;
      successResponseHelper(res, status, "Success", returnData);
    }
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const cryptoVerification = async (address, webhook = true, overrideRedisKey?: string) => {
  const transaction = await sequelize.transaction();

  try {
    let customerData;
    const cryptoKey = overrideRedisKey || `crypto-${address}`;
    const tempData = await getRedisItem(cryptoKey);

    if (tempData && Object.keys(tempData).length > 0) {
      customerData = await getRedisItem(tempData?.ref);
    }
    const transactionId = tempData?.txId;
    const tempCurrency = tempData?.currency;

    // CRITICAL FIX: Check for duplicate transaction processing
    if (transactionId) {
      const existingTransaction = await customerTransactionModel.findOne({
        where: {
          transaction_reference: transactionId,
          status: { [Op.in]: ["successful", "completed"] }
        }
      });

      if (existingTransaction) {
        console.warn(`[cryptoVerification] ⚠️  DUPLICATE WEBHOOK DETECTED: ${transactionId}`);
        console.warn(`[cryptoVerification] Transaction already processed, ignoring webhook`);
        await transaction.rollback();
        return {
          status: 200,
          message: "Transaction already processed",
          duplicate: true,
          txId: transactionId
        };
      }
    }

    if (transactionId) {
      // Validate customerData exists and has required fields
      if (!customerData || !customerData.adm_id) {
        console.warn(`[cryptoVerification] ⚠️  Missing customerData or adm_id for address: ${address}`);
        console.warn(`[cryptoVerification] customerData:`, JSON.stringify(customerData));
        console.warn(`[cryptoVerification] tempData:`, JSON.stringify(tempData));
        
        // Try to find payment info from merchant pool address
        const poolAddress = await merchantTempAddressModel.findOne({
          where: { wallet_address: address },
          transaction,
        });
        
        if (poolAddress && poolAddress.dataValues.owner_user_id) {
          console.log(`[cryptoVerification] Found pool address, using owner_user_id: ${poolAddress.dataValues.owner_user_id}`);
          customerData = customerData || {};
          customerData.adm_id = poolAddress.dataValues.owner_user_id;
          customerData.company_id = poolAddress.dataValues.current_company_id;
        } else {
          await transaction.rollback();
          return {
            status: 400,
            message: "Payment session expired or invalid. Customer data not found.",
            address: address
          };
        }
      }

      // Multi-tenant fix: Include company_id in wallet lookup to ensure funds go to correct company
      const whereClause: Record<string, unknown> = {
        user_id: customerData.adm_id,
        wallet_type: tempCurrency,
        wallet_address: { [Op.not]: null },
      };
      
      console.log(`[cryptoVerification] Wallet lookup DEBUG:
        - user_id (adm_id): ${customerData.adm_id}
        - wallet_type: ${tempCurrency}
        - company_id from customerData: ${customerData.company_id}
      `);
      
      // Handle company_id: if provided and valid, add to query
      // MULTI-TENANT FIX: Require company_id for proper isolation
      if (customerData.company_id && customerData.company_id !== '' && customerData.company_id !== 'undefined' && customerData.company_id !== 'null') {
        const companyId = parseInt(customerData.company_id);
        if (!isNaN(companyId)) {
          whereClause.company_id = companyId;
        }
      }
      // Note: If company_id not set, we don't add it to whereClause - allowing any wallet for this user
      
      console.log(`[cryptoVerification] Final whereClause:`, JSON.stringify(whereClause));
      
      let walletData = await userWalletModel.findOne({
        where: whereClause,
        transaction,
      });
      
      // MULTI-TENANT FIX: Do NOT fallback without company_id - log error instead
      if (!walletData && whereClause.company_id) {
        console.error(`[cryptoVerification] ❌ MULTI-TENANT: No wallet found for company_id ${whereClause.company_id}. NOT falling back to avoid cross-company payment routing.`);
        // Instead of removing company_id constraint, we fail safely
        await transaction.rollback();
        return {
          status: 400,
          message: `No wallet configured for this company and currency (${tempCurrency}). Please configure a ${tempCurrency} wallet for this company.`,
          company_id: whereClause.company_id,
          currency: tempCurrency
        };
      }
      
      console.log(`[cryptoVerification] walletData result:`, walletData ? walletData.dataValues : 'NULL');
      const receivedAmount = Number(tempData?.receivedAmount ?? tempData?.amount ?? 0);

      let product_name;

      if (customerData?.meta_data) {
        const meta_data = JSON.parse(customerData?.meta_data);
        product_name = meta_data?.product_name ?? meta_data?.product;
      }

      const company_data = (
        await companyModel.findOne({
          where: { company_id: customerData.company_id },
        })
      ).dataValues;

      const finalAmount = await currencyConvert({
        sourceCurrency: tempData?.currency,
        currency: [customerData?.base_currency],
        amount: receivedAmount,
        fixedDecimal: false,
      });

      console.log("finalAmount=========>", finalAmount[0]);

      const customerPayload = {
        id: tempData?.incomplete && tempData?.customerInternalRef ? tempData.customerInternalRef : crypto.randomUUID(),
        company_id: Number(customerData.company_id),
        customer_id: customerData.customer_id ? Number(customerData.customer_id) : null,
        payment_mode: "CRYPTO",
        base_amount: Number(finalAmount[0].amount).toFixed(2),
        base_currency: customerData.base_currency,
        paid_amount: Number(receivedAmount).toFixed(6),
        paid_currency: tempCurrency,
        transaction_reference: transactionId,
        transaction_type: customerData?.pathType?.includes("addFund")
          ? "CREDIT"
          : "PAYMENT",
        ...(!customerData?.pathType?.includes("addFund") && {
          transaction_details: product_name
            ? "Made payment for " + product_name + " on " + company_data?.company_name
            : "Made payment for " + (company_data?.company_name || "Company") + " product",
        }),
        status: tempData.status,
      };

      await customerTransactionModel.create(
        { ...customerPayload },
        { transaction }
      );

      let tempAddressData;
      let isMerchantPoolAddress = false;
      
      if (tempData.temp_id) {
        // Check if it's a merchant pool address first
        // Redis stores values as strings, so convert to string for comparison
        const isMerchantPoolFlag = String(tempData.is_merchant_pool) === "true";
        if (isMerchantPoolFlag) {
          tempAddressData = await merchantTempAddressModel.findOne({
            where: { temp_address_id: tempData.temp_id },
          });
          isMerchantPoolAddress = true;
          console.log(`[cryptoVerification] Found MERCHANT POOL address: ${address}`);
        } else {
          tempAddressData = await userTempAddressModel.findOne({
            where: { temp_id: tempData.temp_id },
          });
        }
      } else {
        // Try merchant pool first by wallet address
        const merchantPoolAddress = await merchantTempAddressModel.findOne({
          where: { wallet_address: address },
        });
        
        if (merchantPoolAddress) {
          tempAddressData = merchantPoolAddress.dataValues;
          isMerchantPoolAddress = true;
          console.log(`[cryptoVerification] Found MERCHANT POOL address by wallet: ${address}`);
        } else {
          // Fallback to legacy userTempAddressModel
          const tempAddressWhereClause: Record<string, unknown> = {
            wallet_address: address,
            wallet_type: tempCurrency,
          };
          
          // Add user_id for better isolation
          if (customerData?.adm_id) {
            tempAddressWhereClause.user_id = customerData.adm_id;
          }
          
          // Add company_id if present
          if (customerData?.company_id && customerData.company_id !== '' && 
              customerData.company_id !== 'undefined' && customerData.company_id !== 'null') {
            const companyId = parseInt(customerData.company_id);
            if (!isNaN(companyId)) {
              tempAddressWhereClause.company_id = companyId;
            }
          }
          
          const tempAddressDataArray = await userTempAddressModel.findAll({
            where: tempAddressWhereClause,
            order: [['created_at', 'DESC']],
          });
          
          if (!tempAddressDataArray || tempAddressDataArray.length === 0) {
            throw new Error(`No temp address found for ${address}`);
          }
          
          tempAddressData = tempAddressDataArray[0].dataValues;
        }
      }
      
      // Store merchant pool flag in tempData for later use (as string for Redis compatibility)
      tempData.is_merchant_pool = String(isMerchantPoolAddress);

      const isFullPayment = Number(receivedAmount) >= Number(tempData?.amount);
      const isPartialPayment = Number(receivedAmount) < Number(tempData?.amount) && !webhook;

      if (isPartialPayment) {
        const pendingAmount = (Number(tempData?.amount) - Number(receivedAmount)).toFixed(8);
        const expectedAmount = Number(tempData?.amount) + (tempData?.previousAmount ? Number(tempData.previousAmount) : 0);

        // ENHANCED LOGGING: Partial payment accumulation tracking
        console.log(`[cryptoVerification] 📊 PARTIAL PAYMENT DETECTED:
          - Address: ${address}
          - Transaction ID: ${transactionId}
          - Payment #: ${tempData?.previousTxId ? '2+' : '1'}
          - This Payment: ${receivedAmount} ${tempCurrency}
          - Previous Payments: ${tempData?.previousAmount || 0} ${tempCurrency}
          - Total Accumulated: ${Number(receivedAmount) + Number(tempData?.previousAmount || 0)} ${tempCurrency}
          - Expected Total: ${expectedAmount} ${tempCurrency}
          - Remaining: ${pendingAmount} ${tempCurrency}
          - Grace Period: 30 minutes`);

        await userTempAddressModel.update(
          {
            txId: tempAddressData.txId ? tempAddressData.txId + "," + transactionId : transactionId,
            status: "partial",
            amount: receivedAmount,
            partial_payment_timestamp: tempAddressData.partial_payment_timestamp ?? new Date(),
          },
          { where: { temp_id: tempAddressData.temp_id } }
        );

        // Send partial payment notification
        await sendPartialPaymentNotification(
          address,
          transactionId,
          Number(receivedAmount),
          expectedAmount,
          tempCurrency,
          customerData,
          PAYMENT_TIMING.GRACE_PERIOD_MINUTES
        );

        const { txId, ...rest } = tempData;
        const redisPayload = {
          ...rest,
          amount: pendingAmount,
          previousAmount: receivedAmount,
          previousTxId: transactionId,
          customerInternalRef: customerPayload.id,
          userInternalRef: tempData.unique_tx_id || tempData.payment_id,  // FIX: Support both field names
          incomplete: "true",
          partialPaymentTimestamp: new Date().toISOString(),
        };

        await deleteRedisItem(cryptoKey);
        await setRedisItem(cryptoKey, redisPayload);

        // PHASE 12: Also update customer Redis key with incomplete payment info
        // This enables blocking currency switching until payment is complete or expired
        const customerRef = tempData.ref;
        if (customerRef) {
          const customerData = await getRedisItem("customer-" + customerRef);
          if (customerData) {
            // Generate QR code for the address — include destination tag for XRP/RLUSD
            let qrCode;
            try {
              const qrPayload = tempData.destination_tag ? `${address}?dt=${tempData.destination_tag}` : address;
              qrCode = await QR_Code.toDataURL(qrPayload, { width: 300 });
            } catch (e) {
              console.log('[Phase 12] QR code generation failed:', e);
            }
            
            const updatedCustomerData = {
              ...customerData,
              incomplete_payment: {
                currency: tempCurrency,
                address: address,
                pending_amount: pendingAmount,
                previous_amount: receivedAmount,
                timestamp: new Date().toISOString(),
                qr_code: qrCode,
                // XRP/RLUSD: Persist destination tag for tag-based chains
                ...(tempData.destination_tag && { destination_tag: Number(tempData.destination_tag) }),
              }
            };
            await setRedisItem("customer-" + customerRef, updatedCustomerData);
            console.log(`[Phase 12] Updated customer-${customerRef} with incomplete payment info: ${pendingAmount} ${tempCurrency}${tempData.destination_tag ? ` (tag: ${tempData.destination_tag})` : ''}`);
          }
        }

        transaction.commit();

        throw {
          status: 200,
          paymentStatus: "incomplete",
          amount: pendingAmount,
          currency: tempCurrency,
          message: `Partial payment detected! Please pay remaining ${pendingAmount} ${tempCurrency} to complete this payment. You have ${PAYMENT_TIMING.GRACE_PERIOD_MINUTES} minutes to complete the payment.`,
          commit: true,
        };
      }

      if (isFullPayment || webhook) {
        // FIX: For completion payments, use receivedAmount directly as it's already the cumulative total
        // The webhook handler updates receivedAmount to be (previousAmount + newPayment)
        // So we should NOT add previousAmount again here
        const totalAmountReceived = Number(receivedAmount);

        // ENHANCED LOGGING: Payment completion tracking
        const wasPartialPayment = tempData?.previousAmount && Number(tempData.previousAmount) > 0;
        console.log(`[cryptoVerification] ✅ PAYMENT ${wasPartialPayment ? 'COMPLETED (after partial)' : 'RECEIVED (full)'}:
          - Address: ${address}
          - Transaction ID: ${transactionId}
          - Total Received: ${totalAmountReceived} ${tempCurrency}
          - Previous Payments: ${tempData?.previousAmount || 0} ${tempCurrency}
          - Was Partial: ${wasPartialPayment ? 'YES' : 'NO'}
          - Original Expected: ${tempData?.originalExpectedAmount || tempData?.amount} ${tempCurrency}`);

        // Check fee_payer mode
        const fee_payer = tempData?.fee_payer || 'company';
        const merchant_amount = tempData?.merchant_amount;
        
        let adminAmountToSend, userAmountToSend;
        
        if (fee_payer === 'customer' && merchant_amount) {
          // CUSTOMER PAYS FEES MODE
          // Customer already paid extra to cover fees
          // Merchant receives the original base amount (merchant_amount)
          // Dynopay keeps everything else (the fees)
          
          console.log(`[cryptoVerification] Customer pays fees mode:
            - Total received: ${totalAmountReceived} ${tempCurrency}
            - Merchant should receive: ${merchant_amount} ${tempCurrency}
            - Fees for Dynopay: ${Number(totalAmountReceived) - Number(merchant_amount)} ${tempCurrency}`);
          
          userAmountToSend = Number(merchant_amount);
          adminAmountToSend = Number(totalAmountReceived) - Number(merchant_amount);
          
          // Ensure we don't send negative or more than received
          if (adminAmountToSend < 0) {
            adminAmountToSend = 0;
            userAmountToSend = Number(totalAmountReceived);
          }
          if (userAmountToSend > Number(totalAmountReceived)) {
            userAmountToSend = Number(totalAmountReceived);
            adminAmountToSend = 0;
          }
        } else {
          // COMPANY PAYS FEES MODE (default)
          // Standard fee deduction from received amount
          
          // Convert crypto amount to USD for fee calculation
          const amountInUSD = await currencyConvert({
            sourceCurrency: tempCurrency,
            currency: [customerData?.base_currency || "USD"],
            amount: totalAmountReceived,
            fixedDecimal: false,
          });
          
          const { totalDeduction, minForwarding, fixedFee, transactionFee } = await calculateTransactionFees(
            tempCurrency,
            Number(amountInUSD[0].amount)  // Pass USD amount for fee calculation
          );

          console.log(`[cryptoVerification] Fee calculation DEBUG:
            - Total received (crypto): ${totalAmountReceived} ${tempCurrency}
            - Total received (USD): $${amountInUSD[0].amount}
            - Fee Breakdown:
              • Fixed Fee: $${fixedFee?.toFixed(2) || 'N/A'} (Tier-based)
              • Transaction Fee (1.5%): $${transactionFee?.toFixed(2) || 'N/A'}
            - Total deduction (USD): $${totalDeduction}
            - Min forwarding threshold: $${minForwarding}
            - Effective Fee %: ${(totalDeduction / Number(amountInUSD[0].amount) * 100).toFixed(2)}%`);

          if (Number(amountInUSD[0].amount) < Number(minForwarding)) {
            // Under threshold - all to admin
            adminAmountToSend = Number(totalAmountReceived);
            userAmountToSend = 0;
            console.log(`[cryptoVerification] UNDER THRESHOLD - all to admin: ${adminAmountToSend} ${tempCurrency}`);
          } else {
            // Normal distribution
            // Convert USD fee back to crypto amount
            const feePercentage = totalDeduction / Number(amountInUSD[0].amount);
            adminAmountToSend = Number(totalAmountReceived) * feePercentage;
            userAmountToSend = Number(totalAmountReceived) - adminAmountToSend;
            
            console.log(`[cryptoVerification] NORMAL DISTRIBUTION:
            - Admin (fees): ${adminAmountToSend.toFixed(8)} ${tempCurrency} (${(feePercentage * 100).toFixed(2)}%)
            - Merchant: ${userAmountToSend.toFixed(8)} ${tempCurrency} (${((1 - feePercentage) * 100).toFixed(2)}%)`);
          }
        }

        // ============================================
        // AUTO-STABLECOIN CONVERSION: Redirect to admin wallet if enabled
        // ============================================
        let autoConvertEnabled = false;
        let autoConvertTargetCurrency = "";
        let autoConvertSettlementAddress = "";
        let autoConvertSettlementChain = "";
        let originalUserAddress = walletData.dataValues.wallet_address;
        let originalUserAmount = userAmountToSend;
        
        // Capture platform fee in crypto BEFORE auto-convert merges it with merchant amount
        const adminFeeForConversion = adminAmountToSend;
        const platformFeeUsdForConversion = Number(totalAmountReceived) > 0 && userAmountToSend > 0
          ? adminAmountToSend * (Number(totalAmountReceived) > 0 ? 1 : 0) // Will be recalculated using actual conversion rate at payout
          : 0;

        if (
          company_data.auto_convert_enabled &&
          company_data.settlement_currency &&
          company_data.settlement_wallet_address &&
          company_data.settlement_chain &&
          isVolatileCrypto(tempCurrency) &&
          userAmountToSend > 0
        ) {
          autoConvertEnabled = true;
          autoConvertTargetCurrency = company_data.settlement_currency;
          autoConvertSettlementAddress = company_data.settlement_wallet_address;
          autoConvertSettlementChain = company_data.settlement_chain;

          // Redirect merchant portion to admin wallet (= Binance deposit address)
          // Admin wallet gets: admin fee portion + merchant portion (for conversion)
          const adminWalletAddr = getAdminWalletAddress(tempCurrency);
          if (adminWalletAddr) {
            console.log(`[AutoConvert] ✅ ACTIVE for company ${customerData.company_id}:
              - Source: ${userAmountToSend.toFixed(8)} ${tempCurrency}
              - Target: ${autoConvertTargetCurrency} on ${autoConvertSettlementChain}
              - Redirecting merchant portion to admin wallet: ${adminWalletAddr.substring(0, 12)}...
              - Merchant settlement address: ${autoConvertSettlementAddress.substring(0, 12)}...`);

            // Add merchant portion to admin portion (all goes to admin/Binance)
            adminAmountToSend = adminAmountToSend + userAmountToSend;
            userAmountToSend = 0; // Nothing goes directly to merchant

            console.log(`[AutoConvert] Updated distribution:
              - Admin total (fees + merchant): ${adminAmountToSend.toFixed(8)} ${tempCurrency}
              - Merchant direct: 0 (will receive ${autoConvertTargetCurrency} after conversion)`);
          } else {
            console.warn(`[AutoConvert] ⚠️ No admin wallet for ${tempCurrency}, falling back to normal settlement`);
            autoConvertEnabled = false;
          }
        }

        const adminTransferResult = await settleCryptoTransaction({
          tempAddressData: tempAddressData,
          receivedAmount: Number(adminAmountToSend),
          currency: tempCurrency,
          transactionId,
          ...(userAmountToSend > 0 && {
            userAmount: Number(userAmountToSend),
            userAddress: walletData.dataValues.wallet_address,
          }),
          merchantDestinationTag: walletData.dataValues.destination_tag || null,
          isMerchantPool: String(tempData.is_merchant_pool) === "true",  // Pass merchant pool flag as boolean
        });
        
        console.log(`[cryptoVerification] settleCryptoTransaction result:
          - Admin fee to retain: ${adminAmountToSend} ${tempCurrency}
          - Merchant amount sent: ${adminTransferResult.sendAmount} ${tempCurrency}
          - Merchant TX: ${adminTransferResult.transactionDetails?.txId || 'N/A'}
          - Admin fee retained for sweep: ${adminTransferResult.adminFeeRetained || 0} ${tempCurrency}
          - SmartGas funded: ${adminTransferResult.gasFunded || 0} (TX: ${adminTransferResult.gasFundingTxId || 'N/A'})
          - Is Merchant Pool: ${tempData.is_merchant_pool}
          - Auto-Convert: ${autoConvertEnabled ? 'YES' : 'NO'}
        `);

        // ============================================
        // AUTO-CONVERT: Create conversion record for Binance processing
        // ============================================
        if (autoConvertEnabled && originalUserAmount > 0) {
          try {
            const adminWalletAddr = getAdminWalletAddress(tempCurrency) || "";
            // Use receivedAmount and currencyConvert for USD value since amountInUSD is block-scoped
            let usdValue: number | undefined;
            try {
              const usdConvert = await currencyConvert({
                sourceCurrency: tempCurrency,
                currency: ["USD"],
                amount: originalUserAmount,
                fixedDecimal: false,
              });
              usdValue = usdConvert && usdConvert[0] ? Number(usdConvert[0].amount) : undefined;
            } catch { usdValue = undefined; }
            
            // FIX: Look up the integer transaction_id from tbl_user_transaction
            // transactionId here is the blockchain TX hash (hex string) — NOT the DB integer PK
            // parseInt(blockchainHash) produces a huge scientific notation number that Postgres rejects
            const txRecordId = tempData.user_tx_id || tempData.unique_tx_id || tempData.payment_id;
            let dbTransactionId: number | null = null;
            if (txRecordId) {
              const txRecord = await userTransactionModel.findOne({
                where: { id: txRecordId },
                attributes: ['transaction_id'],
                transaction,
              });
              dbTransactionId = txRecord?.dataValues?.transaction_id ?? null;
            }
            
            if (!dbTransactionId) {
              console.warn(`[AutoConvert] ⚠️ Could not resolve integer transaction_id for UUID ${txRecordId} — skipping conversion record`);
            } else {
              await createConversionRecord({
                transactionId: dbTransactionId,
                companyId: Number(customerData.company_id),
                userId: Number(customerData.adm_id),
                sourceCurrency: tempCurrency,
                sourceAmount: originalUserAmount,
                sourceAmountUsd: usdValue,
                targetCurrency: autoConvertTargetCurrency,
                settlementWalletAddress: autoConvertSettlementAddress,
                settlementChain: autoConvertSettlementChain,
                depositTxHash: adminTransferResult.transactionDetails?.txId || undefined,
                adminWalletAddress: adminWalletAddr,
                platformFeeUsd: platformFeeUsdForConversion,
                platformFeeCrypto: adminFeeForConversion,
                totalReceivedCrypto: Number(totalAmountReceived),
              });
            }

            console.log(`[AutoConvert] 📝 Conversion record created:
              - TX: ${transactionId}
              - Source: ${originalUserAmount.toFixed(8)} ${tempCurrency}
              - Target: ${autoConvertTargetCurrency} on ${autoConvertSettlementChain}
              - Immediate sweep will be triggered after address release`);
          } catch (convErr) {
            console.error(`[AutoConvert] ❌ Failed to create conversion record (non-fatal):`, convErr);
            // Non-fatal: the payment itself succeeded, conversion can be manually triggered
          }
        }

        // For UTXO chains, admin fee is sent in the same transaction
        // For account-based chains, admin fee is retained for batch sweep
        const isUTXOChain = ["BTC", "LTC", "DOGE", "BCH"].includes(tempCurrency);
        const adminFeeStatus = isUTXOChain ? "successful" : "pending_sweep";

        await adminWalletModel.increment("fee", {
          by: adminAmountToSend,
          where: { wallet_type: tempCurrency },
        });

        // Send admin fee notification email
        try {
          const adminEmail = process.env.ADMIN_EMAIL;
          if (adminEmail && adminAmountToSend > 0) {
            // RACE CONDITION FIX: Check if admin fee email already sent for this transaction
            const adminFeeEmailKey = `admin-fee-email-${transactionId}`;
            const adminFeeEmailSent = await getRedisItem(adminFeeEmailKey);
            
            if (adminFeeEmailSent && adminFeeEmailSent.sent) {
              console.log(`[Admin Fee Notification] Email already sent for tx: ${transactionId}, skipping duplicate`);
            } else {
              // Set flag immediately to prevent duplicates
              await setRedisItem(adminFeeEmailKey, { sent: true, sentAt: new Date().toISOString() });
              await setRedisTTL(adminFeeEmailKey, 86400); // 24 hour TTL
              
              const isUnderThreshold = userAmountToSend === 0 && adminAmountToSend === Number(totalAmountReceived) && !autoConvertEnabled;
              
              if (autoConvertEnabled) {
                // Auto-convert: admin gets all crypto (fee + merchant-for-conversion)
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend - originalUserAmount).toFixed(8), // actual admin fee only
                  tempCurrency,
                  transactionId,
                  company_data?.company_name || "Unknown Company",
                  Number(originalUserAmount).toFixed(8), // merchant portion pending conversion
                  Number(totalAmountReceived).toFixed(8)
                );
                console.log(`[Admin Fee Notification - AUTO-CONVERT] Sent email: fee=${(adminAmountToSend - originalUserAmount).toFixed(8)} ${tempCurrency}, merchant_for_conversion=${originalUserAmount.toFixed(8)} ${tempCurrency} from Company ${company_data?.company_id || 'N/A'}`);
              } else {
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend).toFixed(8),
                  tempCurrency,
                  transactionId,
                  company_data?.company_name || "Unknown Company",
                  Number(userAmountToSend).toFixed(8),
                  Number(totalAmountReceived).toFixed(8)
                );
                
                if (isUnderThreshold) {
                  console.log(`[Admin Fee Notification - UNDER THRESHOLD] Sent email: ${adminAmountToSend} ${tempCurrency} (100%) from Company ${company_data?.company_id || 'N/A'} - Payment below minimum threshold`);
                } else {
                  console.log(`[Admin Fee Notification] Sent email for ${adminAmountToSend} ${tempCurrency} from Company ${company_data?.company_id || 'N/A'}`);
                }
              }
            }
          }
        } catch (emailError) {
          console.error("[Admin Fee Notification] Email failed:", emailError);
          // Don't fail the whole transaction if email fails
        }

        const allTxIds = tempAddressData.txId
          ? tempAddressData.txId + "," + transactionId
          : transactionId;

        // Update address status based on whether it's merchant pool or legacy
        if (tempData.is_merchant_pool) {
          // MERCHANT POOL: Release address back to pool with admin fee tracking
          console.log(`[cryptoVerification] Releasing MERCHANT POOL address back to pool`);
          
          await merchantPoolService.releaseAddress(
            tempAddressData.temp_address_id,
            adminAmountToSend,
            adminTransferResult.blockchainFee || 0
          );
          
          // Record pool transaction for audit
          await merchantPoolService.recordPoolTransaction({
            tempAddressId: tempAddressData.temp_address_id,
            ownerUserId: tempAddressData.owner_user_id,
            companyId: Number(customerData.company_id),
            customerId: customerData.customer_id ? Number(customerData.customer_id) : undefined,
            paymentReference: transactionId,
            walletType: tempCurrency,
            paymentAmount: Number(totalAmountReceived),
            merchantAmount: Number(userAmountToSend),
            adminFeeAmount: Number(adminAmountToSend),
            gasFunded: adminTransferResult.gasFunded || 0,  // SmartGas: actual TRX/ETH funded
            gasUsed: adminTransferResult.blockchainFee || 0,
            incomingTxId: transactionId,
            merchantTxId: adminTransferResult.transactionDetails?.txId,
            status: "completed",
          });

          // AUTO-CONVERT OPTIMIZATION: Trigger immediate sweep instead of waiting for cron
          // This eliminates the 3-5 min delay (ETH_SWEEP=time:3 + 2-min cron interval)
          // Only for auto-convert payments where ALL crypto goes to admin wallet (Binance)
          if (autoConvertEnabled) {
            const sweepAddressId = tempAddressData.temp_address_id;
            console.log(`[AutoConvert] Triggering immediate sweep for address ID ${sweepAddressId} (${tempCurrency})`);

            // Fire-and-forget: don't block the payment response
            // No need to manually set IN_USE - releaseAddress() already sets correct status
            merchantPoolService.sweepPoolAddress(sweepAddressId).then(() => {
              console.log(`[AutoConvert] Immediate sweep completed for address ID ${sweepAddressId}`);
            }).catch((sweepErr: unknown) => {
              console.warn(`[AutoConvert] Immediate sweep failed (will be retried by cron):`, sweepErr instanceof Error ? sweepErr.message : sweepErr);
            });
          }
          
        } else {
          // LEGACY: Update userTempAddressModel
          await userTempAddressModel.update(
            {
              status: "successful",
              txId: allTxIds,
              adminTxId: adminTransferResult.transactionDetails?.txId || null,
              admin_status: adminFeeStatus,
              blockchain_fee: adminTransferResult.blockchainFee,
              amount: isUTXOChain ? 0 : adminAmountToSend,
              pending_admin_fee: isUTXOChain ? 0 : adminAmountToSend,
            },
            {
              where: { temp_id: tempAddressData.temp_id },
            }
          );
        }

        if (userAmountToSend > 0) {
          await userWalletModel.increment("amount", {
            by: Number(userAmountToSend),
            where: {
              wallet_id: walletData.dataValues.wallet_id,
            },
            transaction,
          });

          const userPayload = {
            wallet_id: walletData.dataValues.wallet_id,
            user_id: customerData.adm_id,
            company_id: customerData.company_id ? Number(customerData.company_id) : null,  // Multi-tenant: Include company_id
            payment_mode: tempData.mode,
            base_amount: Number(userAmountToSend).toFixed(8),
            base_currency: tempCurrency,
            transaction_reference: allTxIds,
            transaction_type: "CREDIT",
            status: "successful",
            customer_id: customerData.customer_id ? Number(customerData.customer_id) : null,
          };

          // FIX: Use user_tx_id for user transaction updates (separate from payment_id which is for payment link)
          const transactionRecordId = tempData.user_tx_id || tempData.unique_tx_id || tempData.payment_id;
          
          if (!transactionRecordId) {
            console.error(`[cryptoVerification] ⚠️  No transaction ID found in tempData - cannot update user transaction`);
          } else {
            if (tempData?.incomplete) {
              await userTransactionModel.create({
                ...userPayload,
                id: transactionRecordId,
              }, { transaction });
            } else {
              const updateResult = await userTransactionModel.update(
                { ...userPayload },
                { where: { id: transactionRecordId }, transaction }
              );
              console.log(`[cryptoVerification] Updated user transaction ${transactionRecordId}, affected rows: ${updateResult[0]}`);
              
              // If no rows affected, log warning - transaction record may not exist
              if (updateResult[0] === 0) {
                console.warn(`[cryptoVerification] ⚠️  No user transaction updated for ID ${transactionRecordId} - record may not exist`);
              }
            }
          }
        }

        let overPayment = false;
        let newAmount = [{ amount: 0 }];
        const tempAmount = Number(receivedAmount) - Number(tempData?.amount);
        if (tempAmount > 0) {
          // Convert overpayment to API key's base currency (not hardcoded USD)
          newAmount = await currencyConvert({
            sourceCurrency: tempCurrency,
            currency: [customerData?.base_currency || "USD"],  // Use API key base currency
            amount: tempAmount,
            fixedDecimal: true,
          });
          // Flag overpayment if > 5 in base currency (USD/EUR/GBP/etc.)
          // NOTE: Only applies to Payment Links (createPayment). Direct API (cryptoPayment)
          // does NOT use overpayment settings — merchant gets paid the full received amount.
          if (newAmount[0].amount > 5 && !customerData?.pathType?.includes("cryptoPayment")) {
            overPayment = true;
          }
        }

        if (customerData?.pathType?.includes("addFund") || overPayment) {
          if (customerData?.pathType?.includes("createPayment") && overPayment) {
            // FIX: Only delete subscription for legacy addresses, not merchant pool
            if (!isMerchantPoolAddress && tempAddressData.subscription_id) {
              await tatumApi.deleteSubscription(tempAddressData.subscription_id);
            }
            await transaction.commit();
            // FIXED: Use soft delete with TTL for checkout status polling
            await setRedisItem(cryptoKey, {
              ...tempData,
              status: "overpayment",
              completedAt: new Date().toISOString(),
            });
            await softDeleteRedisItem(cryptoKey, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS);
            throw {
              status: 200,
              paymentStatus: "overpayment",
              overpayment: {
                amount_crypto: tempAmount,
                currency_crypto: tempCurrency,
                amount_base: newAmount[0].amount,
                currency_base: customerData?.base_currency || "USD",
              },
              message: `Overpayment detected! ${tempAmount} ${tempCurrency} (${newAmount[0].amount} ${customerData?.base_currency || "USD"})`,
              commit: false,
            };
          } else if (customerData?.pathType?.includes("cryptoPayment") && overPayment) {
            if (customerData.customer_id) {
              await customerWalletModel.increment("amount", {
                by: Number(newAmount[0].amount),
                where: { customer_id: Number(customerData.customer_id) },
                transaction,
              });
            }
          } else {
            const finalAmount = await currencyConvert({
              sourceCurrency: tempCurrency,
              currency: [customerData?.base_currency],
              amount: totalAmountReceived,
              fixedDecimal: false,
            });
            if (customerData.customer_id) {
              await customerWalletModel.increment("amount", {
                by: Number(finalAmount[0].amount),
                where: { customer_id: Number(customerData.customer_id) },
                transaction,
              });
            }
          }
        }

        // FIXED: Update payment link status to successful
        // BUG FIX: Check for payment_id/unique_tx_id (from crypto- Redis key) OR transaction_id (from customer- Redis key)
        const linkTransactionId = tempData?.payment_id || tempData?.unique_tx_id || tempData?.transaction_id || customerData?.transaction_id;
        if (linkTransactionId) {
          console.log(`[cryptoVerification] Updating payment link status for transaction_id: ${linkTransactionId}`);
          await paymentLinkModel.update(
            {
              status: "successful",
              paid_amount: totalAmountReceived,
              paid_currency: tempCurrency,
              payment_mode: "CRYPTO",
              transaction_reference: transactionId,
            },
            {
              where: { transaction_id: linkTransactionId },
              transaction,
            }
          );
        }

        // FIX: Also update customer transaction status to match payment link status
        if (customerPayload?.id) {
          console.log(`[cryptoVerification] Updating customer transaction ${customerPayload.id} status to successful`);
          await customerTransactionModel.update(
            {
              status: "successful",
              transaction_reference: transactionId,
            },
            {
              where: { id: customerPayload.id },
              transaction,
            }
          );
        }

        // FIX: Only delete subscription for LEGACY (non-merchant-pool) addresses
        // Merchant pool addresses handle their own subscription lifecycle in releaseAddress()
        // Deleting here would remove the subscription that was just renewed in releaseAddress()
        if (!isMerchantPoolAddress && tempAddressData.subscription_id) {
          console.log(`[cryptoVerification] Deleting subscription for legacy address: ${tempAddressData.subscription_id}`);
          await tatumApi.deleteSubscription(tempAddressData.subscription_id);
        } else if (isMerchantPoolAddress) {
          console.log(`[cryptoVerification] Skipping subscription delete for merchant pool address (handled by releaseAddress)`);
        }
        
        await transaction.commit();
        
        // PHASE 12: Clear incomplete_payment and active_crypto_address from customer Redis key on successful completion
        const customerRef = tempData.ref;
        if (customerRef) {
          const customerRedisData = await getRedisItem("customer-" + customerRef);
          if (customerRedisData && (customerRedisData.incomplete_payment || customerRedisData.active_crypto_address)) {
            const { incomplete_payment, active_crypto_address, ...cleanCustomerData } = customerRedisData;
            await setRedisItem("customer-" + customerRef, cleanCustomerData);
            console.log(`[Phase 12] Cleared incomplete_payment and active_crypto_address from customer-${customerRef} on successful completion`);
          }
        }
        
        // FIXED: Use soft delete with 30-min TTL to allow checkout polling for status
        // Update status to successful before soft delete
        await setRedisItem(tempData.ref, {
          ...tempData,
          status: "successful",
          completedAt: new Date().toISOString(),
        });
        await setRedisItem(cryptoKey, {
          ...tempData,
          status: "successful",
          completedAt: new Date().toISOString(),
        });
        await softDeleteRedisItem(tempData.ref, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS); // 30 minutes TTL
        await softDeleteRedisItem(cryptoKey, PAYMENT_TIMING.REDIS_SOFT_DELETE_TTL_SECONDS); // 30 minutes TTL

        if (webhook) {
          // FIXED: Use callMerchantWebhook instead of legacy callWebHook
          // callMerchantWebhook properly looks up webhook_url from payment_link or company
          const { company_id, customer_id } = customerPayload;
          
          // ENHANCED WEBHOOK: Calculate fee in USD for merchant transparency
          let totalFeeUsd = 0;
          try {
            const feeInUsd = await currencyConvert({
              sourceCurrency: tempCurrency,
              currency: [customerData?.base_currency || "USD"],
              amount: adminAmountToSend,
              fixedDecimal: false,
            });
            totalFeeUsd = Number(feeInUsd[0]?.amount || 0);
          } catch (feeConvertError) {
            console.warn("[cryptoVerification] Fee USD conversion failed:", feeConvertError.message);
          }
          
          // Build enhanced webhook payload with all relevant fields for developers
          // Determine payment type based on whether link_id exists
          const linkId = customerData?.link_id || tempData?.link_id || null;
          const paymentType = linkId ? 'payment_link' : 'direct_api';
          
          // FIX: Use the original payment link's transaction_id as payment_id (consistent with pending webhook)
          // customerPayload.id is a new UUID for the internal transaction record — NOT the payment link reference
          const webhookPaymentId = tempData?.payment_id || tempData?.unique_tx_id || customerData?.transaction_id || customerPayload.id;
          
          const enhancedWebhookPayload: Record<string, unknown> = {
            // Core payment info
            event: "payment.confirmed",
            payment_type: paymentType,
            payment_id: webhookPaymentId,
            transaction_reference: transactionId,
            status: customerPayload.status,
            
            // Amount received (crypto) — use original merchant amount if auto-converting
            amount: autoConvertEnabled ? originalUserAmount : userAmountToSend,
            currency: tempCurrency,
            
            // Original payment request (fiat)
            base_amount: customerData?.base_amount,
            base_currency: customerData?.base_currency,
            
            // ENHANCED: Merchant receives (net after fees)
            merchant_amount: autoConvertEnabled ? originalUserAmount : userAmountToSend,
            
            // ENHANCED: Fee information — show actual fee, not fee+merchant when auto-converting
            total_fee: autoConvertEnabled ? (adminAmountToSend - originalUserAmount) : adminAmountToSend,
            total_fee_usd: Number(totalFeeUsd.toFixed(2)),
            fee_payer: tempData?.fee_payer || customerData?.fee_payer || 'company',
            
            // Auto-conversion info (if applicable)
            ...(autoConvertEnabled ? {
              auto_convert: true,
              converting_to: autoConvertTargetCurrency,
              settlement_chain: autoConvertSettlementChain,
              merchant_crypto_pending_conversion: originalUserAmount,
            } : {}),
            
            // ENHANCED: Customer & payment link details
            customer_name: customerData?.customer_name || tempData?.customer_name || null,
            customer_email: customerData?.email || tempData?.email || null,
            description: customerData?.description || tempData?.description || null,
            link_id: linkId,
            
            // ENHANCED: Tax information (if applicable)
            tax_info: (tempData?.tax_enabled === "true" || tempData?.tax_enabled === true) ? {
              tax_amount_usd: Number(tempData?.tax_amount_usd || 0),
              tax_amount_crypto: Number(tempData?.tax_amount_crypto || 0),
              tax_rate: Number(tempData?.tax_rate || 0),
              tax_country_code: tempData?.tax_country_code || null,
            } : null,
            
            // ENHANCED: Overpayment detection (if applicable)
            overpayment: tempAmount > 0 ? {
              amount_crypto: tempAmount,
              amount_usd: Number(newAmount[0]?.amount || 0),
            } : null,
            
            // Metadata & timestamp
            meta_data: customerData?.meta_data ? JSON.parse(customerData.meta_data) : null,
            completed_at: new Date().toISOString(),
          };
          
          try {
            const webhookResult = await callMerchantWebhook(customerData, enhancedWebhookPayload);
            if (webhookResult.success) {
              console.log("[cryptoVerification] ✅ Merchant webhook sent successfully");
            } else {
              console.error(`[cryptoVerification] ❌ Merchant webhook failed: ${webhookResult.error}`);
              if (webhookResult.url) {
                console.error(`[cryptoVerification] Failed URL: ${webhookResult.url}`);
              }
            }
            console.log(`[cryptoVerification] Webhook payload: merchant_amount=${autoConvertEnabled ? originalUserAmount : userAmountToSend}, total_fee=${autoConvertEnabled ? (adminAmountToSend - originalUserAmount) : adminAmountToSend}, fee_payer=${enhancedWebhookPayload.fee_payer}${autoConvertEnabled ? `, auto_convert=${autoConvertTargetCurrency}` : ''}`);
          } catch (webhookError) {
            console.error("[cryptoVerification] Merchant webhook failed:", webhookError.message);
            // Don't fail the transaction if webhook fails
          }
        } else {
          let resData;
          if (customerData?.redirect_uri) {
            resData = customerData.redirect_uri +
              `?transaction_id=${customerPayload.id}&status=${customerPayload.status}&meta_data=${customerData?.meta_data ?? null}&payment_type=CRYPTO`;
          } else {
            resData = {
              transaction_id: customerPayload.id,
              transaction_reference: transactionId,
              status: customerPayload.status,
            };
          }

          return {
            status: 200,
            message: `Transaction ${customerPayload?.status}!`,
            paymentStatus: "complete",
            resData,
            ...(tempAmount > 0 && {
              overpayment: {
                detected: true,
                amount_crypto: tempAmount,
                currency_crypto: tempCurrency,
                amount_base: newAmount[0].amount,
                currency_base: customerData?.base_currency || "USD",
              }
            })
          };
        }

        // Get user data for notifications
        const userData = (
          await userModel.findOne({
            where: { user_id: customerData.adm_id },
          })
        )?.dataValues;

        // RACE CONDITION FIX: Check if payment received email already sent for this transaction
        const paymentReceivedEmailKey = `payment-received-email-${transactionId}`;
        const paymentReceivedEmailSent = await getRedisItem(paymentReceivedEmailKey);
        
        if (paymentReceivedEmailSent && paymentReceivedEmailSent.sent) {
          console.log(`[cryptoVerification] Payment received email already sent for tx: ${transactionId}, skipping duplicate`);
        } else {
          // Set flag immediately to prevent duplicates
          await setRedisItem(paymentReceivedEmailKey, { sent: true, sentAt: new Date().toISOString() });
          await setRedisTTL(paymentReceivedEmailKey, 86400); // 24 hour TTL
          
          // Send email notification for payment received
          const companyName = company_data?.company_name ?? "";
          const paymentDateTime = new Date();
          const paymentDateStr = paymentDateTime.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          const paymentTimeStr = paymentDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          
          // When auto-convert is ON, show the original merchant amount (before redirect to admin)
          // Merchant will receive USDT equivalent, not 0 ETH
          const emailAmount = autoConvertEnabled ? originalUserAmount.toString() : userAmountToSend.toString();
          const emailCurrency = autoConvertEnabled ? `${tempCurrency} (converting to ${autoConvertTargetCurrency})` : tempCurrency;
          
          await sendPaymentReceivedEmail(
            userData?.email,
            userData?.name,
            emailAmount,             // original merchant amount (not 0)
            emailCurrency,           // e.g., "ETH (converting to USDT)"
            companyName,             // companyName
            transactionId,           // transactionId
            paymentDateStr,          // date
            paymentTimeStr           // time
          );
        }

        // Get company name for notifications (used below)
        const companyName = company_data?.company_name ?? "";

        // Send large transaction alert if amount > $1000 USD equivalent
        const baseAmount = customerData?.base_amount || tempData?.base_amount || 0;
        const LARGE_TRANSACTION_THRESHOLD = 1000;
        if (parseFloat(baseAmount) >= LARGE_TRANSACTION_THRESHOLD) {
          try {
            const { sendLargeTransactionAlertEmail } = await import("../services/emailService");
            const customerEmail = customerData?.email || tempData?.email || null;
            await sendLargeTransactionAlertEmail(
              userData?.email,
              userData?.name || 'Merchant',
              `${baseAmount}`,
              customerData?.base_currency || 'USD',
              totalAmountReceived.toString(),
              tempCurrency,
              customerEmail,
              transactionId,
              companyName
            );
            console.log(`[cryptoVerification] Large transaction alert sent to ${userData?.email} for $${baseAmount}`);
          } catch (largeAlertError) {
            console.error("[cryptoVerification] Failed to send large transaction alert:", largeAlertError);
          }
        }

        // Create in-app notification for payment received
        await createNotification(
          customerData.adm_id,
          NOTIFICATION_TYPES.PAYMENT_RECEIVED,
          "Payment Received",
          `Your company ${companyName} received ${userAmountToSend} ${tempCurrency}`,
          {
            amount: userAmountToSend,
            currency: tempCurrency,
            transaction_id: transactionId,
            company_name: companyName,
            company_id: company_data?.company_id,
          },
          company_data?.company_id
        );

        // Send payment confirmation email to customer (the payer)
        // Get customer email from payment link or customerData
        try {
          const customerEmail = customerData?.email || tempData?.email;
          if (customerEmail && customerEmail.trim() !== "") {
            // DUPLICATE PREVENTION: Check if customer receipt email already sent
            const customerReceiptKey = `customer-receipt-email-${transactionId}`;
            const customerReceiptSent = await getRedisItem(customerReceiptKey);
            
            if (customerReceiptSent && customerReceiptSent.sent) {
              console.log(`[cryptoVerification] Customer receipt email already sent for tx: ${transactionId}, skipping duplicate`);
            } else {
              // Set flag immediately to prevent duplicates
              await setRedisItem(customerReceiptKey, { sent: true, sentAt: new Date().toISOString() });
              await setRedisTTL(customerReceiptKey, 86400); // 24 hour TTL
              
              const paymentDate = new Date();
              const description = customerData?.description || tempData?.description || null;
              const baseAmount = customerData?.base_amount || tempData?.base_amount;
              const baseCurrency = customerData?.base_currency || tempData?.base_currency || "USD";
              
              await sendCustomerPaymentConfirmationEmail(
                customerEmail,
                null, // Customer name often not available
                companyName,
                `${baseAmount}`,
                baseCurrency,
                customerPayload.id || transactionId,
                description,
                paymentDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                paymentDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                totalAmountReceived.toString(), // Crypto amount
                tempCurrency, // Crypto currency
                transactionId // Blockchain transaction reference
              );
              console.log(`[cryptoVerification] Customer payment confirmation email sent to ${customerEmail} with PDF receipt`);
            }
          } else {
            console.log(`[cryptoVerification] No customer email available for payment confirmation`);
          }
        } catch (customerEmailError: unknown) {
          const err = customerEmailError as { message?: string };
          console.error("[cryptoVerification] Customer payment confirmation email failed:", err.message);
          // Don't fail the transaction if email fails
        }
      }
    } else {
      let currency = tempCurrency;
      if (!currency) {
        const data = await userTempAddressModel.findOne({
          where: { wallet_address: address },
        });
        currency = data.dataValues.wallet_type;
      }
      const paymentStatus = await tatumApi.getCurrentPaymentStatus(address, currency);
      transaction.rollback();
      return paymentStatus;
    }
  } catch (e) {
    const { commit, ...restData } = e;
    const message = getErrorMessage(e);
    if (e?.commit) {
      transaction.commit();
    } else {
      transaction.rollback();
      console.log(e);
    }
    apiLogger.error(message, new Error(e));
    return { status: e?.status ?? 500, message, resData: restData };
  }
};

// timer function removed - not used

const userWallet = async (data: IFundData, tokenData: IUserType) => {
  const id = tokenData.id;
  
  // Handle both UUID id and customer_id cases
  let customer_id: number;
  if (tokenData.customer_id) {
    // If customer_id is available in token, use it directly
    customer_id = typeof tokenData.customer_id === 'string' ? parseInt(tokenData.customer_id, 10) : tokenData.customer_id;
  } else {
    // Otherwise, look up by id (UUID)
    const customer = await customerModel.findOne({ where: { id } });
    if (!customer) {
      throw { message: "Customer not found" };
    }
    customer_id = customer.dataValues.customer_id;
  }
  const walletData = (
    await customerWalletModel.findOne({
      where: { customer_id },
    })
  ).dataValues;

  if (walletData.amount < data.amount) {
    throw { message: "Insufficient Balance!" };
  } else {
    await customerWalletModel.update(
      {
        amount: Number(Number(walletData.amount) - Number(data.amount)).toFixed(
          2
        ),
      },
      {
        where: { customer_id },
      }
    );
    return true;
  }
};

const getCurrencyRates = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { source, amount, currencyList, fixedDecimal = true, fee_payer = 'company', tax_amount = 0 } = req.body;

    console.log(`[getCurrencyRates] Request params: amount=${amount}, source=${source}, fee_payer=${fee_payer}, tax_amount=${tax_amount}`);

    // Convert source amount to USD if needed (for fee tier calculation)
    let amountUSD = amount;
    if (source && source !== 'USD') {
      try {
        const usdConversion = await currencyConvert({
          sourceCurrency: source,
          currency: ['USD'],
          amount: amount,
          fixedDecimal: true,
        });
        amountUSD = Number(usdConversion[0]?.amount || amount);
        console.log(`[getCurrencyRates] Converted ${amount} ${source} → ${amountUSD.toFixed(2)} USD for fee calculation`);
      } catch (conversionError) {
        console.warn(`[getCurrencyRates] USD conversion failed, using original amount:`, conversionError);
      }
    }

    const currencyRateList = await currencyConvert({
      sourceCurrency: source,
      currency: currencyList,
      amount,
      fixedDecimal,
    });
    
    // If customer pays fees, calculate total amounts including all fees
    if (fee_payer === 'customer') {
      console.log(`[getCurrencyRates] Customer pays fees - calculating enhanced rates with fees`);
      
      // Pre-fetch all blockchain fees in parallel for better performance
      const allBlockchainFees = await getAllBlockchainFees();
      console.log(`[getCurrencyRates] Pre-fetched blockchain fees for ${Object.keys(allBlockchainFees).length} chains`);
      
      const enhancedRates = await Promise.all(
        currencyRateList.map(async (rate: { currency: string; amount: number; transferRate?: number }) => {
          try {
            // Check if this is a fiat currency (not crypto)
            const fiatCurrencies = ['USD', 'EUR', 'GBP', 'CNY', 'JPY', 'AUD', 'CAD', 'CHF', 'HKD', 'NZD', 'SGD', 'NGN', 'KES', 'UGX', 'RWF', 'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU', 'ZAR', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF'];
            if (fiatCurrencies.includes(rate.currency.toUpperCase())) {
              // For fiat currencies, use a default crypto (ETH) to calculate fees
              // This gives us the USD equivalent fees to display
              const chain = 'ETH';
              console.log(`[getCurrencyRates] Processing fiat ${rate.currency} - using ${chain} for fee calculation`);
              
              // Use pre-fetched fees instead of individual API call
              const networkFee = allBlockchainFees[chain] || await getBlockchainNetworkFee(chain);
              // Use USD amount for fee tier calculation
              const feeResult = await calculateTransactionFees(chain, amountUSD);
              
              const fixedFee = Number(feeResult.fixedFee) || 0;
              const transactionFee = Number(feeResult.transactionFee) || 0;
              const networkFeeUSD = Number(networkFee.feeInUSD) || 0;
              
              const totalFeesUSD = fixedFee + transactionFee + networkFeeUSD;
              const taxAmountNum = Number(tax_amount) || 0;
              
              // Round all amounts to 2 decimal places for consistency
              const roundedTotalFeesUSD = parseFloat(totalFeesUSD.toFixed(2));
              const roundedTotalAmountUSD = parseFloat((amountUSD + roundedTotalFeesUSD + taxAmountNum).toFixed(2));
              
              // Get the exchange rate and convert fees/tax to target currency
              const exchangeRate = Number(rate.transferRate) || 1;
              const convertedBaseAmount = Number(rate.amount) || 0;
              const convertedTotalFees = parseFloat((roundedTotalFeesUSD * exchangeRate).toFixed(2));
              const convertedTaxAmount = parseFloat((taxAmountNum * exchangeRate).toFixed(2));
              const convertedTotalAmount = parseFloat((roundedTotalAmountUSD * exchangeRate).toFixed(2));
              
              // Convert total back to source currency for total_amount_source
              const usdToSourceRate = amountUSD > 0 ? amount / amountUSD : 1;
              const totalAmountSourceCurrency = parseFloat((roundedTotalAmountUSD * usdToSourceRate).toFixed(2));
              
              console.log(`[getCurrencyRates] ${rate.currency} (fiat): base=${amount} ${source} ($${amountUSD.toFixed(2)} USD) = ${convertedBaseAmount} ${rate.currency}, tax=$${taxAmountNum.toFixed(2)} USD = ${convertedTaxAmount} ${rate.currency}, fees=$${roundedTotalFeesUSD.toFixed(2)} USD = ${convertedTotalFees} ${rate.currency}, total=$${roundedTotalAmountUSD.toFixed(2)} USD (=${totalAmountSourceCurrency.toFixed(2)} ${source}) = ${convertedTotalAmount} ${rate.currency}`);
              
              return {
                ...rate,
                fee_payer: 'customer',
                base_amount: parseFloat(amount.toFixed(2)),       // Original amount in source currency
                base_amount_usd: parseFloat(amountUSD.toFixed(2)), // Converted to USD
                // Include tax in breakdown (converted to target currency)
                tax_amount: convertedTaxAmount,
                tax_amount_usd: parseFloat(taxAmountNum.toFixed(2)),
                // Simplified - only show total processing fee (converted to target currency)
                processing_fee: convertedTotalFees,
                processing_fee_usd: roundedTotalFeesUSD,
                total_amount: convertedTotalAmount,
                // IMPORTANT: Checkout reads total_amount_usd first and multiplies by transferRate (1 for same currency)
                // So total_amount_usd MUST be in source currency for correct display
                total_amount_usd: totalAmountSourceCurrency,
                total_amount_source: totalAmountSourceCurrency, // Total in SOURCE currency (e.g., EUR) for display
                // Use the properly converted amount for display
                amount: convertedTotalAmount,
              };
            }
            
            // Map currency to chain name for fee calculation
            let chain = rate.currency.replace('-', '_').toUpperCase();
            
            // Handle special cases where currency name differs from chain name
            const chainMapping: Record<string, string> = {
              'USDT': 'USDT_TRC20',  // Default USDT to TRC20
              'USDC': 'USDC_ERC20',  // Default USDC to ERC20
            };
            chain = chainMapping[chain] || chain;
            
            console.log(`[getCurrencyRates] Processing ${rate.currency} -> chain: ${chain}`);
            
            const cryptoPrice = Number(rate.amount) > 0 ? amountUSD / Number(rate.amount) : 0;
            
            // Use pre-fetched network fee if available, fallback to individual fetch
            const networkFee = allBlockchainFees[chain] || await getBlockchainNetworkFee(chain);
            // Use USD amount for fee tier calculation
            const feeResult = await calculateTransactionFees(
              chain,
              amountUSD
            );
            
            // Ensure all fee values are valid numbers (protection against NaN/undefined)
            const fixedFee = Number(feeResult.fixedFee) || 0;
            const transactionFee = Number(feeResult.transactionFee) || 0;
            const networkFeeUSD = Number(networkFee.feeInUSD) || 0;
            
            // Calculate totals including tax - round USD amounts to 2 decimals for consistency
            const totalFeesUSD = fixedFee + transactionFee + networkFeeUSD;
            const roundedTotalFeesUSD = parseFloat(totalFeesUSD.toFixed(2));
            const taxAmountNum = Number(tax_amount) || 0;
            const totalAmountUSD = amountUSD + roundedTotalFeesUSD + taxAmountNum;
            const roundedTotalAmountUSD = parseFloat(totalAmountUSD.toFixed(2));
            const totalAmountCrypto = cryptoPrice > 0 ? roundedTotalAmountUSD / cryptoPrice : 0;
            
            // Convert total back to source currency (e.g., EUR) for display
            // Use the ratio: source_amount / usd_amount to convert USD totals back to source currency
            const usdToSourceRate = amountUSD > 0 ? amount / amountUSD : 1;
            const totalAmountSource = parseFloat((roundedTotalAmountUSD * usdToSourceRate).toFixed(2));
            const processingFeeSource = parseFloat((roundedTotalFeesUSD * usdToSourceRate).toFixed(2));
            const taxAmountSource = parseFloat((taxAmountNum * usdToSourceRate).toFixed(2));
            
            console.log(`[getCurrencyRates] ${rate.currency}: base=${amount} ${source} ($${amountUSD.toFixed(2)} USD), tax=$${taxAmountNum.toFixed(2)}, fees=$${roundedTotalFeesUSD.toFixed(2)}, total=$${roundedTotalAmountUSD.toFixed(2)} USD (=${totalAmountSource.toFixed(2)} ${source})`);
            
            return {
              ...rate,
              fee_payer: 'customer',
              base_amount: Number(rate.amount),
              base_amount_usd: parseFloat(amountUSD.toFixed(2)),
              // Include tax in breakdown (converted to source currency)
              tax_amount: taxAmountSource,
              tax_amount_usd: parseFloat(taxAmountNum.toFixed(2)),
              // Simplified - only show total processing fee (converted to source currency)
              processing_fee: processingFeeSource,
              processing_fee_usd: roundedTotalFeesUSD,
              total_amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto,
              // IMPORTANT: Checkout reads total_amount_usd first and multiplies by transferRate (1 for same currency)
              // So total_amount_usd MUST be in source currency for correct display
              total_amount_usd: totalAmountSource,
              total_amount_source: totalAmountSource, // Total in SOURCE currency (e.g., EUR) for display
              amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto, // Override amount with total
            };
          } catch (feeError: unknown) {
            console.error(`[getCurrencyRates] Fee calc error for ${rate.currency}:`, getErrorMessage(feeError));
            return {
              ...rate,
              fee_payer: 'customer',
              fee_error: 'Could not calculate fees',
            };
          }
        })
      );
      
      return successResponseHelper(res, 200, "Exchange rates retrieved successfully", enhancedRates);
    }

    // Default: company pays fees (original behavior)
    successResponseHelper(res, 200, "Exchange rates retrieved successfully", currencyRateList);
  } catch (e) {
    const message = getErrorMessage(e);
    errorResponseHelper(res, 500, message);
  }
};

const getBalance = async (_req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  try {
    const customer = await customerModel.findOne({
      where: {
        id: userData.user_id,
      },
    });

    if (!customer) {
      return errorResponseHelper(res, 404, "Customer not found");
    }

    const customerData = await customerWalletModel.findOne({
      where: {
        customer_id: (customer as { dataValues: { customer_id: string } }).dataValues.customer_id,
      },
    });

    if (!customerData) {
      return errorResponseHelper(res, 404, "Customer wallet not found");
    }

    const walletData = (customerData as { dataValues: { amount: number; wallet_type: string } }).dataValues;

    successResponseHelper(res, 200, "Balance retrieved successfully", {
      amount: walletData.amount.toFixed(2),
      currency: walletData.wallet_type,
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.user_id, email: userData.email },
      new Error(e instanceof Error ? e.message : String(e))
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const createPaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  
  // Extract both old and new field names for backward compatibility
  // IMPORTANT: Client should send EITHER new format OR legacy format, not both
  // If both provided, new format (base_*) takes priority
  const { 
    email, 
    base_currency,    // NEW format (recommended)
    currency,         // LEGACY format (backward compatibility)
    modes, 
    amount,           // LEGACY format (backward compatibility)
    base_amount,      // NEW format (recommended)
    description,
    expire,
    callback_url,
    redirect_url,
    webhook_url,
    fee_payer,        // Who pays blockchain fees: 'customer' or 'company'
    company_id,       // Phase 10 Fix: Accept company_id for multi-tenant isolation
    apply_tax,        // Tax toggle: calculate tax based on customer location (default: false)
    accepted_currencies, // Array of crypto types to accept (e.g., ['BTC', 'ETH', 'USDT-TRC20'])
    // Fixed tax parameters (alternative to apply_tax location-based)
    // tax_percentage and tax_name removed - not used in this function
    name              // Customer name
  } = req.body;
  
  // Normalize field names - use new format first, fall back to legacy, then default
  // Priority: base_currency > currency > 'USD'
  const normalizedCurrency = base_currency || currency || 'USD';
  // Priority: base_amount > amount
  const normalizedAmount = base_amount || amount;
  
  try {
    // Validate required fields with clear error messages
    if (!normalizedAmount) {
      return errorResponseHelper(
        res, 
        400, 
        "Amount is required. Please provide either 'amount' or 'base_amount' field."
      );
    }
    
    // Validate amount is positive
    if (normalizedAmount <= 0) {
      return errorResponseHelper(
        res,
        400,
        "Amount must be greater than zero."
      );
    }
    
    // Validate email format if provided
    if (email && email.trim() !== "" && !email.includes('@')) {
      return errorResponseHelper(
        res,
        400,
        "Invalid email format. Please provide a valid email address."
      );
    }
    
    // Validate modes if provided
    if (modes) {
      const validModes = ['CRYPTO', 'CARD', 'BANK_TRANSFER', 'GOOGLE_PAY', 'APPLE_PAY', 'USSD', 'MOBILE_MONEY', 'QR_CODE'];
      const invalidModes = modes.filter((mode: string) => !validModes.includes(mode.toUpperCase()));
      
      if (invalidModes.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `Invalid payment modes: ${invalidModes.join(', ')}. Valid modes are: ${validModes.join(', ')}`
        );
      }
      
      // Convert to uppercase if lowercase provided
      const normalizedModes = modes.map((mode: string) => mode.toUpperCase());
      req.body.modes = normalizedModes;
    }
    
    // Validate expire format if provided
    if (expire && expire !== 'No' && !['24h', '7d', '30d'].includes(expire)) {
      return errorResponseHelper(
        res,
        400,
        "Invalid expire value. Valid options are: '24h', '7d', '30d', or 'No'."
      );
    }
    
    // Phase 10 Fix: Validate company_id if provided
    if (company_id) {
      const companyExists = await companyModel.findOne({
        where: {
          company_id,
          user_id: userData.user_id,
        },
      });
      
      if (!companyExists) {
        return errorResponseHelper(
          res,
          400,
          "Invalid company_id or company does not belong to this user"
        );
      }
    }
    
    // ========================================
    // KYC ENFORCEMENT: Block payment creation if KYC required but not approved
    // Threshold: $10,000 USD with 90-day grace period
    // ========================================
    const kycWhereClause: Record<string, unknown> = {
      user_id: userData.user_id,
    };
    if (company_id) {
      kycWhereClause.company_id = company_id;
    }
    
    // Calculate total transaction volume
    const volumeQuery = company_id
      ? `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
         FROM tbl_customer_transaction 
         WHERE company_id = :companyId AND status = 'successful'`
      : `SELECT COALESCE(SUM(CAST(base_amount AS DECIMAL)), 0) as total_volume 
         FROM tbl_customer_transaction 
         WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) AND status = 'successful'`;
    
    const volumeResult = await sequelize.query<{ total_volume: string }>(
      volumeQuery,
      {
        replacements: { userId: userData.user_id, companyId: company_id },
        type: QueryTypes.SELECT,
      }
    );
    
    const totalVolume = parseFloat(String(volumeResult[0]?.total_volume || "0"));
    const kycThreshold = 10000; // $10,000 USD threshold
    const kycGracePeriodDays = 90; // 90-day grace period after threshold reached
    
    // Store KYC warning for in-app display
    let kycWarning: {
      type: string;
      message: string;
      days_remaining: number;
      threshold_date: string;
      grace_period_end: string;
      kyc_status: string;
      verification_url: string | null;
      api_endpoint: string;
      has_active_session: boolean;
    } | null = null;
    
    if (totalVolume >= kycThreshold) {
      // KYC is required - check if it's approved
      const kycRecord = await kycModel.findOne({
        where: kycWhereClause,
        order: [["created_at", "DESC"]],
      });
      
      const kycStatus = kycRecord ? kycRecord.get("status") as string : "not_started";
      
      // Get existing Veriff session URL if available
      const veriffSessionUrl = kycRecord ? kycRecord.get("veriff_session_url") as string | null : null;
      const hasActiveSession = veriffSessionUrl && ["submitted", "pending"].includes(kycStatus);
      
      if (kycStatus !== "approved") {
        // Check if we're still within the 90-day grace period
        // Get the date when threshold was first reached (first transaction that pushed over threshold)
        const thresholdReachedQuery = company_id
          ? `SELECT MIN("createdAt") as threshold_date
             FROM (
               SELECT "createdAt", 
                      SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
               FROM tbl_customer_transaction 
               WHERE company_id = :companyId AND status = 'successful'
             ) sub
             WHERE running_total >= :threshold`
          : `SELECT MIN("createdAt") as threshold_date
             FROM (
               SELECT "createdAt", 
                      SUM(CAST(base_amount AS DECIMAL)) OVER (ORDER BY "createdAt") as running_total
               FROM tbl_customer_transaction 
               WHERE company_id IN (SELECT company_id FROM tbl_company WHERE user_id = :userId) AND status = 'successful'
             ) sub
             WHERE running_total >= :threshold`;
        
        const thresholdResult = await sequelize.query<{ threshold_date: string }>(
          thresholdReachedQuery,
          {
            replacements: { userId: userData.user_id, companyId: company_id, threshold: kycThreshold },
            type: QueryTypes.SELECT,
          }
        );
        
        const thresholdDate = thresholdResult[0]?.threshold_date ? new Date(thresholdResult[0].threshold_date) : null;
        const now = new Date();
        
        if (thresholdDate) {
          const gracePeriodEnd = new Date(thresholdDate);
          gracePeriodEnd.setDate(gracePeriodEnd.getDate() + kycGracePeriodDays);
          
          const daysRemaining = Math.ceil((gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (now < gracePeriodEnd) {
            // Still within grace period - allow but set warning for in-app display
            console.log(`[KYC GRACE PERIOD] User ${userData.user_id} within grace period. Volume: $${totalVolume.toFixed(2)}, KYC status: ${kycStatus}, Days remaining: ${daysRemaining}`);
            
            // Set in-app warning
            const urgencyType = daysRemaining <= 14 ? "critical" : daysRemaining <= 30 ? "warning" : "info";
            kycWarning = {
              type: urgencyType,
              message: daysRemaining <= 14 
                ? `URGENT: Only ${daysRemaining} days left to complete KYC verification! Your account will be restricted after ${gracePeriodEnd.toLocaleDateString()}.`
                : daysRemaining <= 30
                ? `Warning: ${daysRemaining} days remaining to complete KYC verification before your account is restricted.`
                : `KYC verification required within ${daysRemaining} days. Your transaction volume ($${totalVolume.toLocaleString()}) has exceeded the $${kycThreshold.toLocaleString()} threshold.`,
              days_remaining: daysRemaining,
              threshold_date: thresholdDate.toISOString(),
              grace_period_end: gracePeriodEnd.toISOString(),
              kyc_status: kycStatus,
              // If merchant has an active Veriff session, use that URL; otherwise null
              verification_url: hasActiveSession ? veriffSessionUrl : null,
              api_endpoint: "/api/kyc/submit",
              has_active_session: !!hasActiveSession,
            };
          } else {
            // Grace period expired - block
            console.log(`[KYC BLOCK] User ${userData.user_id} grace period expired. Volume: $${totalVolume.toFixed(2)}, KYC status: ${kycStatus}, Grace period ended: ${gracePeriodEnd.toISOString()}`);
            
            return errorResponseHelper(
              res,
              403,
              `KYC verification required. Your transaction volume ($${totalVolume.toFixed(2)}) exceeded the $${kycThreshold.toLocaleString()} threshold on ${thresholdDate.toLocaleDateString()}. Your 90-day grace period has expired. Please complete KYC verification to continue creating payment links. Current KYC status: ${kycStatus}. [KYC_REQUIRED]`
            );
          }
        } else {
          // Couldn't determine threshold date - be lenient, allow but log warning
          console.warn(`[KYC WARNING] Could not determine threshold date for user ${userData.user_id}. Allowing payment creation.`);
        }
      } else {
        console.log(`[KYC OK] User ${userData.user_id} KYC approved. Volume: $${totalVolume.toFixed(2)}`);
      }
    }
    // ========================================
    // END KYC ENFORCEMENT
    // ========================================
    
    // Phase 11: Validate at least one crypto wallet is configured for this company
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    
    const walletWhereClause: Record<string, unknown> = {
      user_id: userData.user_id,
      wallet_type: { [Op.in]: cryptoTypes },
      wallet_address: { [Op.not]: null },
    };
    
    // If company_id is provided, filter by company_id
    if (company_id) {
      walletWhereClause.company_id = company_id;
    }
    
    const configuredWallets = await userWalletModel.findAll({
      where: walletWhereClause,
      attributes: ['wallet_type'],
    });
    
    if (configuredWallets.length === 0) {
      return errorResponseHelper(
        res,
        400,
        "No crypto wallet configured. Please add at least one crypto wallet address before creating a payment link."
      );
    }
    
    // Get unique list of ALL configured currencies for this company
    const allConfiguredCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
    console.log(`[Phase 11] All configured currencies for company_id ${company_id}:`, allConfiguredCurrencies);
    
    // Validate and process accepted_currencies if provided
    let finalAcceptedCurrencies: string[] = allConfiguredCurrencies; // Default: all configured
    let acceptedCurrenciesString: string | null = null;
    
    if (accepted_currencies && Array.isArray(accepted_currencies) && accepted_currencies.length > 0) {
      // Normalize to uppercase
      const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
      
      // Validate all requested currencies are valid crypto types
      const invalidCryptos = requestedCurrencies.filter((c: string) => !cryptoTypes.includes(c));
      if (invalidCryptos.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `Invalid cryptocurrency types: ${invalidCryptos.join(', ')}. Valid options: ${cryptoTypes.join(', ')}`
        );
      }
      
      // Validate all requested currencies have configured wallets
      const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
      if (unconfiguredCurrencies.length > 0) {
        return errorResponseHelper(
          res,
          400,
          `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Please configure wallets first or select from available currencies: ${allConfiguredCurrencies.join(', ')}`
        );
      }
      
      // Use the merchant's selected currencies
      finalAcceptedCurrencies = requestedCurrencies;
      acceptedCurrenciesString = requestedCurrencies.join(',');
      console.log(`[createPaymentLink] Merchant selected currencies: ${acceptedCurrenciesString}`);
    } else {
      console.log(`[createPaymentLink] No currencies specified, using all configured: ${allConfiguredCurrencies.join(',')}`);
    }
    
    const uniqueRef = crypto.randomBytes(24).toString("hex");
    console.log("userData============>", userData);
    
    // Calculate expires_at based on expire option
    // DEFAULT: 7 days if not specified (for security and cleanup)
    let expires_at = null;
    const now = new Date();
    
    if (expire === "No") {
      // Explicitly set to never expire
      expires_at = null;
    } else if (expire === "24h") {
      expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (expire === "30d") {
      expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      // Default to 7 days if not specified or explicitly set to "7d"
      expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    
    // company_id is REQUIRED - validate it exists
    if (!company_id) {
      return errorResponseHelper(
        res,
        400,
        "company_id is required. Please specify which company this payment link belongs to."
      );
    }
    
    // Verify the company belongs to this user
    const userCompany = await companyModel.findOne({
      where: { 
        company_id: company_id,
        user_id: userData.user_id 
      }
    });
    
    if (!userCompany) {
      return errorResponseHelper(
        res,
        400,
        "Invalid company_id. The specified company does not exist or does not belong to you."
      );
    }
    
    console.log(`[createPaymentLink] Using company_id: ${company_id} for user: ${userData.user_id}`);
    
    // ========================================
    // ACTIVE API KEY CHECK: Block if no active API key exists
    // ========================================
    const activeApiKey = await sequelize.query<{ api_id: number }>(
      `SELECT api_id FROM tbl_api WHERE company_id = :companyId AND status = 'active' LIMIT 1`,
      {
        replacements: { companyId: company_id },
        type: QueryTypes.SELECT,
      }
    );
    
    if (!activeApiKey || activeApiKey.length === 0) {
      return errorResponseHelper(
        res,
        400,
        "An active API key is required to create a payment link. Please create one in your developer settings."
      );
    }
    // ========================================
    // END ACTIVE API KEY CHECK
    // ========================================
    
    // Default modes if not provided
    const allowedModes = modes ? modes.join(",") : "crypto,card";
    
    const payload = {
      transaction_id: crypto.randomUUID(),
      email: email || null,
      allowedModes: allowedModes,
      base_amount: normalizedAmount,
      base_currency: normalizedCurrency,
      user_id: userData.user_id,
      adm_id: userData.user_id,  // Add adm_id for crypto payment compatibility
      company_id: company_id,  // REQUIRED field
      payment_link: (process.env.CHECKOUT_URL || '').trim().replace(/\/$/, '') + "/pay?d=" + uniqueRef,
      description: description || null,
      expires_at: expires_at,
      callback_url: callback_url || null,
      redirect_url: redirect_url || null,
      webhook_url: webhook_url || null,
      fee_payer: fee_payer || 'company',  // Default: company pays fees (existing behavior)
      apply_tax: apply_tax || false,  // Tax toggle: OFF by default, merchant must enable
      accepted_currencies: acceptedCurrenciesString,  // Store merchant's selected currencies (null = all)
      customer_name: name || null,  // Optional customer name for payment link
    };

    const links = await paymentLinkModel.create(payload);
    const redisPayload = {
      ...payload,
      pathType: "createLink",
      link_id: links.dataValues.link_id,
      available_currencies: finalAcceptedCurrencies,  // Use merchant's selection or all configured
      all_configured_currencies: allConfiguredCurrencies,  // Store all for reference
      createdAt: new Date().toISOString(),  // Include creation timestamp for checkout
    };

    console.log(redisPayload);

    await setRedisItem("customer-" + uniqueRef, redisPayload);

    // Send payment link email with referee code (if email provided)
    if (email && email.trim() !== "") {
      try {
        // Import referee code service
        const { createRefereeCode } = await import("../services/referralService");
        
        // Try to create referee code (will return null if email has account or already received code)
        const refereeCodeData = await createRefereeCode({
          customerEmail: email,
          referrerCompanyId: company_id || userData.company_id,
          referrerUserId: userData.user_id,
          paymentLinkId: links.dataValues.link_id,
        });

        // Build email content
        let refereeCodeSection = "";
        if (refereeCodeData) {
          refereeCodeSection = `
            <div style="margin-top: 30px; padding: 20px; background: linear-gradient(135deg, #f0fff4 0%, #e6ffed 100%); border-left: 4px solid #22c55e; border-radius: 0 8px 8px 0;">
              <h3 style="margin: 0 0 10px 0; color: #166534; font-size: 16px;">🎁 Special Offer for You!</h3>
              <p style="margin: 0 0 10px 0; color: #14532d; font-size: 14px;">
                Want to accept crypto payments for your own business? Join Dynopay and get <strong>${refereeCodeData.discount}% off</strong> all fees for <strong>${refereeCodeData.duration} days</strong>!
              </p>
              <p style="margin: 0; font-size: 14px;">
                Use code: <strong style="background: #dcfce7; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${refereeCodeData.code}</strong>
              </p>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #166534;">
                This code is exclusive to you and expires in 30 days.
              </p>
            </div>
          `;
        }

        // Get company name if available
        let companyName = "Dynopay Merchant";
        if (company_id) {
          const company = await companyModel.findByPk(company_id);
          if (company) {
            companyName = (company as { company_name?: string }).company_name || companyName;
          }
        }

        const paymentMessage = `
You have received a payment request from <strong>${companyName}</strong>.

<div style="margin: 20px 0; padding: 20px; background: #f8f9ff; border-radius: 8px;">
  <p style="margin: 0 0 8px 0;"><strong>Amount:</strong> ${normalizedAmount} ${normalizedCurrency}</p>
  ${description ? `<p style="margin: 0 0 8px 0;"><strong>Description:</strong> ${description}</p>` : ''}
  ${expires_at ? `<p style="margin: 0;"><strong>Expires:</strong> ${new Date(expires_at).toLocaleDateString()}</p>` : ''}
</div>

<div style="text-align: center; margin: 24px 0;">
  <a href="${payload.payment_link}" style="display: inline-block; background: linear-gradient(135deg, #f47323 0%, #e05a00 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">Pay Now</a>
</div>

${refereeCodeSection}
        `.trim();

        await sendEmail(
          email,                                                                          // recipientEmail
          email.split('@')[0] || "Customer",                                              // name (extract from email)
          `Payment Request from ${companyName} - ${normalizedAmount} ${normalizedCurrency}`, // subject
          paymentMessage,                                                                 // message body
          false                                                                           // showImage
        );

        console.log(`[PaymentLink] Email sent to ${email}${refereeCodeData ? ` with referee code ${refereeCodeData.code}` : ''}`);
      } catch (emailError) {
        console.error("[PaymentLink] Failed to send email:", emailError);
        // Don't fail the request if email fails
      }
    }
    
    // Send payment link created notification to merchant
    try {
      const user = await userModel.findByPk(userData.user_id);
      if (user && user.dataValues.email) {
        const { sendPaymentLinkCreatedEmail } = await import("../services/emailService");
        await sendPaymentLinkCreatedEmail(
          user.dataValues.email,
          user.dataValues.name || 'Merchant',
          normalizedAmount.toString(),
          normalizedCurrency,
          payload.payment_link,
          description || 'No description provided',
          expires_at ? new Date(expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : null
        );
        console.log(`[PaymentLink] Merchant notification sent to ${user.dataValues.email}`);
      }
    } catch (merchantEmailError) {
      console.error("[PaymentLink] Failed to send merchant notification:", merchantEmailError);
      // Don't fail the request if email fails
    }

    // Format response to be consistent with getPaymentLinkById
    const amountDisplay = formatAmountForDisplay(normalizedAmount, normalizedCurrency);
    const currencyInfo = getCurrencyInfo(normalizedCurrency);
    
    const responseData = {
      ...links.dataValues,
      // Formatted amount display
      amount_display: amountDisplay,
      currency_info: currencyInfo,
      display_value: amountDisplay.display_value, // e.g., "$123.00 USD"
      accepted_currencies: links.dataValues.accepted_currencies 
        ? links.dataValues.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,  // null means all configured currencies are accepted
      // Include KYC warning if within grace period (for in-app display)
      ...(kycWarning && { kyc_warning: kycWarning }),
    };

    successResponseHelper(res, 200, "Payment link created successfully", responseData);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const getPaymentLinks = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  try {
    const { company_id, page, limit, paginated } = req.query;  // Added pagination params
    
    console.log("userData============>", userData);
    
    // Build where clause with optional company_id filter
    const whereClause: Record<string, unknown> = {
      user_id: userData.user_id,
    };
    
    if (company_id) {
      whereClause.company_id = parseInt(company_id as string);
    }
    
    // Check if pagination is requested (backward compatibility)
    const usePagination = paginated === 'true' || page !== undefined || limit !== undefined;
    
    // Get total count for pagination
    const totalCount = await paymentLinkModel.count({ where: whereClause });
    
    // Calculate pagination
    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 10;
    const offset = (pageNum - 1) * limitNum;
    
    const links = await paymentLinkModel.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']],
      ...(usePagination && { limit: limitNum, offset: offset }),
    });

    // Define interface for payment link data
    interface PaymentLinkData {
      link_id: number;
      transaction_id: string;
      description?: string;
      base_amount: number;
      base_currency: string;
      createdAt: Date | string;
      expires_at?: Date | string;
      status?: string;
      times_used?: number;
      payment_link: string;
      email?: string;
      allowedModes?: string;
      company_id?: number;
      callback_url?: string;
      redirect_url?: string;
      webhook_url?: string;
      fee_payer?: string;
    }

    // Format for UI with computed status
    const formattedLinks = (links as Array<{ dataValues: PaymentLinkData }>).map((link) => {
      const linkData = link.dataValues;
      const now = new Date();
      
      // Calculate status
      let status = "Active";
      if (linkData.expires_at && new Date(linkData.expires_at as string) <= now) {
        status = "Expired";
      }
      if (linkData.status === "completed" || linkData.status === "successful") {
        status = "Completed";
      }

      // Format dates
      const formatDate = (date: Date | string | undefined | null): string => {
        if (!date) return "Never";
        const d = new Date(date);
        return d.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(',', '');
      };

      // Use centralized currency formatting
      const currency = linkData.base_currency || 'USD';
      const amountDisplay = formatAmountForDisplay(Number(linkData.base_amount), currency);
      const currencyInfo = getCurrencyInfo(currency);

      return {
        link_id: linkData.link_id,
        transaction_id: linkData.transaction_id,
        description: linkData.description || "No description",
        display_value: amountDisplay.display_value, // e.g., "$123.00 USD"
        amount_display: amountDisplay,
        currency_info: currencyInfo,
        base_amount: linkData.base_amount,
        base_currency: linkData.base_currency,
        created: formatDate(linkData.createdAt),
        expires: formatDate(linkData.expires_at),
        status: status,
        times_used: linkData.times_used || 0,
        payment_link: linkData.payment_link,
        email: linkData.email,
        allowedModes: linkData.allowedModes,
        callback_url: linkData.callback_url,
        redirect_url: linkData.redirect_url,
        webhook_url: linkData.webhook_url,
        fee_payer: linkData.fee_payer || 'company',  // Who pays blockchain fees
        company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
      };
    });

    // Return with pagination info only if pagination was requested
    // Otherwise return array directly for backward compatibility
    if (usePagination) {
      successResponseHelper(res, 200, "Payment links retrieved successfully", {
        links: formattedLinks,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        }
      });
    } else {
      // Backward compatible: return array directly
      successResponseHelper(res, 200, "Links Fetched Successfully!", formattedLinks);
    }
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get single payment link by ID
 * GET /api/pay/links/:id
 */
const getPaymentLinkById = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  
  try {
    const link = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!link) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    const linkData = link.dataValues;
    const now = new Date();
    
    // Calculate status
    let status = "Active";
    if (linkData.expires_at && new Date(linkData.expires_at) <= now) {
      status = "Expired";
    }
    if (linkData.status === "completed" || linkData.status === "successful") {
      status = "Completed";
    }

    // Format dates
    const formatDate = (date) => {
      if (!date) return null;
      const d = new Date(date);
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(',', '');
    };

    const response = {
      link_id: linkData.link_id,
      transaction_id: linkData.transaction_id,
      description: linkData.description,
      base_amount: linkData.base_amount,
      base_currency: linkData.base_currency,
      paid_amount: linkData.paid_amount,
      paid_currency: linkData.paid_currency,
      created: formatDate(linkData.createdAt),
      updated: formatDate(linkData.updatedAt),
      expires_at: linkData.expires_at,
      expires: formatDate(linkData.expires_at) || "Never",
      status: status,
      times_used: linkData.times_used || 0,
      payment_link: linkData.payment_link,
      email: linkData.email,
      allowedModes: linkData.allowedModes,
      payment_mode: linkData.payment_mode,
      transaction_reference: linkData.transaction_reference,
      callback_url: linkData.callback_url,
      redirect_url: linkData.redirect_url,
      webhook_url: linkData.webhook_url,
      company_id: linkData.company_id,  // Phase 10 Fix: Include company_id in response
      fee_payer: linkData.fee_payer || 'company',
      apply_tax: linkData.apply_tax || false,
      accepted_currencies: linkData.accepted_currencies 
        ? linkData.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,  // null means all configured currencies are accepted
    };

    successResponseHelper(res, 200, "Payment link retrieved successfully", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Update payment link
 * PUT /api/pay/links/:id
 */
const updatePaymentLink = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  const { 
    description, 
    expire,
    email,
    base_amount,
    base_currency,
    allowedModes,
    fee_payer,
    apply_tax,
    accepted_currencies,  // Array of crypto types to accept
    callback_url, 
    redirect_url, 
    webhook_url,
    name,                 // Customer name
  } = req.body;
  
  try {
    // First check if link exists and belongs to user
    const existingLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    if (!existingLink) {
      return errorResponseHelper(res, 404, "Payment link not found!");
    }

    // Check if link is already completed - don't allow updates
    if (existingLink.dataValues.status === 'completed') {
      return errorResponseHelper(res, 400, "Cannot update a completed payment link");
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {};
    
    // For accepted_currencies validation, we need to fetch configured wallets
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    let allConfiguredCurrencies: string[] = [];
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    if (email !== undefined) {
      updateData.email = email;
    }
    
    if (base_amount !== undefined) {
      const amount = Number(base_amount);
      if (isNaN(amount) || amount <= 0) {
        return errorResponseHelper(res, 400, "Invalid amount. Must be a positive number.");
      }
      updateData.base_amount = amount;
    }
    
    if (base_currency !== undefined) {
      const validCurrencies = [
        // Major International
        'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'HKD', 'NZD', 'SGD',
        // Latin America (high crypto adoption)
        'BRL', 'ARS', 'COP', 'CLP', 'PEN', 'MXN', 'VES', 'UYU',
        // African (high crypto adoption)
        'NGN', 'ZAR', 'KES', 'GHS', 'TZS', 'XAF', 'XOF', 'EGP', 'MAD',
        'UGX', 'RWF', 'ETB', 'ZMW', 'BWP', 'MUR', 'AOA', 'MZN', 'CDF'
      ];
      if (!validCurrencies.includes(base_currency.toUpperCase())) {
        return errorResponseHelper(res, 400, `Invalid currency. Valid options: ${validCurrencies.join(', ')}`);
      }
      updateData.base_currency = base_currency.toUpperCase();
    }
    
    if (allowedModes !== undefined) {
      // Can be array or comma-separated string
      let modes = allowedModes;
      if (Array.isArray(allowedModes)) {
        modes = allowedModes.join(',');
      }
      const validModes = ['CRYPTO', 'CARD', 'BANK'];
      const providedModes = modes.split(',').map((m: string) => m.trim().toUpperCase());
      const invalidModes = providedModes.filter((m: string) => !validModes.includes(m));
      if (invalidModes.length > 0) {
        return errorResponseHelper(res, 400, `Invalid payment modes: ${invalidModes.join(', ')}. Valid options: ${validModes.join(', ')}`);
      }
      updateData.allowedModes = providedModes.join(',');
    }
    
    if (fee_payer !== undefined) {
      const validFeePayers = ['customer', 'company'];
      if (!validFeePayers.includes(fee_payer.toLowerCase())) {
        return errorResponseHelper(res, 400, "Invalid fee_payer. Must be 'customer' or 'company'.");
      }
      updateData.fee_payer = fee_payer.toLowerCase();
    }
    
    if (apply_tax !== undefined) {
      updateData.apply_tax = Boolean(apply_tax);
    }
    
    // Handle accepted_currencies update
    if (accepted_currencies !== undefined) {
      if (accepted_currencies === null || (Array.isArray(accepted_currencies) && accepted_currencies.length === 0)) {
        // Clear selection - use all configured wallets
        updateData.accepted_currencies = null;
      } else if (Array.isArray(accepted_currencies)) {
        // Fetch configured wallets to validate
        const company_id = existingLink.dataValues.company_id;
        const walletWhereClause: Record<string, unknown> = {
          user_id: userData.user_id,
          wallet_type: { [Op.in]: cryptoTypes },
          wallet_address: { [Op.not]: null },
        };
        if (company_id) {
          walletWhereClause.company_id = company_id;
        }
        
        const configuredWallets = await userWalletModel.findAll({
          where: walletWhereClause,
          attributes: ['wallet_type'],
        });
        
        allConfiguredCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
        
        // Normalize to uppercase
        const requestedCurrencies = accepted_currencies.map((c: string) => c.toUpperCase().trim());
        
        // Validate all requested currencies are valid crypto types
        const invalidCryptos = requestedCurrencies.filter((c: string) => !cryptoTypes.includes(c));
        if (invalidCryptos.length > 0) {
          return errorResponseHelper(
            res,
            400,
            `Invalid cryptocurrency types: ${invalidCryptos.join(', ')}. Valid options: ${cryptoTypes.join(', ')}`
          );
        }
        
        // Validate all requested currencies have configured wallets
        const unconfiguredCurrencies = requestedCurrencies.filter((c: string) => !allConfiguredCurrencies.includes(c));
        if (unconfiguredCurrencies.length > 0) {
          return errorResponseHelper(
            res,
            400,
            `No wallet configured for: ${unconfiguredCurrencies.join(', ')}. Please configure wallets first or select from available: ${allConfiguredCurrencies.join(', ')}`
          );
        }
        
        updateData.accepted_currencies = requestedCurrencies.join(',');
        console.log(`[updatePaymentLink] Updated accepted currencies: ${updateData.accepted_currencies}`);
      }
    }
    
    if (expire !== undefined) {
      // Calculate new expires_at
      if (expire === "No" || expire === null || expire === "") {
        updateData.expires_at = null;
      } else {
        const now = new Date();
        if (expire === "24h") {
          updateData.expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        } else if (expire === "7d") {
          updateData.expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (expire === "30d") {
          updateData.expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          return errorResponseHelper(res, 400, "Invalid expire value. Valid options: '24h', '7d', '30d', 'No', or null");
        }
      }
    }
    
    if (callback_url !== undefined) {
      updateData.callback_url = callback_url || null;
    }
    
    if (redirect_url !== undefined) {
      updateData.redirect_url = redirect_url || null;
    }
    
    if (webhook_url !== undefined) {
      updateData.webhook_url = webhook_url || null;
    }

    if (name !== undefined) {
      updateData.customer_name = name || null;
    }

    // Check if there are any fields to update
    if (Object.keys(updateData).length === 0) {
      return errorResponseHelper(res, 400, "No valid fields provided for update");
    }

    // Update the link in database
    await paymentLinkModel.update(updateData, {
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // Fetch updated link
    const updatedLink = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // CRITICAL: Also update Redis so checkout page and payment processing get new data
    if (updatedLink) {
      const linkData = updatedLink.dataValues;
      
      // Extract the uniqueRef from payment_link URL (the 'd' parameter)
      const paymentLinkUrl = linkData.payment_link;
      const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
      const uniqueRef = urlMatch ? urlMatch[1] : null;
      
      if (uniqueRef) {
        // Get existing Redis data to preserve fields not in database
        const existingRedisData = await getRedisItem("customer-" + uniqueRef);
        
        let updatedRedisPayload: Record<string, unknown>;
        
        if (existingRedisData && Object.keys(existingRedisData).length > 0) {
          // Calculate new available_currencies based on accepted_currencies
          let newAvailableCurrencies = existingRedisData.available_currencies || existingRedisData.all_configured_currencies || [];
          
          if (linkData.accepted_currencies) {
            // Use merchant's selection
            newAvailableCurrencies = linkData.accepted_currencies.split(',').map((c: string) => c.trim());
          } else if (existingRedisData.all_configured_currencies) {
            // No selection, use all configured
            newAvailableCurrencies = existingRedisData.all_configured_currencies;
          }
          
          // Merge updated fields with existing Redis data
          updatedRedisPayload = {
            ...existingRedisData,
            // Update all fields that could have changed
            email: linkData.email,
            base_amount: linkData.base_amount,
            amount: linkData.base_amount,  // FIX: Sync 'amount' alongside 'base_amount' for code paths that read 'amount'
            base_currency: linkData.base_currency,
            description: linkData.description,
            expires_at: linkData.expires_at,
            callback_url: linkData.callback_url,
            redirect_url: linkData.redirect_url,
            webhook_url: linkData.webhook_url,
            fee_payer: linkData.fee_payer,
            apply_tax: linkData.apply_tax,
            allowedModes: linkData.allowedModes,
            accepted_currencies: linkData.accepted_currencies,
            available_currencies: newAvailableCurrencies,
            customer_name: linkData.customer_name,
            updatedAt: new Date().toISOString(),
          };
        } else {
          // FIX: Redis key expired/evicted — reconstruct from DB to keep payment link functional
          console.warn(`[updatePaymentLink] Redis key customer-${uniqueRef} missing, reconstructing from DB`);
          
          // Fetch configured wallets for available_currencies
          const company_id = linkData.company_id;
          const walletWhereClause: Record<string, unknown> = {
            user_id: userData.user_id,
            wallet_type: { [Op.in]: cryptoTypes },
            wallet_address: { [Op.not]: null },
          };
          if (company_id) {
            walletWhereClause.company_id = company_id;
          }
          const configuredWallets = await userWalletModel.findAll({
            where: walletWhereClause,
            attributes: ['wallet_type'],
          });
          const reconstructedCurrencies = [...new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type))];
          
          let availableCurrencies = reconstructedCurrencies;
          if (linkData.accepted_currencies) {
            availableCurrencies = linkData.accepted_currencies.split(',').map((c: string) => c.trim());
          }
          
          updatedRedisPayload = {
            transaction_id: linkData.transaction_id,
            email: linkData.email,
            allowedModes: linkData.allowedModes,
            base_amount: linkData.base_amount,
            amount: linkData.base_amount,
            base_currency: linkData.base_currency,
            user_id: linkData.user_id,
            adm_id: linkData.user_id,
            company_id: company_id,
            payment_link: linkData.payment_link,
            description: linkData.description,
            expires_at: linkData.expires_at,
            callback_url: linkData.callback_url,
            redirect_url: linkData.redirect_url,
            webhook_url: linkData.webhook_url,
            fee_payer: linkData.fee_payer || 'company',
            apply_tax: linkData.apply_tax || false,
            accepted_currencies: linkData.accepted_currencies,
            customer_name: linkData.customer_name,
            pathType: "createLink",
            link_id: linkData.link_id,
            available_currencies: availableCurrencies,
            all_configured_currencies: reconstructedCurrencies,
            createdAt: linkData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            reconstructed: true,  // Flag so we know this was rebuilt
          };
          console.log(`[updatePaymentLink] Reconstructed Redis payload for customer-${uniqueRef}`);
        }
        
        await setRedisItem("customer-" + uniqueRef, updatedRedisPayload);
        console.log(`[updatePaymentLink] Redis updated for key: customer-${uniqueRef}`);
        
        // FIX: If an active crypto address exists, update crypto-{address} Redis key too
        // This handles the edge case where merchant updates webhook_url/amount AFTER
        // a customer has initiated payment but BEFORE it's confirmed
        const activeAddress = updatedRedisPayload.active_crypto_address as { address?: string; destination_tag?: number | null } | undefined;
        if (activeAddress?.address) {
          const activeDestTag = activeAddress.destination_tag ? Number(activeAddress.destination_tag) : null;
          const activeCryptoKey = getCryptoRedisKey(activeAddress.address, activeDestTag);
          const cryptoRedisData = await getRedisItem(activeCryptoKey);
          if (cryptoRedisData && cryptoRedisData.status === 'pending') {
            const cryptoUpdates: Record<string, unknown> = {};
            
            if (updateData.webhook_url !== undefined) {
              cryptoUpdates.webhook_url = linkData.webhook_url;
            }
            if (updateData.callback_url !== undefined) {
              cryptoUpdates.callback_url = linkData.callback_url;
            }
            
            if (Object.keys(cryptoUpdates).length > 0) {
              await setRedisItem(activeCryptoKey, {
                ...cryptoRedisData,
                ...cryptoUpdates,
              });
              console.log(`[updatePaymentLink] Also updated ${activeCryptoKey} with: ${Object.keys(cryptoUpdates).join(', ')}`);
            }
          }
        }
      } else {
        console.warn(`[updatePaymentLink] Could not extract uniqueRef from payment_link: ${paymentLinkUrl}`);
      }
    }

    // Format response to be consistent - accepted_currencies as array
    const responseData = {
      ...updatedLink.dataValues,
      accepted_currencies: updatedLink.dataValues.accepted_currencies 
        ? updatedLink.dataValues.accepted_currencies.split(',').map((c: string) => c.trim())
        : null,
    };

    successResponseHelper(res, 200, "Payment link updated successfully", responseData);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const deletePaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
  const link_id = req.params.id;
  try {
    // First get the payment link to extract uniqueRef for Redis deletion
    const linkToDelete = await paymentLinkModel.findOne({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });
    
    if (!linkToDelete) {
      return errorResponseHelper(res, 404, "Link not found!");
    }
    
    // Extract uniqueRef from payment_link URL
    const paymentLinkUrl = linkToDelete.dataValues.payment_link;
    const urlMatch = paymentLinkUrl?.match(/[?&]d=([a-f0-9]+)/i);
    const uniqueRef = urlMatch ? urlMatch[1] : null;
    
    // Delete from database
    const links = await paymentLinkModel.destroy({
      where: {
        user_id: userData.user_id,
        link_id,
      },
    });

    // Also delete from Redis to prevent checkout access
    if (uniqueRef) {
      await deleteRedisItem("customer-" + uniqueRef);
      console.log(`[deletePaymentLink] Redis deleted for key: customer-${uniqueRef}`);
    }

    successResponseHelper(res, 200, "Payment link deleted successfully", links);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(
      errorMessage,
      { id: userData.id, email: userData.email },
      new Error(e)
    );
    errorResponseHelper(res, 500, errorMessage);
  }
};

const checkingUSDT = async () => {
  const USDT: ITemporaryAddress[] = await sequelize.query(
    `select ut.*,at.amount_to_be_paid from tbl_user_temp_address ut join tbl_admin_fee_transaction at
    on ut.wallet_address=at.wallet_address
    where ut.wallet_type in ('USDT-ERC20','USDT-TRC20') and ut.status='successful'
    and ut.admin_status='pending'
    `,
    {
      type: QueryTypes.SELECT,
    }
  );

  for (let i = 0; i < USDT.length; i++) {
    try {
      const currentAddress = USDT[i];
      const addressBalance = await tatumApi.getAddressBalance(
        currentAddress?.wallet_address,
        currentAddress.wallet_type
      );
      
      // Multi-tenant fix: Include company_id in wallet lookup
      const forwardingWalletWhere: Record<string, unknown> = {
        wallet_type: currentAddress.wallet_type,
        user_id: currentAddress.user_id,
      };
      
      // Add company_id filter if present (cast to any since company_id may be added dynamically)
      const addressCompanyId = (currentAddress as any).company_id;
      if (addressCompanyId && addressCompanyId !== '' && addressCompanyId !== 'undefined' && addressCompanyId !== 'null') {
        const companyId = parseInt(addressCompanyId);
        if (!isNaN(companyId)) {
          forwardingWalletWhere.company_id = companyId;
        }
      } else {
        forwardingWalletWhere.company_id = null;
      }
      
      const userWallet = await (
        await userWalletModel.findOne({
          where: forwardingWalletWhere,
        })
      ).dataValues;
      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        let fees;
        if (currentAddress?.wallet_type === "USDT-ERC20") {
          const data = await getRedisItem(
            "crypto-" + currentAddress?.wallet_address + "-fees_paid"
          );
          if (Object.keys(data).length > 0 && data?.gasPrice) {
            fees = data;
            await deleteRedisItem(
              "crypto-" + currentAddress?.wallet_address + "-fees_paid"
            );
          } else {
            fees = await tatumApi.feeEstimation(
              currentAddress?.wallet_type,
              currentAddress?.wallet_address,
              userWallet?.wallet_address,
              currentAddress?.amount_to_be_paid,
              process.env.ETH_CONTRACT
            );
          }
        }

        const privateKey = await tatumApi.decryptSymmetric(
          currentAddress.privateKey,
          process.env.TEMP_KEY_ID
        );
        const transactionDetails = await tatumApi.assetToOtherAddress({
          amount: currentAddress?.amount_to_be_paid,
          currency: currentAddress?.wallet_type,
          fee: fees,
          fromAddress: currentAddress?.wallet_address,
          privateKey: privateKey,
          toAddress: userWallet?.wallet_address,
        });
        await userTempAddressModel.update(
          {
            adminTxId: transactionDetails?.txId,
            admin_status: "successful",
          },
          {
            where: {
              temp_id: currentAddress?.temp_id,
            },
          }
        );
      }
    } catch (e) {
      console.log(e);
      const message = getErrorMessage(e);
      cronLogger.error(message, new Error(e));
    }
  }
};

/**
 * Sweep native ETH/TRX admin fees from temp addresses to admin wallet
 * This handles the pending_sweep status for account-based chains
 * Schedule: Every 45 minutes
 */
const sweepNativeAdminFees = async () => {
  console.log("[sweepNativeAdminFees] Starting native ETH/TRX admin fee sweep...");
  
  try {
    // Find all temp addresses with pending native ETH/TRX admin fees
    const pendingAddresses: ITemporaryAddress[] = await sequelize.query(
      `SELECT ut.* FROM tbl_user_temp_address ut
       WHERE ut.wallet_type IN ('ETH', 'TRX')
       AND ut.status = 'successful'
       AND ut.admin_status = 'pending_sweep'
       AND ut.amount > 0
       AND ut."createdAt" >= NOW() - INTERVAL '${PAYMENT_TIMING.SQL_INTERVALS.MONTHLY_TRANSACTIONS}'`,
      {
        type: QueryTypes.SELECT,
      }
    );

    console.log(`[sweepNativeAdminFees] Found ${pendingAddresses.length} addresses with pending admin fees`);

    for (let i = 0; i < pendingAddresses.length; i++) {
      try {
        const currentAddress = pendingAddresses[i];
        const wallet_type = currentAddress.wallet_type; // ETH or TRX
        
        console.log(`[sweepNativeAdminFees] Processing ${wallet_type} address: ${currentAddress.wallet_address}`);

        // Get current balance of temp address
        const addressBalance = await tatumApi.getAddressBalance(
          currentAddress.wallet_address,
          wallet_type
        );

        // Get admin fee wallet from .env (NOT from tbl_admin_fee_wallet which is for gas funding)
        // tbl_admin_fee_wallet is used for funding gas to temp addresses for ERC20/TRC20 transfers
        // .env wallets (ETH, TRX, etc.) are the destination for collected admin fees
        const adminWalletAddress = getAdminWalletAddress(wallet_type);

        if (!adminWalletAddress) {
          console.error(`[sweepNativeAdminFees] Admin fee wallet not configured in .env for ${wallet_type}`);
          continue;
        }
        
        console.log(`[sweepNativeAdminFees] Will sweep to admin wallet: ${adminWalletAddress}`);
        let balance = Number(addressBalance?.balance ?? 0);
        
        // For TRX, convert from SUN to TRX
        if (wallet_type === "TRX") {
          balance = balance / 1000000;
        }

        console.log(`[sweepNativeAdminFees] Address balance: ${balance} ${wallet_type}`);

        if (balance > 0) {
          let fees, sendAmount;

          if (wallet_type === "ETH") {
            // Estimate gas fee for ETH transfer
            fees = await tatumApi.feeEstimation(
              wallet_type,
              currentAddress.wallet_address,
              adminWalletAddress,
              balance
            );
            // Deduct gas fee from send amount
            sendAmount = Number((balance - Number(fees?.slow ?? 0)).toFixed(8));
          } else {
            // TRX - bandwidth fee is minimal, send most of the balance
            fees = null;
            // Leave small amount for bandwidth (0.1 TRX should be enough)
            sendAmount = Number((balance - 0.1).toFixed(6));
          }

          if (sendAmount > 0) {
            console.log(`[sweepNativeAdminFees] Sweeping ${sendAmount} ${wallet_type} to admin wallet`);

            // Decrypt private key
            const privateKey = await tatumApi.decryptSymmetric(
              currentAddress.privateKey,
              process.env.TEMP_KEY_ID
            );

            // Transfer to admin fee wallet
            const transactionDetails = await tatumApi.assetToOtherAddress({
              amount: sendAmount,
              currency: wallet_type,
              fee: fees,
              fromAddress: currentAddress.wallet_address,
              privateKey: privateKey,
              toAddress: adminWalletAddress,
            });

            // Convert to USD for logging
            const finalAmount = await currencyConvert({
              sourceCurrency: wallet_type,
              currency: ["USD"],
              amount: sendAmount,
              fixedDecimal: false,
            });
            const usd = Number(Number(finalAmount[0].amount).toFixed(2));

            // Record the admin fee transaction
            await adminFeeTransactionModel.create({
              wallet_address: currentAddress.wallet_address,
              amount: sendAmount,
              amount_in_usd: usd,
              wallet_type,
              transaction_id: transactionDetails?.txId,
              status: "successful",
              blockchain_fee: fees?.slow ?? 0,
              transaction_type: "CREDIT",
              amount_to_be_paid: 0,
            });

            // Update temp address status
            await userTempAddressModel.update(
              {
                adminTxId: (currentAddress as { adminTxId?: string }).adminTxId 
                  ? (currentAddress as any).adminTxId + "," + transactionDetails?.txId 
                  : transactionDetails?.txId,
                admin_status: "successful",
              },
              {
                where: {
                  temp_id: currentAddress.temp_id,
                },
              }
            );

            // Increment admin wallet fee balance (for tracking)
            await adminWalletModel.increment("fee", {
              by: sendAmount,
              where: { wallet_type },
            });

            console.log(`[sweepNativeAdminFees] Successfully swept ${sendAmount} ${wallet_type} ($${usd} USD) - TX: ${transactionDetails?.txId}`);
          } else {
            console.log(`[sweepNativeAdminFees] Balance too low after gas fees: ${balance} ${wallet_type}`);
          }
        } else {
          // No balance but marked as pending_sweep - might have been swept manually or balance moved
          console.log(`[sweepNativeAdminFees] No balance found, marking as successful: ${currentAddress.wallet_address}`);
          await userTempAddressModel.update(
            {
              admin_status: "successful",
            },
            {
              where: {
                temp_id: currentAddress.temp_id,
              },
            }
          );
        }
      } catch (e) {
        console.error(`[sweepNativeAdminFees] Error processing address:`, e);
        const message = getErrorMessage(e);
        cronLogger.error(`[sweepNativeAdminFees] ${message}`, new Error(e));
      }
    }

    console.log("[sweepNativeAdminFees] Completed native ETH/TRX admin fee sweep");
  } catch (e) {
    console.error("[sweepNativeAdminFees] Fatal error:", e);
    const message = getErrorMessage(e);
    cronLogger.error(`[sweepNativeAdminFees] ${message}`, new Error(e));
  }
};

const checkFeeBalance = async () => {
  try {
    const adminFeesWallets = await adminFeeModel.findAll({
      attributes: { exclude: ["privateKey", "mnemonic", "xpub"] },
    });

    let textData = "";

    for (let i = 0; i < adminFeesWallets.length; i++) {
      const { feeLimit, wallet_type } = adminFeesWallets[i].dataValues;
      
      // Skip non-gas wallets (XRP_MASTER is for receiving payments, not gas funding)
      if (wallet_type === "XRP_MASTER" || feeLimit === 0) {
        continue;
      }
      
      // Map wallet_type to the correct currency for balance checking
      // XRP gas wallet checks XRP balance, POLYGON gas wallet checks POLYGON balance
      const balanceCheckCurrency = wallet_type;
      
      let currentBalance;
      try {
        currentBalance = await tatumApi.getAddressBalance(
          adminFeesWallets[i]?.dataValues.wallet_address,
          balanceCheckCurrency
        );
      } catch (balErr: unknown) {
        const balError = balErr as { message?: string; body?: { errorCode?: string } };
        const errMsg = balError?.message || '';
        const errCode = balError?.body?.errorCode || '';
        // XRP/RLUSD accounts that haven't been activated yet (need 10 XRP reserve)
        // return 403 "Account not found" — skip gracefully instead of crashing
        if (errMsg.includes('account.not.found') || errMsg.includes('Account not found') ||
            errCode.includes('account.failed') || errMsg.includes('not.found')) {
          console.log(`[checkFeeBalance] ⏭️ Skipping ${wallet_type} — account not activated yet (${adminFeesWallets[i]?.dataValues.wallet_address?.substring(0, 12)}...)`);
          continue;
        }
        throw balErr;
      }
      let amount = adminFeesWallets[i]?.dataValues.amount;
      let newBalance =
        wallet_type === "TRX"
          ? currentBalance?.balance / 1000000
          : currentBalance?.balance;
      
      console.log(`[checkFeeBalance] ${wallet_type}: currentBalance=${JSON.stringify(currentBalance)}, newBalance=${newBalance}, dbAmount=${amount}`);
      
      // Only update if newBalance is a valid number
      if (newBalance !== undefined && newBalance !== null && !isNaN(newBalance)) {
        if (newBalance !== adminFeesWallets[i]?.dataValues.amount) {
          amount = newBalance;
          await adminFeeModel.update(
            { amount },
            {
              where: {
                fee_wallet_id: adminFeesWallets[i]?.dataValues.fee_wallet_id,
              },
            }
          );
        }
      }

      // Skip currency conversion if amount is null, undefined, 0, or NaN
      if (amount === null || amount === undefined || amount === 0 || isNaN(Number(amount))) {
        console.log(`[checkFeeBalance] Skipping ${wallet_type} - no valid balance (amount=${amount})`);
        textData += `\n Your ${wallet_type} fee wallet has no balance or amount unavailable.`;
        continue;
      }

      const tempData = await currencyConvert({
        currency: ["USD"],
        sourceCurrency: wallet_type,
        amount,
        fixedDecimal: true,
      });
      const amount_in_usd = tempData[0].amount;
      if (amount_in_usd < feeLimit) {
        textData += `\n Your ${wallet_type} fee wallet has low fee amount ($${amount_in_usd}) then limit of ($${feeLimit}).`;
      }
    }

    if (textData.length > 0) {
      let flag = true;
      const sentData = await getRedisItem("admin_fee_alert");
      if (sentData) {
        const { expiresAt } = sentData;
        if (new Date().getTime() < Number(expiresAt)) {
          flag = false;
        }
      }
      if (flag) {
        // Try to get admin email from database or centralized config
        let adminEmail = ADMIN_CONFIG.EMAIL;
        
        try {
          const adminData = await sequelize.query<IAdminData>(
            "select email from tbl_admin limit 1",
            {
              type: QueryTypes.SELECT,
            }
          );
          if (adminData && adminData.length > 0 && adminData[0].email) {
            adminEmail = adminData[0].email;
          }
        } catch (dbError) {
          console.log("[Cron] Could not fetch admin from database, using config email");
        }
        
        if (!adminEmail) {
          console.error("[Cron] No admin email configured - skipping notification");
          return;
        }
        
        textData += `\n\n Please recharge as soon as possible.`;
        
        console.log(`Sending low fee balance alert to: ${adminEmail}`);
        
        await sendEmail(
          adminEmail,
          "Dynopay Admin",
          "Low amount in Fee wallet",
          textData
        );
        
        const alert_duration = adminFeesWallets[0]?.dataValues?.alert_duration || 24; // Default 24 hours
        await setRedisItem("admin_fee_alert", {
          status: "sent",
          expiresAt:
            new Date().getTime() + Number(alert_duration) * 60 * 60 * 1000,
        });
        
        console.log(`Fee balance alert sent successfully to ${adminEmail}`);
      } else {
        console.log("Fee balance alert already sent recently, skipping");
      }
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};

const checkOnBlockchair = async () => {
  try {
    // Check for pending payments older than crypto invoice window
    // Using SQL_INTERVALS constant for safety
    const tempData = await sequelize.query<ITemporaryAddress>(
      `select * from tbl_user_temp_address 
      where "createdAt"::date = CURRENT_DATE - INTERVAL '1 day' 
      and "createdAt" <= NOW() - INTERVAL '${PAYMENT_TIMING.SQL_INTERVALS.CRYPTO_INVOICE}' 
      and status='pending' and check_count=0`,
      { type: QueryTypes.SELECT }
    );
    if (tempData.length > 0) {
      for (let i = 0; i < tempData.length; i++) {
        await blockchairApi.getAddressStatus(
          tempData[i].wallet_address,
          tempData[i].wallet_type
        );

        // NOTE: Legacy tbl_user_temp_address doesn't have destination_tag.
        // Tag-based chains (XRP/RLUSD) should use merchant pool flow instead.
        await getRedisItem(
          getCryptoRedisKey(tempData[i].wallet_address)
        );

        await userTempAddressModel.update(
          {
            check_count: 1,
          },
          {
            where: {
              temp_id: tempData[i].temp_id,
            },
          }
        );
      }
    } else {
      console.log("No pending transactions!");
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};

const removeUnwantedSubscriptions = async () => {
  try {
    const tempData = await sequelize.query<ITemporaryAddress>(
      `select subscription_id,temp_id from tbl_user_temp_address where "txId" is null 
    and "updatedAt" < NOW() - INTERVAL '1 day' and subscription_id is not null`,
      { type: QueryTypes.SELECT }
    );

    for (let i = 0; i < tempData.length; i++) {
      try {
        if (tempData[i]?.subscription_id) {
          await tatumApi.deleteSubscription(tempData[i].subscription_id);
        }
      } catch (e) {
        console.log(e);
      }
      await userTempAddressModel.update(
        {
          subscription_id: null,
        },
        {
          where: {
            temp_id: tempData[i].temp_id,
          },
        }
      );
    }
  } catch (e) {
    console.log(e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};

const processIncompletePayments = async () => {
  try {
    // Query all partial payments older than 5 minutes (minimum reasonable grace period)
    // Then check per-company grace_period_minutes (max 30) in the loop
    const pendingTransactions = await sequelize.query<ITemporaryAddress>(
      `SELECT * FROM tbl_user_temp_address 
       WHERE status = 'partial' 
       AND "txId" IS NOT NULL
       AND COALESCE(partial_payment_timestamp, "updatedAt") < NOW() - INTERVAL '5 minutes'`,
      { type: QueryTypes.SELECT }
    );

    if (pendingTransactions.length > 0) {
      console.log(`[processIncompletePayments] Found ${pendingTransactions.length} partial payments older than 5 min — checking per-company grace periods...`);

      for (const tempTx of pendingTransactions) {
        try {
          // Fetch merchant's grace period from company settings (max 30 minutes)
          let companyGracePeriodMinutes = 30; // Default and max
          if (tempTx.company_id) {
            try {
              const companyRecord = await companyModel.findOne({
                where: { company_id: tempTx.company_id },
                attributes: ['grace_period_minutes'],
              });
              if (companyRecord?.dataValues?.grace_period_minutes !== undefined &&
                  companyRecord?.dataValues?.grace_period_minutes !== null) {
                companyGracePeriodMinutes = Math.min(parseInt(String(companyRecord.dataValues.grace_period_minutes)), 30);
              }
            } catch (e) {
              console.log(`[processIncompletePayments] Could not fetch company ${tempTx.company_id} grace period, using default 30 min`);
            }
          }

          // Check if this payment's grace period has actually expired
          const partialTimestamp = new Date(tempTx.partial_payment_timestamp || tempTx.updatedAt);
          const minutesSincePartial = (Date.now() - partialTimestamp.getTime()) / 60000;
          if (minutesSincePartial < companyGracePeriodMinutes) {
            // Still within this merchant's grace period — skip
            continue;
          }

          console.log(`[processIncompletePayments] Company ${tempTx.company_id} grace: ${companyGracePeriodMinutes} min, elapsed: ${minutesSincePartial.toFixed(1)} min — processing...`);
          const balanceData = await tatumApi.getAddressBalance(
            tempTx.wallet_address,
            tempTx.wallet_type
          );

          const actualBalance = Number(balanceData?.balance || 0);

          if (actualBalance > 0) {
            console.log(`Additional balance found: ${actualBalance} ${tempTx.wallet_type}. Processing final sweep...`);

            // Get merchant wallet with multi-tenant security
            const merchantWallet = await userWalletModel.findOne({
              where: {
                user_id: tempTx.user_id,
                wallet_type: tempTx.wallet_type,
                company_id: tempTx.company_id,  // Multi-tenant: Ensure correct company wallet
              },
            });

            if (!merchantWallet) {
              console.error(`Merchant wallet not found for user ${tempTx.user_id}, company ${tempTx.company_id}, wallet_type ${tempTx.wallet_type}`);
              throw new Error(`Merchant wallet not found for user ${tempTx.user_id}`);
            }

            const totalReceived = Number(tempTx.amount || 0) + Number(actualBalance);

            // Check fee_payer mode from temp address record
            const fee_payer = tempTx.fee_payer || 'company';
            const merchant_amount = tempTx.merchant_amount || 0;

            let adminAmountToSend, userAmountToSend;

            if (fee_payer === 'customer' && merchant_amount > 0) {
              // CUSTOMER PAYS FEES MODE
              userAmountToSend = Number(merchant_amount);
              adminAmountToSend = Number(totalReceived) - Number(merchant_amount);
              
              if (adminAmountToSend < 0) {
                adminAmountToSend = 0;
                userAmountToSend = Number(totalReceived);
              }
              console.log(`[processIncompletePayments] Customer pays fees: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            } else {
              // COMPANY PAYS FEES MODE (default)
              const { totalDeduction, minForwarding } = await calculateTransactionFees(
                tempTx.wallet_type,
                totalReceived
              );

              if (Number(totalReceived) < Number(minForwarding)) {
                adminAmountToSend = Number(totalReceived);
                userAmountToSend = 0;
                console.log(`Total amount ${totalReceived} below threshold ${minForwarding}. Sending all to admin.`);
              } else {
                adminAmountToSend = Number(totalDeduction);
                userAmountToSend = Number(totalReceived) - Number(totalDeduction);
                console.log(`Splitting final amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
              }
            }

            const result = await settleCryptoTransaction({
              tempAddressData: {
                address: tempTx.wallet_address,
                wallet_address: tempTx.wallet_address,
                privateKey: tempTx.privateKey,
                wallet_type: tempTx.wallet_type,
              },
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId || '',
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
              merchantDestinationTag: merchantWallet.dataValues.destination_tag || null,
            });

            await adminWalletModel.increment("fee", {
              by: adminAmountToSend,
              where: { wallet_type: tempTx.wallet_type },
            });

            // Send admin fee notification email for partial payment processing
            try {
              const adminEmail = process.env.ADMIN_EMAIL;
              if (adminEmail && adminAmountToSend > 0) {
                const companyData = await companyModel.findOne({
                  where: { company_id: tempTx.company_id },
                });
                
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend).toFixed(8),
                  tempTx.wallet_type,
                  tempTx.txId,
                  companyData?.dataValues?.company_name || "Unknown Company",
                  Number(userAmountToSend).toFixed(8),
                  Number(totalReceived).toFixed(8)
                );
                
                console.log(`[Admin Fee Notification - Partial Payment] Sent email for ${adminAmountToSend} ${tempTx.wallet_type} from Company ${tempTx.company_id || 'N/A'}`);
              }
            } catch (emailError) {
              console.error("[Admin Fee Notification - Partial Payment] Email failed:", emailError);
            }

            await userTempAddressModel.update(
              {
                status: "completed_partial",
                admin_status: "successful",
                amount: totalReceived,
                adminTxId: result.transactionDetails?.txId,
                blockchain_fee: result.blockchainFee,
              },
              {
                where: { temp_id: tempTx.temp_id },
              }
            );

            if (userAmountToSend > 0) {
              await userWalletModel.increment("amount", {
                by: Number(userAmountToSend),
                where: {
                  wallet_id: merchantWallet.dataValues.wallet_id,
                },
              });

              await userTransactionModel.create({
                wallet_id: merchantWallet.dataValues.wallet_id,
                user_id: tempTx.user_id,
                company_id: tempTx.company_id || null,  // Multi-tenant: Include company_id
                payment_mode: "CRYPTO",
                base_amount: Number(userAmountToSend).toFixed(8),
                base_currency: tempTx.wallet_type,
                transaction_reference: tempTx.txId,
                transaction_type: "CREDIT",
                status: "completed_partial",
              });
            }

            if (tempTx.subscription_id) {
              try {
                await tatumApi.deleteSubscription(tempTx.subscription_id);
              } catch (e) {
                console.log(`Failed to delete subscription ${tempTx.subscription_id}:`, e.message);
              }
            }

            // Send partial payment completed notification
            await sendPartialPaymentExpiredNotification(
              tempTx.wallet_address,
              tempTx.txId,
              totalReceived,
              Number(tempTx.expected_amount || tempTx.amount),
              tempTx.wallet_type,
              tempTx.user_id,
              tempTx.company_id,
              "completed_partial"
            );

            console.log(`Incomplete payment processed successfully for ${tempTx.wallet_address}`);
          } else {
            console.log(`No additional payment for ${tempTx.wallet_address}. Processing with existing amount ${tempTx.amount}`);

            // Get merchant wallet with multi-tenant security
            const merchantWallet = await userWalletModel.findOne({
              where: {
                user_id: tempTx.user_id,
                wallet_type: tempTx.wallet_type,
                company_id: tempTx.company_id,  // Multi-tenant: Ensure correct company wallet
              },
            });

            if (!merchantWallet) {
              console.error(`Merchant wallet not found for user ${tempTx.user_id}, company ${tempTx.company_id}, wallet_type ${tempTx.wallet_type}`);
              throw new Error(`Merchant wallet not found for user ${tempTx.user_id}`);
            }

            // Check fee_payer mode from temp address record
            const fee_payer = tempTx.fee_payer || 'company';
            const merchant_amount = tempTx.merchant_amount;

            let adminAmountToSend, userAmountToSend;

            if (fee_payer === 'customer' && merchant_amount > 0) {
              // CUSTOMER PAYS FEES MODE - but partial payment, so prorate
              // Customer only paid partial, so merchant gets proportional amount
              const expectedTotal = Number(tempTx.amount) + (Number(tempTx.amount) - Number(merchant_amount));
              const paidRatio = Number(tempTx.amount) / expectedTotal;
              userAmountToSend = Number(merchant_amount) * paidRatio;
              adminAmountToSend = Number(tempTx.amount) - userAmountToSend;
              
              if (adminAmountToSend < 0) {
                adminAmountToSend = 0;
                userAmountToSend = Number(tempTx.amount);
              }
              console.log(`[processIncompletePayments] Customer pays fees (incomplete): Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
            } else {
              // COMPANY PAYS FEES MODE (default)
              const { totalDeduction, minForwarding } = await calculateTransactionFees(
                tempTx.wallet_type,
                Number(tempTx.amount)
              );

              if (Number(tempTx.amount) < Number(minForwarding)) {
                adminAmountToSend = Number(tempTx.amount);
                userAmountToSend = 0;
                console.log(`Amount ${tempTx.amount} below threshold. Sending all to admin.`);
              } else {
                adminAmountToSend = Number(totalDeduction);
                userAmountToSend = Number(tempTx.amount) - Number(totalDeduction);
                console.log(`Splitting partial amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
              }
            }

            const result = await settleCryptoTransaction({
              tempAddressData: {
                address: tempTx.wallet_address,
                wallet_address: tempTx.wallet_address,
                privateKey: tempTx.privateKey,
                wallet_type: tempTx.wallet_type,
              },
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId || '',
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
              merchantDestinationTag: merchantWallet.dataValues.destination_tag || null,
            });

            await adminWalletModel.increment("fee", {
              by: adminAmountToSend,
              where: { wallet_type: tempTx.wallet_type },
            });

            // Send admin fee notification email for expired incomplete payment
            try {
              const adminEmail = process.env.ADMIN_EMAIL;
              if (adminEmail && adminAmountToSend > 0) {
                const companyData = await companyModel.findOne({
                  where: { company_id: tempTx.company_id },
                });
                
                await sendAdminFeeReceivedEmail(
                  adminEmail,
                  "Dynopay Admin",
                  Number(adminAmountToSend).toFixed(8),
                  tempTx.wallet_type,
                  tempTx.txId,
                  companyData?.dataValues?.company_name || "Unknown Company",
                  Number(userAmountToSend).toFixed(8),
                  Number(tempTx.amount).toFixed(8)
                );
                
                console.log(`[Admin Fee Notification - Expired Payment] Sent email for ${adminAmountToSend} ${tempTx.wallet_type} from Company ${tempTx.company_id || 'N/A'}`);
              }
            } catch (emailError) {
              console.error("[Admin Fee Notification - Expired Payment] Email failed:", emailError);
            }

            await userTempAddressModel.update(
              {
                status: "incomplete_expired",
                admin_status: "successful",
                adminTxId: result.transactionDetails?.txId,
                blockchain_fee: result.blockchainFee,
              },
              {
                where: { temp_id: tempTx.temp_id },
              }
            );

            if (userAmountToSend > 0) {
              await userWalletModel.increment("amount", {
                by: Number(userAmountToSend),
                where: {
                  wallet_id: merchantWallet.dataValues.wallet_id,
                },
              });

              await userTransactionModel.create({
                wallet_id: merchantWallet.dataValues.wallet_id,
                user_id: tempTx.user_id,
                company_id: tempTx.company_id || null,  // Multi-tenant: Include company_id
                payment_mode: "CRYPTO",
                base_amount: Number(userAmountToSend).toFixed(8),
                base_currency: tempTx.wallet_type,
                transaction_reference: tempTx.txId,
                transaction_type: "CREDIT",
                status: "incomplete_expired",
              });
            }

            if (tempTx.subscription_id) {
              try {
                await tatumApi.deleteSubscription(tempTx.subscription_id);
              } catch (e) {
                console.log(`Failed to delete subscription ${tempTx.subscription_id}:`, e.message);
              }
            }

            // Send partial payment expired notification
            await sendPartialPaymentExpiredNotification(
              tempTx.wallet_address,
              tempTx.txId,
              Number(tempTx.amount),
              Number(tempTx.expected_amount || tempTx.amount * 2), // Use expected if available
              tempTx.wallet_type,
              tempTx.user_id,
              tempTx.company_id,
              "incomplete_expired"
            );

            console.log(`Partial payment processed after timeout for ${tempTx.wallet_address}`);
          }
        } catch (innerError) {
          console.error(`Failed to process incomplete payment ${tempTx.wallet_address}:`, innerError.message);
          cronLogger.error(
            `Incomplete payment processing error for ${tempTx.wallet_address}`,
            new Error(innerError)
          );
        }
      }
    } else {
      console.log("No incomplete payments found that exceeded 1-hour grace period.");
    }
    
    // ============================================
    // MERCHANT POOL: Also check for incomplete/underpaid pool addresses
    // This covers payment link underpayments that used merchant pool addresses
    // where the Redis key expired before the payment was processed
    // ============================================
    try {
      const poolAddresses = await merchantTempAddressModel.findAll({
        where: {
          status: 'IN_USE',
          current_payment_id: { [Op.ne]: null },
          expected_amount: { [Op.gt]: 0 },
        }
      });
      
      if (poolAddresses.length > 0) {
        console.log(`[processIncompletePayments] Found ${poolAddresses.length} merchant pool addresses IN_USE, checking for expired grace period...`);
        
        for (const poolAddr of poolAddresses) {
          try {
            const walletAddress = poolAddr.dataValues.wallet_address;
            const walletType = poolAddr.dataValues.wallet_type;
            const expectedAmount = parseFloat(poolAddr.dataValues.expected_amount || '0');
            const paymentId = poolAddr.dataValues.current_payment_id;
            const reservedAt = new Date(poolAddr.dataValues.reserved_at || poolAddr.dataValues.updatedAt);
            const minutesSinceReserved = (Date.now() - reservedAt.getTime()) / 60000;
            
            // Only process if reserved for more than 60 minutes (grace period expired)
            if (minutesSinceReserved < 60) {
              continue; // Still within grace period
            }
            
            console.log(`[processIncompletePayments] Pool address ${walletAddress} reserved ${minutesSinceReserved.toFixed(1)} min ago — checking balance...`);
            
            // Check if already processed
            const existingTx = await customerTransactionModel.findOne({
              where: {
                [Op.or]: [
                  { transaction_reference: paymentId },
                  { transaction_reference: { [Op.like]: `%${walletAddress}%` } }
                ],
                status: { [Op.in]: ['successful', 'completed', 'confirmed'] }
              }
            });
            
            if (existingTx) {
              console.log(`[processIncompletePayments] Pool ${walletAddress} already processed (tx: ${existingTx.dataValues.transaction_reference}). Skipping.`);
              continue;
            }
            
            // Check on-chain balance
            const balanceData = await tatumApi.getAddressBalance(walletAddress, walletType);
            const actualBalance = Number(balanceData?.balance || 0);
            
            if (actualBalance <= 0) {
              console.log(`[processIncompletePayments] Pool ${walletAddress} has no balance. Skipping.`);
              continue;
            }
            
            console.log(`[processIncompletePayments] Pool ${walletAddress} has ${actualBalance} ${walletType} (expected ${expectedAmount}) — grace period expired, processing...`);
            
            // Get or reconstruct Redis data
            const poolDestTag = poolAddr.dataValues.destination_tag || null;
            const poolRedisKey = poolDestTag ? getCryptoRedisKey(walletAddress, poolDestTag) : `crypto-${walletAddress}`;
            let redisData = await getRedisItem(poolRedisKey);
            
            if (!redisData || Object.keys(redisData).length === 0) {
              // Reconstruct from last_payment_context or DB fields
              const lastContextRaw = poolAddr.dataValues.last_payment_context;
              let paymentContext = null;
              if (lastContextRaw) {
                try {
                  paymentContext = typeof lastContextRaw === 'string' ? JSON.parse(lastContextRaw) : lastContextRaw;
                } catch (e) {
                  console.warn(`[processIncompletePayments] Failed to parse last_payment_context for ${walletAddress}`);
                }
              }
              
              redisData = {
                mode: 'CRYPTO',
                amount: String(expectedAmount),
                status: 'processing',
                currency: walletType,
                payment_id: paymentId,
                unique_tx_id: paymentId,
                is_merchant_pool: 'true',
                temp_id: String(poolAddr.dataValues.temp_address_id),
                adm_id: String(paymentContext?.adm_id || poolAddr.dataValues.owner_user_id),
                company_id: String(paymentContext?.company_id || poolAddr.dataValues.current_company_id),
                receivedAmount: String(actualBalance),
                originalExpectedAmount: String(expectedAmount),
                fee_payer: paymentContext?.fee_payer || 'company',
                merchant_amount: paymentContext?.merchant_amount || null,
                base_currency: paymentContext?.base_currency || 'USD',
                base_amount: paymentContext?.base_amount || null,
                webhook_url: paymentContext?.webhook_url || null,
                callback_url: paymentContext?.callback_url || null,
                link_id: paymentContext?.link_id || null,
                ref: paymentContext?.ref || `customer-${paymentId}`,
                processedByFallback: 'true',
                lastAttempt: new Date().toISOString(),
              };
              
              // Also reconstruct customer ref
              const custRef = redisData.ref;
              const existingCustData = await getRedisItem(custRef);
              if (!existingCustData || Object.keys(existingCustData).length === 0) {
                const custData = {
                  adm_id: redisData.adm_id,
                  company_id: redisData.company_id,
                  base_currency: redisData.base_currency,
                  base_amount: redisData.base_amount,
                  fee_payer: redisData.fee_payer,
                  merchant_amount: redisData.merchant_amount,
                  webhook_url: redisData.webhook_url,
                  callback_url: redisData.callback_url,
                  link_id: redisData.link_id,
                };
                await setRedisItem(custRef, custData);
              }
              
              await setRedisItem(poolRedisKey, redisData);
              console.log(`[processIncompletePayments] Reconstructed Redis data for pool ${walletAddress}`);
            } else {
              // Update existing Redis data with current balance
              redisData.status = 'processing';
              redisData.receivedAmount = String(actualBalance);
              redisData.lastAttempt = new Date().toISOString();
              redisData.processedByFallback = 'true';
              await setRedisItem(poolRedisKey, redisData);
            }
            
            // Process via cryptoVerification
            console.log(`[processIncompletePayments] 🚀 Processing pool ${walletAddress} via cryptoVerification...`);
            const verificationResult = await cryptoVerification(walletAddress, true, poolRedisKey);
            console.log(`[processIncompletePayments] ✅ Pool ${walletAddress} processed successfully`);
            
          } catch (poolError) {
            console.error(`[processIncompletePayments] ❌ Failed to process pool address:`, poolError.message || poolError);
          }
        }
      }
    } catch (poolScanError) {
      console.error("[processIncompletePayments] Error scanning merchant pool addresses:", poolScanError.message || poolScanError);
    }
  } catch (e) {
    console.error("Error in processIncompletePayments:", e);
    const message = getErrorMessage(e);
    cronLogger.error(message, new Error(e));
  }
};


/**
 * GET /api/payment/network-fees
 * Public endpoint - Get real-time blockchain network fees
 */
const getNetworkFees = async (req: express.Request, res: express.Response) => {
  try {
    const { chain } = req.query;

    if (chain) {
      const fee = await getBlockchainNetworkFee(chain as string);
      successResponseHelper(res, 200, "Network fee retrieved", fee);
    } else {
      const fees = await getAllBlockchainFees();
      successResponseHelper(res, 200, "Network fees retrieved", fees);
    }
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[getNetworkFees] Error:", message);
    errorResponseHelper(res, 500, message);
  }
};

/**
 * POST /api/payment/calculate-payment
 * Public endpoint - Calculate total payment amount with blockchain fees
 */
const calculatePaymentAmount = async (req: express.Request, res: express.Response) => {
  try {
    const { amount_usd, chain, fee_payer = 'customer' } = req.body;

    if (!amount_usd || !chain) {
      return errorResponseHelper(res, 400, "amount_usd and chain are required");
    }

    // Get current crypto price
    const cryptoPrice = await getCryptoPriceForPayment(chain);
    
    if (fee_payer === 'customer') {
      const calculation = await calculateCustomerPaymentAmount(
        parseFloat(amount_usd),
        chain,
        cryptoPrice
      );

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'customer',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: calculation.baseAmountCrypto,
        blockchain_fee_native: calculation.blockchainFeeNative,
        blockchain_fee_usd: calculation.blockchainFeeUSD,
        total_amount_crypto: calculation.totalAmountCrypto,
        total_amount_usd: calculation.totalAmountUSD,
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
      });
    } else {
      const baseAmountCrypto = parseFloat(amount_usd) / cryptoPrice;
      const networkFee = await getBlockchainNetworkFee(chain);

      successResponseHelper(res, 200, "Payment amount calculated", {
        fee_payer: 'company',
        base_amount_usd: parseFloat(amount_usd),
        base_amount_crypto: baseAmountCrypto,
        blockchain_fee_native: networkFee.feeInNative,
        blockchain_fee_usd: networkFee.feeInUSD,
        total_amount_crypto: baseAmountCrypto,
        total_amount_usd: parseFloat(amount_usd),
        crypto_currency: chain,
        crypto_price_usd: cryptoPrice,
        note: "Blockchain fee will be deducted from merchant settlement"
      });
    }
  } catch (e) {
    const message = getErrorMessage(e);
    console.error("[calculatePaymentAmount] Error:", message);
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Helper: Get crypto price in USD for payment calculations
 */
const getCryptoPriceForPayment = async (symbol: string): Promise<number> => {
  try {
    const idMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'LTC': 'litecoin',
      'DOGE': 'dogecoin',
      'TRX': 'tron',
      'USDT': 'tether',
      'USDT_ERC20': 'tether',
      'USDT_TRC20': 'tether',
      'BCH': 'bitcoin-cash',
    };

    const coinId = idMap[symbol.toUpperCase()] || symbol.toLowerCase();
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    
    return response.data[coinId]?.usd || 0;
  } catch (error) {
    const fallbackPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3300,
      'LTC': 100,
      'DOGE': 0.35,
      'TRX': 0.25,
      'USDT': 1,
      'USDT_ERC20': 1,
      'USDT_TRC20': 1,
      'BCH': 450,
    };
    return fallbackPrices[symbol.toUpperCase()] || 0;
  }
};

/**
 * Get Configured Currencies for Checkout
 * Returns only wallets configured for the company (from customer token)
 * Used by checkout page to filter available payment currencies
 * GET /api/pay/configured-currencies
 */
const getConfiguredCurrenciesForCheckout = async (
  _req: express.Request,
  res: express.Response
) => {
  try {
    // Get user data from customer token (set by customerAuthMiddleware)
    const userData = res.locals.user;
    
    if (!userData) {
      return errorResponseHelper(res, 400, "Invalid customer session");
    }
    
    // For payment link flow, get company_id from payment link record
    let companyId: number | null = null;
    let userId: number | null = null;
    let paymentRef = userData.ref;
    let transactionId = userData.transaction_id;
    let feePayerFromLink = 'company';
    
    // Track accepted_currencies restriction from payment link
    let acceptedCurrenciesFilter: string[] | null = null;
    
    // First try to get company_id and accepted_currencies from payment link using transaction_id
    if (userData.pathType === 'createLink' && userData.transaction_id) {
      const paymentLink = await paymentLinkModel.findOne({
        where: { transaction_id: userData.transaction_id },
        attributes: ['company_id', 'user_id', 'fee_payer', 'base_amount', 'base_currency', 'link_id', 'accepted_currencies'],
      });
      
      if (paymentLink) {
        companyId = paymentLink.dataValues.company_id as number;
        userId = paymentLink.dataValues.user_id as number;
        feePayerFromLink = (paymentLink.dataValues.fee_payer as string) || 'company';
        
        // Parse accepted_currencies if set by merchant
        const acceptedCurrenciesStr = paymentLink.dataValues.accepted_currencies as string | null;
        if (acceptedCurrenciesStr) {
          acceptedCurrenciesFilter = acceptedCurrenciesStr.split(',').map((c: string) => c.trim().toUpperCase());
          console.log(`[getConfiguredCurrenciesForCheckout] Payment link has accepted_currencies restriction: ${acceptedCurrenciesFilter.join(', ')}`);
        }
      }
    }
    
    // Fallback: try to get from Redis data (includes available_currencies)
    if (!userId && paymentRef) {
      const redisData = await getRedisItem(`customer-${paymentRef}`);
      if (redisData) {
        companyId = redisData.company_id ? parseInt(redisData.company_id) : null;
        userId = redisData.adm_id ? parseInt(redisData.adm_id) : (redisData.user_id ? parseInt(redisData.user_id) : null);
        feePayerFromLink = redisData.fee_payer || 'company';
        
        // Get available_currencies from Redis (set during payment link creation)
        if (redisData.available_currencies) {
          if (Array.isArray(redisData.available_currencies)) {
            acceptedCurrenciesFilter = redisData.available_currencies;
          } else if (typeof redisData.available_currencies === 'string') {
            acceptedCurrenciesFilter = redisData.available_currencies.split(',').map((c: string) => c.trim().toUpperCase());
          }
          console.log(`[getConfiguredCurrenciesForCheckout] Redis has available_currencies: ${acceptedCurrenciesFilter?.join(', ')}`);
        }
      }
    }
    
    if (!userId) {
      return errorResponseHelper(res, 400, "Invalid payment session - merchant not found");
    }
    
    console.log(`[getConfiguredCurrenciesForCheckout] Looking up wallets for user_id: ${userId}, company_id: ${companyId}`);
    
    // Get configured wallets for this merchant
    // IMPORTANT: Only return wallets that have a wallet_address configured
    const walletWhereClause: Record<string, unknown> = {
      user_id: userId,
      wallet_address: { [Op.not]: null },
      wallet_type: { [Op.in]: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'] },
    };
    
    // If company_id exists, filter by it
    if (companyId) {
      walletWhereClause.company_id = companyId;
    }
    
    // If merchant specified accepted_currencies, filter wallet types
    if (acceptedCurrenciesFilter && acceptedCurrenciesFilter.length > 0) {
      walletWhereClause.wallet_type = { [Op.in]: acceptedCurrenciesFilter };
      console.log(`[getConfiguredCurrenciesForCheckout] Filtering wallets to accepted currencies: ${acceptedCurrenciesFilter.join(', ')}`);
    }
    
    const configuredWallets = await userWalletModel.findAll({
      where: walletWhereClause,
      attributes: ['wallet_type', 'wallet_address', 'wallet_name'],
    });
    
    // Extract unique currencies (only those with actual addresses AND in accepted list)
    let currencies = [...new Set(configuredWallets.map((w) => w.dataValues.wallet_type as string))];
    
    // Double-check filter (in case of edge cases)
    if (acceptedCurrenciesFilter && acceptedCurrenciesFilter.length > 0) {
      currencies = currencies.filter(c => acceptedCurrenciesFilter!.includes(c));
    }
    
    // Normalize USDC-ERC20 → USDC for checkout compatibility
    // The checkout frontend only knows about "USDC" (no network selection needed since USDC only runs on ERC-20)
    // This ensures the checkout's cryptoOptions (which has value: "USDC") can match the configured currency
    currencies = currencies.map(c => c === 'USDC-ERC20' ? 'USDC' : c);
    // De-duplicate after normalization
    currencies = [...new Set(currencies)];
    
    console.log(`[getConfiguredCurrenciesForCheckout] Found ${currencies.length} currencies: ${currencies.join(', ')}`);
    
    let feeInfo = {
      fee_payer: feePayerFromLink,
      transaction_fee_percent: parseFloat(process.env.TRANSACTION_FEE_PERCENT || '2.0'),
    };
    
    let transactionAmount = 0;
    let transactionCurrency = 'USD';
    let linkId: string | number | null = null;
    
    // Try to get fee_payer and amount from payment link data
    if (paymentRef) {
      const paymentData = await getRedisItem(`customer-${paymentRef}`);
      if (paymentData) {
        if (paymentData.fee_payer) {
          feeInfo.fee_payer = paymentData.fee_payer;
        }
        if (paymentData.base_amount) {
          transactionAmount = parseFloat(paymentData.base_amount);
        } else if (paymentData.amount) {
          transactionAmount = parseFloat(paymentData.amount);
        }
        if (paymentData.base_currency) {
          transactionCurrency = paymentData.base_currency;
        } else if (paymentData.currency) {
          transactionCurrency = paymentData.currency;
        }
        if (paymentData.link_id) {
          linkId = paymentData.link_id;
        }
      }
    }
    
    // If no link_id from Redis, try to get from payment link record
    if (!linkId && transactionId) {
      const paymentLink = await paymentLinkModel.findOne({
        where: { transaction_id: transactionId },
        attributes: ['link_id', 'base_amount', 'base_currency', 'fee_payer'],
      });
      if (paymentLink) {
        linkId = paymentLink.dataValues.link_id as number;
        if (!transactionAmount && paymentLink.dataValues.base_amount) {
          transactionAmount = parseFloat(String(paymentLink.dataValues.base_amount));
        }
        if (paymentLink.dataValues.base_currency) {
          transactionCurrency = paymentLink.dataValues.base_currency as string;
        }
        if (paymentLink.dataValues.fee_payer) {
          feeInfo.fee_payer = paymentLink.dataValues.fee_payer as string;
        }
      }
    }
    
    // Calculate total processing fee if customer pays fees (internal calculation - not exposed in detail)
    let totalProcessingFee = 0;
    if (feeInfo.fee_payer === 'customer' && transactionAmount > 0) {
      const feeTiers = (await import("../utils/feeConfigUtils")).getFeeTiers();
      let fixedFee = 0;
      for (const tier of feeTiers) {
        if (transactionAmount >= tier.min && (tier.max === null || transactionAmount <= tier.max)) {
          fixedFee = tier.fixed;
          break;
        }
      }
      const percentageFee = transactionAmount * (feeInfo.transaction_fee_percent / 100);
      totalProcessingFee = percentageFee + fixedFee;
    }
    
    const response: Record<string, unknown> = {
      configured_currencies: currencies,
      wallet_count: configuredWallets.length,
      wallets: configuredWallets.map((w) => {
        const walletData = w.dataValues as { wallet_type: string; wallet_name?: string; wallet_address?: string };
        // Normalize USDC-ERC20 → USDC for checkout consistency
        const normalizedType = walletData.wallet_type === 'USDC-ERC20' ? 'USDC' : walletData.wallet_type;
        return {
          currency: normalizedType,
          label: walletData.wallet_name,
          address_masked: walletData.wallet_address ? 
            `${walletData.wallet_address.substring(0, 6)}...${walletData.wallet_address.substring(walletData.wallet_address.length - 4)}` : 
            null
        };
      }),
      skip_selection: currencies.length === 1,
      // Payment link ID
      link_id: linkId,
      // Transaction info
      transaction_amount: transactionAmount,
      transaction_currency: transactionCurrency,
      // Simplified fee info - no internal breakdown exposed
      fee_payer: feeInfo.fee_payer,
    };
    
    // Include only total processing fee if customer pays fees
    if (feeInfo.fee_payer === 'customer' && transactionAmount > 0) {
      response.processing_fee = parseFloat(totalProcessingFee.toFixed(2));
      response.total_amount = parseFloat((transactionAmount + totalProcessingFee).toFixed(2));
    }
    
    successResponseHelper(res, 200, "Configured currencies retrieved successfully", response);
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, {}, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

/**
 * Calculate fees for checkout page - Public endpoint (no auth required)
 * POST /api/pay/calculateFees
 * 
 * Used by merchants and checkout page to show fee breakdown:
 * - Platform fee: 1% of amount (displayed with 60% promotional discount)
 * - Blockchain fee: Remaining fees (total - platform fee) 
 * - Total fees: With 60% promotional discount applied
 * - Net to merchant: Amount - Total fees (displayed fees)
 * 
 * Supports any fiat currency - automatically converts to USD for fee tier calculation
 * 
 * Note: Displays 1% as "platform fee" and remainder as "blockchain fee"
 * but total fees are always consistent with actual fee tier logic
 */
const calculateCheckoutFees = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { amount, cryptocurrency, currency = 'USD' } = req.body;

    // Validate required fields
    if (!amount || amount <= 0) {
      return errorResponseHelper(res, 400, "Valid payment amount is required");
    }

    if (!cryptocurrency) {
      return errorResponseHelper(res, 400, "Cryptocurrency selection is required");
    }

    const paymentAmount = parseFloat(amount);
    let crypto = cryptocurrency.toUpperCase();
    const fiatCurrency = currency.toUpperCase();

    // Normalize checkout currency aliases to internal wallet types
    if (crypto === 'USDC') crypto = 'USDC-ERC20';
    if (crypto === 'RLUSD-XRPL') crypto = 'RLUSD';

    // Validate cryptocurrency
    const validCryptos = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20', 'SOL', 'XRP', 'RLUSD', 'RLUSD-ERC20', 'POLYGON', 'USDT-POLYGON'];
    if (!validCryptos.includes(crypto)) {
      return errorResponseHelper(res, 400, `Invalid cryptocurrency. Valid options: ${validCryptos.join(', ')}`);
    }

    // Validate fiat currency (common fiat currencies supported)
    const validFiatCurrencies = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'CNY', 'JPY', 'NZD', 'SGD', 'HKD', 'NGN', 'KES', 'ZAR', 'BRL', 'MXN', 'INR', 'AED', 'SAR', 'PHP', 'THB', 'IDR', 'MYR', 'VND', 'KRW', 'TWD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'ILS', 'CLP', 'COP', 'PEN', 'ARS'];
    if (!validFiatCurrencies.includes(fiatCurrency)) {
      return errorResponseHelper(res, 400, `Invalid currency. Common options: USD, EUR, GBP, AUD, CAD, etc.`);
    }

    // Convert amount to USD for fee calculation if not already USD
    let amountUSD = paymentAmount;
    let exchangeRate = 1;
    
    if (fiatCurrency !== 'USD') {
      try {
        const usdConversion = await currencyConvert({
          sourceCurrency: fiatCurrency,
          currency: ['USD'],
          amount: paymentAmount,
          fixedDecimal: true,
        });
        amountUSD = Number(usdConversion[0]?.amount || paymentAmount);
        exchangeRate = amountUSD / paymentAmount;
        console.log(`[calculateCheckoutFees] Converted ${paymentAmount} ${fiatCurrency} → ${amountUSD.toFixed(2)} USD`);
      } catch (conversionError) {
        console.warn(`[calculateCheckoutFees] USD conversion failed, using original amount:`, conversionError);
      }
    }

    // Calculate actual fees using existing fee logic (based on USD amount)
    const { totalDeduction } = await calculateTransactionFees(
      crypto,
      amountUSD
    );

    // Get blockchain network fee for display
    let networkFeeUSD = 0;
    try {
      const networkFee = await getBlockchainNetworkFee(crypto);
      networkFeeUSD = Number(networkFee.feeInUSD) || 0;
    } catch (e) {
      console.log(`[calculateCheckoutFees] Could not fetch network fee for ${crypto}, using 0`);
    }

    // Total actual fees in USD (from our fee tier system)
    const totalActualFeesUSD = totalDeduction + networkFeeUSD;

    // PROMOTIONAL DISPLAY: Show fees 60% cheaper to encourage customers
    // Actual fees are used internally, but display shows reduced amount
    const promotionalDiscount = 0.60; // 60% reduction
    const displayMultiplier = 1 - promotionalDiscount; // Show only 40% of fees

    // Display breakdown with 60% reduction (in USD first):
    // Platform fee = 1% of amount (fixed display, also reduced)
    // Blockchain fee = Remaining displayed fees
    const platformFeePercent = 1;
    const actualPlatformFeeUSD = amountUSD * platformFeePercent / 100;
    const platformFeeUSD = parseFloat((actualPlatformFeeUSD * displayMultiplier).toFixed(2));
    
    // Total displayed fees in USD (60% cheaper than actual)
    const totalFeesUSD = parseFloat((totalActualFeesUSD * displayMultiplier).toFixed(2));
    
    // Blockchain fee is the remainder of displayed total fees (in USD)
    const blockchainFeeUSD = parseFloat(Math.max(0, totalFeesUSD - platformFeeUSD).toFixed(2));
    
    // Net amount to merchant in USD (based on displayed fees - appears higher)
    const netToMerchantUSD = parseFloat((amountUSD - totalFeesUSD).toFixed(2));

    // Convert fees back to original currency if not USD
    let platformFee = platformFeeUSD;
    let blockchainFee = blockchainFeeUSD;
    let totalFees = totalFeesUSD;
    let netToMerchant = netToMerchantUSD;
    let totalActualFees = totalActualFeesUSD;
    let savingsDisplayed = parseFloat((totalActualFeesUSD - totalFeesUSD).toFixed(2));

    if (fiatCurrency !== 'USD' && exchangeRate > 0) {
      // Convert all fee amounts back to original currency
      const reverseRate = 1 / exchangeRate;
      platformFee = parseFloat((platformFeeUSD * reverseRate).toFixed(2));
      blockchainFee = parseFloat((blockchainFeeUSD * reverseRate).toFixed(2));
      totalFees = parseFloat((totalFeesUSD * reverseRate).toFixed(2));
      netToMerchant = parseFloat((netToMerchantUSD * reverseRate).toFixed(2));
      totalActualFees = parseFloat((totalActualFeesUSD * reverseRate).toFixed(2));
      savingsDisplayed = parseFloat((totalActualFees - totalFees).toFixed(2));
    }

    // Build response
    const response = {
      payment_amount: paymentAmount,
      currency: fiatCurrency,
      cryptocurrency: crypto,
      fee_breakdown: {
        platform_fee: platformFee,
        platform_fee_percent: parseFloat((platformFeePercent * displayMultiplier).toFixed(2)),
        blockchain_fee: blockchainFee,
        total_fees: totalFees,
      },
      net_to_merchant: netToMerchant,
      // USD equivalents for reference (always included)
      usd_equivalents: {
        payment_amount_usd: parseFloat(amountUSD.toFixed(2)),
        total_fees_usd: totalFeesUSD,
        net_to_merchant_usd: netToMerchantUSD,
        exchange_rate: fiatCurrency !== 'USD' ? parseFloat(exchangeRate.toFixed(6)) : 1,
      },
      // Additional details (shows promotional vs actual for reference)
      details: {
        promotional_discount_percent: promotionalDiscount * 100,
        actual_total_fees: totalActualFees,
        displayed_total_fees: totalFees,
        savings_displayed: savingsDisplayed,
      }
    };

    console.log(`[calculateCheckoutFees] ${paymentAmount} ${fiatCurrency} ($${amountUSD.toFixed(2)} USD) in ${crypto}: Actual=${fiatCurrency !== 'USD' ? totalActualFees + ' ' + fiatCurrency : ''} $${totalActualFeesUSD.toFixed(2)} USD, Displayed=$${totalFeesUSD} USD (60% off), Net=$${netToMerchantUSD} USD`);

    return successResponseHelper(res, 200, "Fee calculation successful", response);
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    console.error(`[calculateCheckoutFees] Error:`, errorMessage);
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get fee preview with user's referral discount applied
 * GET /api/pay/fee-preview
 */
const getFeePreview = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
    const { amount, currency } = req.query;

    if (!amount) {
      return errorResponseHelper(res, 400, "Amount is required");
    }

    const amountNum = parseFloat(amount as string);
    if (isNaN(amountNum) || amountNum <= 0) {
      return errorResponseHelper(res, 400, "Invalid amount");
    }

    // Get discounted fee info for user
    const discountInfo = await getDiscountedTransactionFee(userData.user_id);

    // Calculate fees
    const baseFeePercent = Number(discountInfo.base_fee);
    const finalFeePercent = Number(discountInfo.final_fee);
    
    const baseFeeAmount = (amountNum * baseFeePercent) / 100;
    const discountedFeeAmount = (amountNum * finalFeePercent) / 100;
    const savings = baseFeeAmount - discountedFeeAmount;

    return successResponseHelper(res, 200, "Fee preview retrieved successfully", {
      amount: amountNum,
      currency: currency || 'USD',
      fee_info: {
        base_fee_percent: baseFeePercent,
        final_fee_percent: finalFeePercent,
        base_fee_amount: parseFloat(baseFeeAmount.toFixed(2)),
        discounted_fee_amount: parseFloat(discountedFeeAmount.toFixed(2)),
        savings: parseFloat(savings.toFixed(2)),
        you_receive: parseFloat((amountNum - discountedFeeAmount).toFixed(2)),
      },
      discount_info: {
        has_discount: discountInfo.discount_percent > 0,
        discount_percent: discountInfo.discount_percent,
        discount_reason: discountInfo.discount_reason,
        expires_at: discountInfo.discount_expires_at,
        days_remaining: discountInfo.discount_expires_at 
          ? Math.ceil((new Date(discountInfo.discount_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0,
      },
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(errorMessage, {}, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

/**
 * Get configured cryptocurrencies for a company (merchant dashboard)
 * GET /api/pay/configured-currencies/:company_id
 * 
 * Returns list of crypto wallets configured for this company with their status
 * Used by frontend when creating/editing payment links to show available currencies
 */
const getCompanyConfiguredCurrencies = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const userData = jwt.decode(res.locals.token) as PaymentUserJwtPayload;
    const { company_id } = req.params;

    if (!company_id) {
      return errorResponseHelper(res, 400, "company_id is required");
    }

    // Verify company belongs to user
    const company = await companyModel.findOne({
      where: { 
        company_id: parseInt(company_id),
        user_id: userData.user_id 
      },
      attributes: ['company_id', 'company_name'],
    });

    if (!company) {
      return errorResponseHelper(res, 404, "Company not found or does not belong to you");
    }

    // All supported crypto types
    const allCryptoTypes = [
      { type: 'BTC', name: 'Bitcoin', symbol: '₿' },
      { type: 'ETH', name: 'Ethereum', symbol: 'Ξ' },
      { type: 'LTC', name: 'Litecoin', symbol: 'Ł' },
      { type: 'DOGE', name: 'Dogecoin', symbol: 'Ð' },
      { type: 'TRX', name: 'Tron', symbol: '◎' },
      { type: 'BCH', name: 'Bitcoin Cash', symbol: '₿' },
      { type: 'USDT-TRC20', name: 'USDT (TRC-20)', symbol: '₮' },
      { type: 'USDT-ERC20', name: 'USDT (ERC-20)', symbol: '₮' },
      { type: 'USDC-ERC20', name: 'USDC (ERC-20)', symbol: '$' },
      { type: 'SOL', name: 'Solana', symbol: '◎' },
      { type: 'XRP', name: 'XRP', symbol: '✕' },
      { type: 'RLUSD', name: 'RLUSD (XRP Ledger)', symbol: '$' },
      { type: 'RLUSD-ERC20', name: 'RLUSD (ERC-20)', symbol: '$' },
      { type: 'POLYGON', name: 'Polygon', symbol: '⬡' },
      { type: 'USDT-POLYGON', name: 'USDT (Polygon)', symbol: '₮' },
    ];

    // Get configured wallets for this company
    const configuredWallets = await userWalletModel.findAll({
      where: {
        user_id: userData.user_id,
        company_id: parseInt(company_id),
        wallet_address: { [Op.not]: null },
        wallet_type: { [Op.in]: allCryptoTypes.map(c => c.type) },
      },
      attributes: ['wallet_type', 'wallet_address', 'wallet_name'],
    });

    // Create a set of configured wallet types
    const configuredTypes = new Set(configuredWallets.map((w) => (w.dataValues as { wallet_type: string }).wallet_type));

    // Build response with all crypto types and their configuration status
    const currencies = allCryptoTypes.map(crypto => ({
      type: crypto.type,
      name: crypto.name,
      symbol: crypto.symbol,
      configured: configuredTypes.has(crypto.type),
      wallet_address: configuredTypes.has(crypto.type) 
        ? (configuredWallets.find((w) => (w.dataValues as { wallet_type: string }).wallet_type === crypto.type)?.dataValues as { wallet_address?: string })?.wallet_address 
        : null,
    }));

    // Separate into configured and unconfigured
    const configuredCurrencies = currencies.filter(c => c.configured);
    const unconfiguredCurrencies = currencies.filter(c => !c.configured);

    return successResponseHelper(res, 200, "Configured currencies retrieved successfully", {
      company_id: parseInt(company_id),
      company_name: (company as { dataValues: Record<string, unknown> }).dataValues.company_name,
      total_available: allCryptoTypes.length,
      total_configured: configuredCurrencies.length,
      currencies: currencies,
      configured: configuredCurrencies.map(c => c.type),
      unconfigured: unconfiguredCurrencies.map(c => c.type),
    });
  } catch (e) {
    const errorMessage = getErrorMessage(e);
    apiLogger.error(errorMessage, {}, new Error(e));
    errorResponseHelper(res, 500, errorMessage);
  }
};

export default {
  getData,
  addPayment,
  verifyPayment,
  verifyCryptoPayment,
  createCryptoPayment,
  confirmPayment,
  getBalance,
  authStep,
  getCurrencyRates,
  getPaymentLinks,
  getPaymentLinkById,
  updatePaymentLink,
  deletePaymentLink,
  createPaymentLink,
  cryptoVerification,
  checkingUSDT,
  sweepNativeAdminFees,
  checkFeeBalance,
  checkOnBlockchair,
  removeUnwantedSubscriptions,
  processIncompletePayments,
  getNetworkFees,
  calculatePaymentAmount,
  getConfiguredCurrenciesForCheckout,
  getFeePreview,
  getCompanyConfiguredCurrencies,
  calculateCheckoutFees,
};

