import express from "express";
import {
  currencyConvert,
  decrypt,
  encrypt,
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
  userWalletAddressModel,
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

// Retry configuration
const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY_MS: 2000,
};

/**
 * Retry helper with exponential backoff for blockchain operations
 */
const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES
): Promise<T> => {
  let lastError: Error | null = null;
  
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
    } catch (error: any) {
      lastError = error;
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
    
    // Check database cache first
    const cachedRate = await taxRateModel.findOne({
      where: { country_code: upperCountryCode }
    });

    if (cachedRate) {
      taxRate = parseFloat((cachedRate as any).dataValues.standard_rate) || 0;
      taxAcronym = (cachedRate as any).dataValues.tax_acronym || taxAcronym;
      countryName = (cachedRate as any).dataValues.country_name || countryName;
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
      } catch (apiError: any) {
        console.log(`[Tax] API error for ${upperCountryCode}, using fallback:`, apiError.message);
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
  } catch (error: any) {
    console.error(`[Tax] Error calculating tax:`, error.message);
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

    const item = await getRedisItem("customer-" + data);

    // Only log for debugging when item exists or in development
    if (process.env.NODE_ENV === 'development' || (item && Object.keys(item).length > 0)) {
      console.log("[getData] Payment lookup:", { hasItem: !!item && Object.keys(item).length > 0, dataRef: data?.substring(0, 10) + '...' });
    }
    
    // Check if item exists
    if (!item || Object.keys(item).length === 0) {
      return errorResponseHelper(res, 404, "Payment link not found or expired");
    }
    
    // Get company info if company_id exists
    let companyInfo: any = null;
    let paymentSettings: any = {
      initial_window_minutes: 15,      // Default: 15 minutes to pay after selecting crypto
      grace_period_minutes: 30,        // Default: 30 minutes to complete partial payment
      overpayment_threshold_usd: 5,    // Default: $5 minimum overpayment to handle
    };
    
    if (item.company_id) {
      try {
        const company = await companyModel.findByPk(item.company_id);
        if (company) {
          const companyData = (company as any).dataValues;
          companyInfo = {
            company_name: companyData.company_name || null,
            company_logo: companyData.photo || null,  // Only include if available
          };
          
          // Override defaults with company-specific settings if configured
          if (companyData.grace_period_minutes !== undefined && companyData.grace_period_minutes !== null) {
            paymentSettings.grace_period_minutes = parseInt(companyData.grace_period_minutes);
          }
          if (companyData.overpayment_threshold_usd !== undefined && companyData.overpayment_threshold_usd !== null) {
            paymentSettings.overpayment_threshold_usd = parseFloat(companyData.overpayment_threshold_usd);
          }
        }
      } catch (companyError) {
        console.warn(`[getData] Failed to fetch company info:`, companyError);
      }
    }
    
    // Get fee configuration (internal calculation - not exposed to public)
    const transactionFeePercent = Number(process.env.TRANSACTION_FEE_PERCENT) || 2.0;
    const feeTiers = (await import("../utils/feeConfigUtils")).getFeeTiers();
    const amount = Number(item.base_amount || item.amount || 0);
    
    // Find applicable fee tier based on amount (includes fixed fee and blockchain buffer)
    let fixedFee = 0;
    let blockchainBuffer = 0;
    for (const tier of feeTiers) {
      if (amount >= tier.min && (tier.max === null || amount <= tier.max)) {
        fixedFee = tier.fixed;
        blockchainBuffer = tier.buffer || 0;
        break;
      }
    }
    
    // Calculate total processing fee (internal - details not exposed)
    // Total fees = transaction fee % + fixed fee + blockchain buffer % + network fee
    const feeAmountPercent = (amount * transactionFeePercent) / 100;
    const bufferAmount = (amount * blockchainBuffer) / 100;
    
    // Include blockchain network fee for consistency with getCurrencyRates
    let networkFeeUSD = 0;
    try {
      const networkFee = await getBlockchainNetworkFee('ETH'); // Use ETH as default for USD display
      networkFeeUSD = Number(networkFee.feeInUSD) || 0;
    } catch (e) {
      console.log('[getData] Could not fetch network fee, using 0');
    }
    
    const totalProcessingFee = parseFloat((feeAmountPercent + fixedFee + bufferAmount + networkFeeUSD).toFixed(2));
    const totalWithFees = amount + totalProcessingFee;
    
    // Calculate expiry countdown
    let expiryInfo: any = null;
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
    
    // Tax calculation - only if merchant enabled apply_tax
    let taxInfo: any = null;
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
    const grandTotal = amount + totalProcessingFee + taxAmount; // Keep for reference
    
    let payload;
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
        // Enhanced checkout data
        transaction_id: item.transaction_id,
        order_reference: orderReference,
        description: item.description || null,
        merchant: companyInfo,
        // Payment timing settings - passed upfront for checkout to display
        payment_settings: paymentSettings,
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
            pending_usd: item.incomplete_payment.pending_amount, // TODO: Convert to USD if needed
            timestamp: item.incomplete_payment.timestamp,
            remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
            qr_code: item.incomplete_payment.qr_code,
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
              pending_usd: item.incomplete_payment.pending_amount,
              timestamp: item.incomplete_payment.timestamp,
              remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
              qr_code: item.incomplete_payment.qr_code,
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
              pending_usd: item.incomplete_payment.pending_amount,
              timestamp: item.incomplete_payment.timestamp,
              remaining_minutes: Math.max(0, Math.ceil((new Date(item.incomplete_payment.timestamp).getTime() + paymentSettings.grace_period_minutes * 60 * 1000 - Date.now()) / 60000)),
              qr_code: item.incomplete_payment.qr_code,
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
          const { note } = paymentRes.meta.authorization;
          const { payment_code } = paymentRes.data;
          finalRes = { hash: uniqueRef, note, payment_code };
          await setRedisItem(uniqueRef, {
            ...items,
            mode: paymentTypes.USSD,
          });
        }

        if (value.paymentType === paymentTypes.MOBILE_MONEY) {
          const { paymentRes, uniqueRef } = await MobileMoney(value, userData);
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          if (value.currency === "KES") {
            finalRes = { hash: uniqueRef };
          } else {
            finalRes = { hash: uniqueRef, ...paymentRes?.meta?.authorization };
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
          const { paymentRes, uniqueRef } = await Crypto(value, {
            ...userData,
            adm_id: items.adm_id,
            customer_id: items.customer_id,
            company_id: items.company_id,  // Pass company_id for proper wallet filtering
          }, true);  // Use crypto-specific webhook for proper verification
          console.log("paymentRes=============>", paymentRes, uniqueRef);
          
          // Calculate remaining minutes for crypto invoice (default 15 minutes from now)
          const CRYPTO_INVOICE_MINUTES = 15;
          finalRes = { 
            hash: uniqueRef, 
            ...paymentRes,
            remaining_minutes: CRYPTO_INVOICE_MINUTES,  // Frontend uses this for invoice countdown timer
          };
          
          // Get fee_payer mode from original payment link data
          const fee_payer = items.fee_payer || 'company';
          const baseAmountUSD = Number(items.base_amount || items.amount || 0);
          
          // Calculate merchant_amount and fees based on fee_payer mode
          const ADMIN_FEE_PERCENT = Number(process.env.ADMIN_FEE_PERCENT) || 0.33;
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
          
          if (fee_payer === 'customer') {
            // Customer pays fees - merchant gets base + tax
            const baseCrypto = taxAmount > 0 
              ? crypto_amount * (baseAmountUSD / (baseAmountUSD + taxAmount + (crypto_amount - crypto_amount * baseAmountUSD / (baseAmountUSD + taxAmount))))
              : crypto_amount / (1 + ADMIN_FEE_PERCENT / (1 - ADMIN_FEE_PERCENT));
            total_fees_crypto = crypto_amount - baseCrypto - taxAmountCrypto;
            merchant_amount_crypto = baseCrypto + taxAmountCrypto;
          } else {
            // Company pays fees - standard deduction
            merchant_amount_crypto = crypto_amount * (1 - ADMIN_FEE_PERCENT);
            total_fees_crypto = crypto_amount * ADMIN_FEE_PERCENT;
          }
          
          // Clear any existing data for this address before setting new payment data
          await deleteRedisItem("crypto-" + paymentRes.address);
          await setRedisItem("crypto-" + paymentRes.address, {
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
  console.log('[DEBUG] Step 1: JWT decoded successfully');
  
  try {
    const data: IFundData = req.body;
    console.log('[DEBUG] Step 2: Request body parsed:', { uniqueRef: data?.uniqueRef, currency: data?.currency });
    
    if (data) {
      let finalRes;
      console.log('[DEBUG] Step 3: About to call getRedisItem with key:', "customer-" + data.uniqueRef);
      
      const items = await getRedisItem("customer-" + data.uniqueRef);
      
      console.log('[DEBUG] Step 4: Redis item retrieved successfully:', { adm_id: items?.adm_id, company_id: items?.company_id });

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
      const requestedCurrency = data.currency;
      
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
        if (!availableCurrenciesList.includes(requestedCurrency)) {
          console.log(`[Phase 11] Currency ${requestedCurrency} not in available list:`, availableCurrenciesList);
          return errorResponseHelper(
            res,
            400,
            `${requestedCurrency} is not available for this payment. Available currencies: ${availableCurrenciesList.join(', ')}`
          );
        }
        console.log(`[Phase 11] Currency ${requestedCurrency} validated against available list:`, availableCurrenciesList);
      }

      // PHASE 12: Check for existing incomplete payment - prevent currency switching
      // This ensures customer completes partial payment on same currency before switching
      if (items.incomplete_payment) {
        const incompletePayment = items.incomplete_payment;
        const incompleteTimestamp = new Date(incompletePayment.timestamp);
        const gracePeriodMs = 30 * 60 * 1000; // 30 minutes
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
        const existingRedisData = await getRedisItem("crypto-" + existingAddress);
        
        // Only return existing address if it's still pending (not completed/expired)
        if (existingRedisData && existingRedisData.status === 'pending') {
          console.log(`[Phase 12.1] ✓ Returning existing address for same payment link + currency: ${existingAddress}`);
          return successResponseHelper(res, 200, "Using existing payment address", {
            qr_code: items.active_crypto_address.qr_code,
            address: existingAddress,
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
      
      const whereClause: any = {
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
          const userCompany = await companyModel.findOne({
            where: { user_id: items.adm_id },
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

      const tokenData: any = {
        ref: data.uniqueRef,
        adm_id: items.adm_id,
        customer_id: items.customer_id,
        company_id: items.company_id || hasWallet.dataValues.company_id,  // Include company_id from Redis or wallet
      };
      const { paymentRes, uniqueRef } = await Crypto(data, tokenData, true);
      
      // Determine fee_payer mode
      const fee_payer = items.fee_payer || 'company';
      
      // Fee percentage (33% admin fee)
      const ADMIN_FEE_PERCENT = 0.33;
      
      // Calculate crypto amount using FastForex
      let baseAmountUSD = Number(items.base_amount || items.amount || 0);
      let taxAmount = 0;
      let taxInfo: any = null;
      
      // TAX HANDLING: If apply_tax is enabled, calculate tax based on customer location
      if (items.apply_tax) {
        console.log(`[createCryptoPayment] Tax enabled, detecting customer location...`);
        
        // Get customer IP and detect country
        const clientIP = getClientIP(req);
        const geoLocation = await getCountryFromIP(clientIP, req.headers);
        
        if (geoLocation && geoLocation.country_code) {
          console.log(`[createCryptoPayment] Detected country: ${geoLocation.country_name} (${geoLocation.country_code})`);
          
          // Calculate tax using the same function as getData
          taxInfo = await calculateTaxForCheckout(
            geoLocation.country_code,
            baseAmountUSD,
            items.base_currency || 'USD'
          );
          
          if (taxInfo && taxInfo.tax_amount > 0) {
            taxAmount = taxInfo.tax_amount;
            console.log(`[createCryptoPayment] Tax calculated: ${taxInfo.tax_rate}% ${taxInfo.tax_acronym} = ${taxAmount} ${items.base_currency || 'USD'}`);
            console.log(`[createCryptoPayment] Total with tax: ${taxInfo.total} ${items.base_currency || 'USD'}`);
          }
        } else {
          console.log(`[createCryptoPayment] Could not detect customer country, no tax applied`);
        }
      }
      
      // Total amount customer should pay (base + tax if applicable)
      const totalAmountWithTax = baseAmountUSD + taxAmount;
      
      let crypto_amount = 0;           // What customer should pay (includes tax)
      let merchant_amount_crypto = 0;  // What merchant receives (base amount only, no tax)
      let total_fees_crypto = 0;       // Admin fees
      let tax_amount_crypto = 0;       // Tax in crypto (goes to merchant as collected tax)
      let exchange_rate = 0;
      
      try {
        // Get the crypto amount for the TOTAL value (base + tax) using FastForex
        const cryptoRates = await currencyConvert({
          sourceCurrency: items.base_currency || 'USD',
          currency: [requestedCurrency],
          amount: totalAmountWithTax,  // Use total with tax
          fixedDecimal: false,
        });
        const total_crypto_amount = parseFloat(cryptoRates[0]?.amount?.toString() || '0');
        exchange_rate = parseFloat(cryptoRates[0]?.transferRate?.toString() || '0');
        
        // Calculate base crypto amount (without tax) for merchant amount calculation
        const base_crypto_amount = taxAmount > 0 
          ? total_crypto_amount * (baseAmountUSD / totalAmountWithTax)
          : total_crypto_amount;
        
        // Calculate tax amount in crypto
        tax_amount_crypto = taxAmount > 0 
          ? total_crypto_amount * (taxAmount / totalAmountWithTax)
          : 0;
        
        console.log(`[createCryptoPayment] Crypto amount calculated:
          - Base amount: ${baseAmountUSD} ${items.base_currency || 'USD'}
          - Tax amount: ${taxAmount} ${items.base_currency || 'USD'}
          - Total with tax: ${totalAmountWithTax} ${items.base_currency || 'USD'}
          - Total crypto: ${total_crypto_amount} ${requestedCurrency}
          - Base crypto: ${base_crypto_amount} ${requestedCurrency}
          - Tax crypto: ${tax_amount_crypto} ${requestedCurrency}
          - Exchange rate: 1 ${items.base_currency || 'USD'} = ${exchange_rate} ${requestedCurrency}`);
        
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
          total_fees_crypto = base_crypto_amount * ADMIN_FEE_PERCENT / (1 - ADMIN_FEE_PERCENT);  // Calculate fees on base only
          merchant_amount_crypto = merchant_base_crypto + tax_amount_crypto;  // Merchant gets base + tax
          crypto_amount = merchant_base_crypto + total_fees_crypto + tax_amount_crypto;  // Customer pays base + fees + tax
          
          console.log(`[createCryptoPayment] CUSTOMER PAYS FEES mode (with tax):
            - Customer pays: ${crypto_amount.toFixed(8)} ${requestedCurrency} (base + fees + tax)
            - Merchant receives: ${merchant_amount_crypto.toFixed(8)} ${requestedCurrency} (base + tax)
            - Admin fees: ${total_fees_crypto.toFixed(8)} ${requestedCurrency} (swept later)
            - Tax collected: ${tax_amount_crypto.toFixed(8)} ${requestedCurrency} (included in merchant amount)`);
            
        } else {
          // COMPANY (MERCHANT) PAYS FEES:
          // - Customer pays: base_amount + tax
          // - Merchant receives: base_amount * (1 - fee_percent) + tax = 67% of base + full tax
          // - Admin receives: base_amount * fee_percent = 33% of base (swept from temp wallet)
          
          crypto_amount = total_crypto_amount;  // Customer pays base + tax
          const merchant_base_after_fees = base_crypto_amount * (1 - ADMIN_FEE_PERCENT);  // 67% of base
          merchant_amount_crypto = merchant_base_after_fees + tax_amount_crypto;  // 67% of base + tax
          total_fees_crypto = base_crypto_amount * ADMIN_FEE_PERCENT;  // 33% of base
          
          console.log(`[createCryptoPayment] COMPANY PAYS FEES mode (with tax):
            - Customer pays: ${crypto_amount.toFixed(8)} ${requestedCurrency} (base + tax)
            - Merchant receives: ${merchant_amount_crypto.toFixed(8)} ${requestedCurrency} (67% base + tax)
            - Admin fees: ${total_fees_crypto.toFixed(8)} ${requestedCurrency} (33% of base, swept later)
            - Tax collected: ${tax_amount_crypto.toFixed(8)} ${requestedCurrency} (included in merchant amount)`);
        }
      } catch (calcError) {
        console.error('[createCryptoPayment] Crypto amount calculation error:', calcError);
        // Fallback to data.amount if conversion fails
        crypto_amount = data.amount || 0;
        merchant_amount_crypto = crypto_amount * (1 - ADMIN_FEE_PERCENT);
        total_fees_crypto = crypto_amount * ADMIN_FEE_PERCENT;
      }
      
      // Add crypto amount and rate to response
      // Calculate remaining minutes for crypto invoice (default 15 minutes from now)
      const CRYPTO_INVOICE_MINUTES = 15;
      finalRes = { 
        hash: uniqueRef, 
        ...paymentRes,
        amount: crypto_amount,
        merchant_amount: merchant_amount_crypto,
        fees: total_fees_crypto,
        fee_payer: fee_payer,
        base_amount: baseAmountUSD,
        base_currency: items.base_currency || 'USD',
        rate: exchange_rate,
        remaining_minutes: CRYPTO_INVOICE_MINUTES,  // Frontend uses this for invoice countdown timer
        // Tax info (if applicable)
        ...(taxInfo && {
          tax_info: {
            tax_amount: taxAmount,
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
      await deleteRedisItem("crypto-" + paymentRes.address);
      
      await setRedisItem("crypto-" + paymentRes.address, {
        mode: paymentTypes.CRYPTO,
        amount: crypto_amount,                  // Crypto amount customer should pay (includes tax)
        merchant_amount: merchant_amount_crypto, // Amount merchant should receive (includes tax)
        total_fees: total_fees_crypto,          // Total fees (admin's portion - from base only)
        fee_payer: fee_payer,                   // Who pays fees
        base_amount_usd: baseAmountUSD,         // Original USD amount (without tax)
        total_amount_usd: totalAmountWithTax,   // Total USD amount (with tax if applicable)
        status: "pending",
        ref: uniqueRef,
        currency: data.currency,
        payment_id: paymentRes.transaction_id,  // Internal payment ID (NOT blockchain txId)
        unique_tx_id: paymentRes.transaction_id,  // Alias for backward compatibility with cryptoVerification
        walletType: "customer",
        temp_id: paymentRes.temp_id,
        is_merchant_pool: paymentRes.is_merchant_pool ? "true" : "false",  // CRITICAL: Include merchant pool flag
        // Tax tracking
        ...(taxInfo && {
          tax_enabled: "true",
          tax_amount_usd: taxAmount,
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
          }
        };
        await setRedisItem(uniqueRef, updatedCustomerData);
        console.log(`[Phase 12.1] Stored active_crypto_address for ${uniqueRef}: ${paymentRes.address}`);
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
      //   await deleteRedisItem(uniqueRef);
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
        const walletWhereClause: any = {
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
              "DynoPay Admin",
              totalFee.toFixed(2),
              data.currency,
              (data as any).transaction_id || String(data.id),
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
        // await adminWalletModel.increment("amount", {
        //   by: data.amount_settled - platformCharge,
        //   where: { wallet_type: data.currency },
        // });

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
          try {
            await axios.post(linkData.webhook_url, returnData, { timeout: 30000 });
            webhookLogs.log("info", "Payment link webhook sent successfully!", {
              webhook_url: linkData.webhook_url,
              ...returnData,
            });
          } catch (webhookError) {
            webhookLogs.error("Payment link webhook failed", { 
              webhook_url: linkData.webhook_url,
              error: webhookError.message 
            });
          }
        }
        
        // FIXED: Use soft delete with TTL for checkout status polling
        await softDeleteRedisItem(uniqueRef, 1800); // 30 minutes TTL
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
            transaction_type: tempData?.pathType.includes("addFund")
              ? "CREDIT"
              : "PAYMENT",
            ...(!tempData?.pathType.includes("addFund") && {
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
          const createPaymentWalletWhere: any = {
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
                "DynoPay Admin",
                totalFee.toFixed(2),
                data.currency,
                (data as any).transaction_id || String(data.id),
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
          if (tempData?.pathType.includes("addFund")) {
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
              userPayload.id as any,
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
          await softDeleteRedisItem(uniqueRef, 1800);
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
          await softDeleteRedisItem(uniqueRef, 1800);
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
    redirect_url: process.env.CHECKOUT_URL + "/pay/verify",
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
      redirect_url: process.env.CHECKOUT_URL + "/pay/verify",
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
  const MERCHANT_POOL_CRYPTO_TYPES = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'];
  
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
    const poolAddress = await merchantPoolService.reserveAddress(
      currency,
      paymentId,
      Number(userId),
      parsedCompanyId || 0,  // Pass 0 if no company_id (will be treated as null in DB)
      Number(data.amount) || 0
    );
    
    const address = poolAddress.dataValues.wallet_address;
    console.log(`[Crypto] ✅ Reserved merchant pool address: ${address}`);
    
    // Generate QR code
    let qr_code;
    if (address) {
      const url = await QR_Code.toDataURL(address, { width: 300 });
      qr_code = url;
    }
    
    // Create transaction record
    const walletDetails = await adminWalletModel.findOne({
      where: { wallet_type: currency },
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
      transaction_id: paymentId,
      temp_id: poolAddress.dataValues.temp_address_id,
      is_merchant_pool: true,  // Flag to identify merchant pool address
    };
    
    return { paymentRes, uniqueRef };
  }
  
  // Fallback: Use legacy admin wallet system for unsupported currencies
  console.log(`[Crypto] Using LEGACY admin wallet for ${currency} payment`);
  
  const walletDetails = await (
    await adminWalletModel.findOne({
      where: {
        wallet_type: currency,
      },
    })
  ).dataValues;

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
    
    // Ensure wallet_id is valid
    const walletId = walletDetails.wallet_id;
    if (!walletId || isNaN(Number(walletId))) {
      throw { message: "Invalid wallet configuration" };
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
  isMerchantPool,
}: {
  tempAddressData: any;
  receivedAmount: number;  // This is the admin fee amount
  currency: string;
  transactionId: string;
  userAmount?: number;     // This is the merchant amount
  userAddress?: string;    // Merchant wallet address
  isMerchantPool?: boolean; // Whether this is a merchant pool address
}) => {
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
    if (currency === "USDT-TRC20" || currency === "USDT-ERC20" || currency === "USDC-ERC20") {
      // Token transfers (handled separately)
      const wallet_type = (currency === "USDT-ERC20" || currency === "USDC-ERC20") ? "ETH" : "TRX";
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
      } else {
        contractAddress = process.env.TRX_CONTRACT;
      }

      fees = await tatumApi.feeEstimation(
        currency,
        tempAddressData.wallet_address,
        userAddress,
        Number(userAmount),
        contractAddress
      );

      merchantSendAmount = Number(userAmount);
      
      // Retry merchant transfer for token transfers
      merchantTransactionDetails = await withRetry(
        () => tatumApi.assetToOtherAddress({
          currency,
          fromAddress: tempAddressData.wallet_address,
          toAddress: userAddress,
          privateKey: privateKey,
          amount: merchantSendAmount,
          fee: fees,
          contractAddress,
        }),
        `Token merchant transfer (${currency})`
      );

      totalBlockchainFee = Number(fees?.fast ?? 0);

    } else {
      // Native currency transfers
      const canUseSingleUTXO = ["BTC", "LTC", "DOGE", "BCH"].includes(currency);

      if (canUseSingleUTXO) {
        // UTXO chains: Create single transaction with two outputs (merchant + admin)
        fees = await tatumApi.feeEstimation(
          currency,
          tempAddressData.wallet_address,
          userAddress,
          Number(receivedAmount) + Number(userAmount)
        );

        const feeToDeduct = fees?.fast ?? 0;
        const adminAmount = Number(receivedAmount);
        merchantSendAmount = Number(userAmount) - Number(feeToDeduct);

        // Retry merchant transfer for UTXO chains
        merchantTransactionDetails = await withRetry(
          () => tatumApi.assetToOtherAddress({
            currency,
            fromAddress: tempAddressData.wallet_address,
            toAddress: userAddress,  // Primary recipient is merchant
            privateKey: privateKey,
            amount: merchantSendAmount,
            fee: String(fees.fast),
            fromUTXO: [
              {
                txHash: transactionId,
                index: 0,
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
        // Account-based chains (ETH, TRX, BSC): Single transfer to merchant only
        // Gas comes from admin's portion (33%), NOT from merchant's portion (67%)
        // Admin fee stays in temp address for batch sweep later
        fees = await tatumApi.feeEstimation(
          currency,
          tempAddressData.wallet_address,
          userAddress,
          Number(userAmount)
        );

        const gasFee = Number(fees?.slow ?? 0);
        // Merchant gets FULL amount - gas is paid from admin's portion (remaining balance)
        merchantSendAmount = Number(Number(userAmount).toFixed(8));

        // Verify there's enough in admin portion to cover gas
        const adminPortion = Number(receivedAmount);
        if (adminPortion < gasFee) {
          throw new Error(`Admin portion insufficient for gas. Admin: ${adminPortion}, Gas: ${gasFee}`);
        }

        console.log(`[settleCryptoTransaction] Account chain ${currency}: Merchant gets FULL ${merchantSendAmount} ${currency}`);
        console.log(`[settleCryptoTransaction] Gas (${gasFee} ${currency}) paid from admin's ${adminPortion} ${currency}`);

        // Retry merchant transfer for account chains (ETH, TRX)
        merchantTransactionDetails = await withRetry(
          () => tatumApi.assetToOtherAddress({
            currency,
            fromAddress: tempAddressData.wallet_address,
            toAddress: userAddress,
            privateKey: privateKey,
            amount: merchantSendAmount,
            fee: fees,
          }),
          `Account chain merchant transfer (${currency})`
        );

        totalBlockchainFee = gasFee;
      }
    }

    // FIX: Verify merchant transaction was actually mined for account-based chains
    // This prevents marking payment complete when TX is stuck due to low gas
    if (["ETH", "BSC", "TRX", "USDT-ERC20", "USDC-ERC20", "USDT-TRC20"].includes(currency)) {
      const txHash = merchantTransactionDetails?.txId;
      if (txHash) {
        console.log(`[settleCryptoTransaction] Waiting for TX confirmation: ${txHash}`);
        const { confirmed, blockNumber } = await tatumApi.waitForTransactionConfirmation(txHash, currency, 90000); // 90 sec timeout
        
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
    };
  } catch (error) {
    const message = getErrorMessage(error);
    apiLogger.error(
      "Failed to transfer funds",
      {
        currency,
        tempAddress: tempAddressData.wallet_address,
        receivedAmount,
        userAmount,
        error: message,
      },
      new Error(error)
    );
    throw error;
  }
};

const verifyCryptoPayment = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { address } = req.body;
    
    console.log("[verifyCryptoPayment] Checking address:", address);
    
    // First check Redis for current payment status
    const tempData = await getRedisItem("crypto-" + address);
    
    console.log("[verifyCryptoPayment] Redis data:", tempData?.status, tempData?.txId ? "has txId" : "no txId");
    
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
    let remainingSeconds = 15 * 60; // Default 15 minutes
    let gracePeriodMinutes = 30; // Default grace period for underpayment completion
    
    // Default merchant settings - $5 overpayment threshold if merchant didn't set it
    let merchantOverpaymentThreshold = 5; // Default $5
    
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
        if (company?.dataValues?.grace_period_minutes !== undefined && 
            company?.dataValues?.grace_period_minutes !== null) {
          gracePeriodMinutes = parseInt(company.dataValues.grace_period_minutes);
        }
      } catch (e) {
        console.log("[verifyCryptoPayment] Could not fetch merchant settings:", e);
      }
    }
    
    const merchantSettings = {
      overpayment_threshold_usd: merchantOverpaymentThreshold,
      grace_period_minutes: gracePeriodMinutes,
    };
    
    // Try to get payment link expiry - FIX: Only query with valid IDs to avoid "undefined" error
    const linkId = customerData?.payment_link_id;
    const paymentId = tempData?.payment_id;
    
    if (linkId || paymentId) {
      try {
        // Build where clause only with valid values
        const whereConditions: any[] = [];
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
            if (linkData.expires_at) {
              const expiresAt = new Date(linkData.expires_at);
              const now = new Date();
              remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
            } else {
              // No explicit expiry - use created_at + default expiry (15 min for initial, 30 min for grace)
              const createdAt = new Date(linkData.createdAt);
              const defaultExpiryMinutes = String(tempData?.incomplete) === "true" ? gracePeriodMinutes : 15;
              const expiresAt = new Date(createdAt.getTime() + defaultExpiryMinutes * 60 * 1000);
              const now = new Date();
              remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
            }
          }
        }
      } catch (e) {
        console.log("[verifyCryptoPayment] Could not fetch payment link expiry:", e);
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
    const baseCurrency = tempData?.base_currency || "USD";
    const baseAmount = parseFloat(tempData?.base_amount || "0");
    
    // IMPORTANT: Check for SUCCESSFUL status FIRST before checking underpaid
    // This prevents returning stale underpaid data after payment completes
    if (redisStatus === "successful") {
      // Payment confirmed - check for overpayment
      const totalReceived = receivedAmount > 0 ? receivedAmount : parseFloat(tempData?.amount || '0');
      const originalExpected = tempData?.originalExpectedAmount ? parseFloat(tempData.originalExpectedAmount) : expectedAmount;
      const isOverpayment = totalReceived > originalExpected && originalExpected > 0;
      const overpaymentAmount = isOverpayment ? (totalReceived - originalExpected) : 0;
      
      // FIXED: Don't re-call cryptoVerification if already processed - just return the status
      // The payment was already distributed when status became "successful"
      console.log("[verifyCryptoPayment] Payment already successful, returning confirmed status");
      
      // Get redirect URL from customerData if available
      let redirectUrl = null;
      if (customerData?.redirect_uri) {
        redirectUrl = customerData.redirect_uri + 
          `?transaction_id=${tempData.payment_id || tempData.unique_tx_id}&status=successful&payment_type=CRYPTO`;
      }
      
      // Calculate USD amounts
      let paidAmountUsd = 0;
      let expectedAmountUsd = baseAmount;
      
      if (totalReceived > 0 && originalExpected > 0 && baseAmount > 0) {
        paidAmountUsd = baseAmount * (totalReceived / originalExpected);
        expectedAmountUsd = baseAmount;
      }
      
      // Build response matching checkout page expected format
      // Checkout expects: status, redirect (for redirect URL), paidAmount, expectedAmount, excessAmount
      const responseData: any = {
        status: isOverpayment ? "overpaid" : "confirmed",
        message: isOverpayment ? "Payment confirmed with overpayment" : "Payment confirmed",
        redirect: redirectUrl,
        txId: tempData.txId,
        paidAmount: parseFloat(totalReceived.toFixed(6)),
        expectedAmount: parseFloat(originalExpected.toFixed(6)),
        currency: currency,
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

      if (isOverpayment) {
        responseData.excessAmount = parseFloat(overpaymentAmount.toFixed(6));
      }

      // DEBUG: Log the exact response being sent
      console.log("[verifyCryptoPayment] Sending CONFIRMED response:", JSON.stringify(responseData, null, 2));

      return successResponseHelper(res, 200, responseData.message, responseData);
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
    
    // Fallback - try original verification
    const result = await cryptoVerification(address, false);
    console.log("result===========>", result, address);
    const { message, status } = result;
    if (status === 500) {
      errorResponseHelper(res, status, message);
    } else {
      const returnData =
        typeof result === "object" && result !== null && "resData" in result
          ? (result as any).resData
          : result;
      successResponseHelper(res, status, "Success", returnData);
    }
  } catch (e) {
    const message = getErrorMessage(e);
    apiLogger.error(message, new Error(e));
    errorResponseHelper(res, 500, message);
  }
};

const cryptoVerification = async (address, webhook = true) => {
  const transaction = await sequelize.transaction();

  try {
    let customerData;
    const tempData = await getRedisItem("crypto-" + address);

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
      const whereClause: any = {
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
        transaction_type: customerData?.pathType.includes("addFund")
          ? "CREDIT"
          : "PAYMENT",
        ...(!customerData?.pathType.includes("addFund") && {
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
          const tempAddressWhereClause: any = {
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
          30 // 30 minutes grace period
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

        await deleteRedisItem("crypto-" + address);
        await setRedisItem("crypto-" + address, redisPayload);

        // PHASE 12: Also update customer Redis key with incomplete payment info
        // This enables blocking currency switching until payment is complete or expired
        const customerRef = tempData.ref;
        if (customerRef) {
          const customerData = await getRedisItem("customer-" + customerRef);
          if (customerData) {
            // Generate QR code for the address
            let qrCode;
            try {
              qrCode = await QR_Code.toDataURL(address, { width: 300 });
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
              }
            };
            await setRedisItem("customer-" + customerRef, updatedCustomerData);
            console.log(`[Phase 12] Updated customer-${customerRef} with incomplete payment info: ${pendingAmount} ${tempCurrency}`);
          }
        }

        transaction.commit();

        throw {
          status: 200,
          paymentStatus: "incomplete",
          amount: pendingAmount,
          currency: tempCurrency,
          message: `Partial payment detected! Please pay remaining ${pendingAmount} ${tempCurrency} to complete this payment. You have 30 minutes to complete the payment.`,
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
          // DynoPay keeps everything else (the fees)
          
          console.log(`[cryptoVerification] Customer pays fees mode:
            - Total received: ${totalAmountReceived} ${tempCurrency}
            - Merchant should receive: ${merchant_amount} ${tempCurrency}
            - Fees for DynoPay: ${Number(totalAmountReceived) - Number(merchant_amount)} ${tempCurrency}`);
          
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
          
          const { totalDeduction, minForwarding, fixedFee, transactionFee, blockchainBuffer } = await calculateTransactionFees(
            tempCurrency,
            Number(amountInUSD[0].amount)  // Pass USD amount for fee calculation
          );

          console.log(`[cryptoVerification] Fee calculation DEBUG:
            - Total received (crypto): ${totalAmountReceived} ${tempCurrency}
            - Total received (USD): $${amountInUSD[0].amount}
            - Fee Breakdown:
              • Fixed Fee: $${fixedFee?.toFixed(2) || 'N/A'} (Tier-based)
              • Transaction Fee (2%): $${transactionFee?.toFixed(2) || 'N/A'}
              • Blockchain Buffer: $${blockchainBuffer?.toFixed(2) || 'N/A'}
            - Total deduction (USD): $${totalDeduction}
            - Min forwarding threshold: $${minForwarding}
            - Effective Fee %: ${(totalDeduction / Number(amountInUSD[0].amount) * 100).toFixed(2)}%
            - Note: High % on small payments due to $${fixedFee} fixed fee (Tier 1: $5-$100)`);

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

        const adminTransferResult = await settleCryptoTransaction({
          tempAddressData: tempAddressData,
          receivedAmount: Number(adminAmountToSend),
          currency: tempCurrency,
          transactionId,
          ...(userAmountToSend > 0 && {
            userAmount: Number(userAmountToSend),
            userAddress: walletData.dataValues.wallet_address,
          }),
          isMerchantPool: String(tempData.is_merchant_pool) === "true",  // Pass merchant pool flag as boolean
        });
        
        console.log(`[cryptoVerification] settleCryptoTransaction result:
          - Admin fee to retain: ${adminAmountToSend} ${tempCurrency}
          - Merchant amount sent: ${adminTransferResult.sendAmount} ${tempCurrency}
          - Merchant TX: ${adminTransferResult.transactionDetails?.txId || 'N/A'}
          - Admin fee retained for sweep: ${adminTransferResult.adminFeeRetained || 0} ${tempCurrency}
          - Is Merchant Pool: ${tempData.is_merchant_pool}
        `);

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
              
              const isUnderThreshold = userAmountToSend === 0 && adminAmountToSend === Number(totalAmountReceived);
              
              await sendAdminFeeReceivedEmail(
                adminEmail,
                "DynoPay Admin",
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
            gasFunded: 0,  // Gas funded amount (if applicable)
            gasUsed: adminTransferResult.blockchainFee || 0,
            incomingTxId: transactionId,
            merchantTxId: adminTransferResult.transactionDetails?.txId,
            status: "completed",
          });
          
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
          if (newAmount[0].amount > 5) {
            overPayment = true;
          }
        }

        if (customerData?.pathType.includes("addFund") || overPayment) {
          if (customerData?.pathType.includes("createPayment") && overPayment) {
            // FIX: Only delete subscription for legacy addresses, not merchant pool
            if (!isMerchantPoolAddress && tempAddressData.subscription_id) {
              await tatumApi.deleteSubscription(tempAddressData.subscription_id);
            }
            await transaction.commit();
            // FIXED: Use soft delete with TTL for checkout status polling
            await setRedisItem("crypto-" + address, {
              ...tempData,
              status: "overpayment",
              completedAt: new Date().toISOString(),
            });
            await softDeleteRedisItem("crypto-" + address, 1800);
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
          } else if (customerData?.pathType.includes("cryptoPayment") && overPayment) {
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
              where: { transaction_id: customerPayload.id },
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
        await setRedisItem("crypto-" + address, {
          ...tempData,
          status: "successful",
          completedAt: new Date().toISOString(),
        });
        await softDeleteRedisItem(tempData.ref, 1800); // 30 minutes TTL
        await softDeleteRedisItem("crypto-" + address, 1800); // 30 minutes TTL

        if (webhook) {
          // FIXED: Use callMerchantWebhook instead of legacy callWebHook
          // callMerchantWebhook properly looks up webhook_url from payment_link or company
          const { company_id, customer_id, ...transferDetails } = customerPayload;
          try {
            await callMerchantWebhook(customerData, {
              event: "payment.confirmed",
              payment_id: customerPayload.id,
              transaction_reference: transactionId,
              status: customerPayload.status,
              amount: userAmountToSend,
              currency: tempCurrency,
              base_amount: customerData?.base_amount,
              base_currency: customerData?.base_currency,
              meta_data: customerData?.meta_data ? JSON.parse(customerData.meta_data) : null,
              completed_at: new Date().toISOString(),
            });
            console.log("[cryptoVerification] Merchant webhook sent successfully");
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
          await sendPaymentReceivedEmail(
            userData?.email,
            userData?.name,
            userAmountToSend.toString(),  // amount
            tempCurrency,                 // currency
            companyName,                  // companyName
            transactionId,                // transactionId
            paymentDateStr,               // date
            paymentTimeStr                // time
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
          } else {
            console.log(`[cryptoVerification] No customer email available for payment confirmation`);
          }
        } catch (customerEmailError) {
          console.error("[cryptoVerification] Customer payment confirmation email failed:", customerEmailError.message);
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

const timer = (ms) => new Promise((res) => setTimeout(res, ms));

const userWallet = async (data: IFundData, tokenData: IUserType) => {
  const id = tokenData.id;
  const customer_id = (await customerModel.findOne({ where: { id } }))
    .dataValues.customer_id;
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
        currencyRateList.map(async (rate: any) => {
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
              const feeResult = await calculateTransactionFees(chain, amount);
              
              const fixedFee = Number(feeResult.fixedFee) || 0;
              const transactionFee = Number(feeResult.transactionFee) || 0;
              const blockchainBuffer = Number(feeResult.blockchainBuffer) || 0;
              const networkFeeUSD = Number(networkFee.feeInUSD) || 0;
              
              const totalFeesUSD = fixedFee + transactionFee + blockchainBuffer + networkFeeUSD;
              const taxAmountNum = Number(tax_amount) || 0;
              const totalAmountUSD = amount + totalFeesUSD + taxAmountNum;
              
              // Round all amounts to 2 decimal places for consistency
              const roundedTotalFeesUSD = parseFloat(totalFeesUSD.toFixed(2));
              const roundedTotalAmountUSD = parseFloat((amount + roundedTotalFeesUSD + taxAmountNum).toFixed(2));
              
              // Get the exchange rate and convert fees/tax to target currency
              const exchangeRate = Number(rate.transferRate) || 1;
              const convertedBaseAmount = Number(rate.amount) || 0;
              const convertedTotalFees = parseFloat((roundedTotalFeesUSD * exchangeRate).toFixed(2));
              const convertedTaxAmount = parseFloat((taxAmountNum * exchangeRate).toFixed(2));
              const convertedTotalAmount = parseFloat((roundedTotalAmountUSD * exchangeRate).toFixed(2));
              
              console.log(`[getCurrencyRates] ${rate.currency} (fiat): base=$${amount} USD = ${convertedBaseAmount} ${rate.currency}, tax=$${taxAmountNum.toFixed(2)} USD = ${convertedTaxAmount} ${rate.currency}, fees=$${roundedTotalFeesUSD.toFixed(2)} USD = ${convertedTotalFees} ${rate.currency}, total=$${roundedTotalAmountUSD.toFixed(2)} USD = ${convertedTotalAmount} ${rate.currency}`);
              
              return {
                ...rate,
                fee_payer: 'customer',
                base_amount: parseFloat(amount.toFixed(2)),
                base_amount_usd: parseFloat(amount.toFixed(2)),
                // Include tax in breakdown (converted to target currency)
                tax_amount: convertedTaxAmount,
                tax_amount_usd: parseFloat(taxAmountNum.toFixed(2)),
                // Simplified - only show total processing fee (converted to target currency)
                processing_fee: convertedTotalFees,
                processing_fee_usd: roundedTotalFeesUSD,
                total_amount: convertedTotalAmount,
                total_amount_usd: roundedTotalAmountUSD,
                total_amount_source: roundedTotalAmountUSD,
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
            
            const cryptoPrice = parseFloat(rate.amount) > 0 ? amount / parseFloat(rate.amount) : 0;
            
            // Use pre-fetched network fee if available, fallback to individual fetch
            const networkFee = allBlockchainFees[chain] || await getBlockchainNetworkFee(chain);
            const feeResult = await calculateTransactionFees(
              chain,
              amount
            );
            
            // Ensure all fee values are valid numbers (protection against NaN/undefined)
            const fixedFee = Number(feeResult.fixedFee) || 0;
            const transactionFee = Number(feeResult.transactionFee) || 0;
            const blockchainBuffer = Number(feeResult.blockchainBuffer) || 0;
            const networkFeeUSD = Number(networkFee.feeInUSD) || 0;
            
            // Calculate totals including tax - round USD amounts to 2 decimals for consistency
            const totalFeesUSD = fixedFee + transactionFee + blockchainBuffer + networkFeeUSD;
            const roundedTotalFeesUSD = parseFloat(totalFeesUSD.toFixed(2));
            const taxAmountNum = Number(tax_amount) || 0;
            const totalAmountUSD = amount + roundedTotalFeesUSD + taxAmountNum;
            const roundedTotalAmountUSD = parseFloat(totalAmountUSD.toFixed(2));
            const totalAmountCrypto = cryptoPrice > 0 ? roundedTotalAmountUSD / cryptoPrice : 0;
            
            console.log(`[getCurrencyRates] ${rate.currency}: base=$${amount}, tax=$${taxAmountNum.toFixed(2)}, fees=$${roundedTotalFeesUSD.toFixed(2)}, total=$${roundedTotalAmountUSD.toFixed(2)}`);
            
            return {
              ...rate,
              fee_payer: 'customer',
              base_amount: parseFloat(rate.amount),
              base_amount_usd: parseFloat(amount.toFixed(2)),
              // Include tax in breakdown
              tax_amount: parseFloat(taxAmountNum.toFixed(2)),
              // Simplified - only show total processing fee, no breakdown
              processing_fee: roundedTotalFeesUSD,
              total_amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto,
              total_amount_usd: roundedTotalAmountUSD,
              total_amount_source: roundedTotalAmountUSD, // Total in source currency (USD) for display
              amount: fixedDecimal ? totalAmountCrypto.toFixed(8) : totalAmountCrypto, // Override amount with total
            };
          } catch (feeError: any) {
            console.error(`[getCurrencyRates] Fee calc error for ${rate.currency}:`, feeError.message);
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

const getBalance = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const customer = await customerModel.findOne({
      where: {
        id: userData.id,
      },
    });

    const customerData = await customerWalletModel.findOne({
      where: {
        customer_id: customer.dataValues.customer_id,
      },
    });

    const { amount, wallet_type, ...rest } = customerData.dataValues;

    successResponseHelper(res, 200, "Balance retrieved successfully", {
      amount: amount.toFixed(2),
      currency: wallet_type,
    });
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

const createPaymentLink = async (
  req: express.Request,
  res: express.Response
) => {
  const userData = jwt.decode(res.locals.token) as any;
  
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
    // Fixed tax parameters (alternative to apply_tax location-based)
    tax_percentage,   // Fixed tax rate (e.g., 10 for 10%)
    tax_name,         // Tax label (e.g., "VAT", "GST", "Sales Tax")
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
    
    // Phase 11: Validate at least one crypto wallet is configured for this company
    const cryptoTypes = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'];
    
    const walletWhereClause: any = {
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
    
    // Get unique list of available currencies
    const availableCurrencies = [...new Set(configuredWallets.map((w: any) => w.wallet_type))];
    console.log(`[Phase 11] Available currencies for company_id ${company_id}:`, availableCurrencies);
    
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
      return res.status(400).json({
        message: "company_id is required. Please specify which company this payment link belongs to.",
        error: "COMPANY_ID_REQUIRED"
      });
    }
    
    // Verify the company belongs to this user
    const userCompany = await companyModel.findOne({
      where: { 
        company_id: company_id,
        user_id: userData.user_id 
      }
    });
    
    if (!userCompany) {
      return res.status(400).json({
        message: "Invalid company_id. The specified company does not exist or does not belong to you.",
        error: "INVALID_COMPANY_ID"
      });
    }
    
    console.log(`[createPaymentLink] Using company_id: ${company_id} for user: ${userData.user_id}`);
    
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
      payment_link: (process.env.CHECKOUT_URL || '').replace(/\/$/, '') + "/pay?d=" + uniqueRef,
      description: description || null,
      expires_at: expires_at,
      callback_url: callback_url || null,
      redirect_url: redirect_url || null,
      webhook_url: webhook_url || null,
      fee_payer: fee_payer || 'company',  // Default: company pays fees (existing behavior)
      apply_tax: apply_tax || false,  // Tax toggle: OFF by default, merchant must enable
    };

    const links = await paymentLinkModel.create(payload);
    const redisPayload = {
      ...payload,
      pathType: "createLink",
      link_id: links.dataValues.link_id,
      available_currencies: availableCurrencies,  // Phase 11: Store available currencies
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
                Want to accept crypto payments for your own business? Join DynoPay and get <strong>${refereeCodeData.discount}% off</strong> all fees for <strong>${refereeCodeData.duration} days</strong>!
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
        let companyName = "DynoPay Merchant";
        if (company_id) {
          const company = await companyModel.findByPk(company_id);
          if (company) {
            companyName = (company as any).company_name || companyName;
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

    successResponseHelper(res, 200, "Payment link created successfully", links);
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
  const userData = jwt.decode(res.locals.token) as any;
  try {
    const { company_id, page, limit, paginated } = req.query;  // Added pagination params
    
    console.log("userData============>", userData);
    
    // Build where clause with optional company_id filter
    const whereClause: any = {
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

    // Format for UI with computed status
    const formattedLinks = links.map((link: any) => {
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

      return {
        link_id: linkData.link_id,
        transaction_id: linkData.transaction_id,
        description: linkData.description || "No description",
        usd_value: `$${linkData.base_amount}`,
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
  const userData = jwt.decode(res.locals.token) as any;
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
  const userData = jwt.decode(res.locals.token) as any;
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
    callback_url, 
    redirect_url, 
    webhook_url 
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
    const updateData: any = {};
    
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
        
        if (existingRedisData && Object.keys(existingRedisData).length > 0) {
          // Merge updated fields with existing Redis data
          const updatedRedisPayload = {
            ...existingRedisData,
            // Update all fields that could have changed
            email: linkData.email,
            base_amount: linkData.base_amount,
            base_currency: linkData.base_currency,
            description: linkData.description,
            expires_at: linkData.expires_at,
            callback_url: linkData.callback_url,
            redirect_url: linkData.redirect_url,
            webhook_url: linkData.webhook_url,
            fee_payer: linkData.fee_payer,
            apply_tax: linkData.apply_tax,
            allowedModes: linkData.allowedModes,
            updatedAt: new Date().toISOString(),
          };
          
          await setRedisItem("customer-" + uniqueRef, updatedRedisPayload);
          console.log(`[updatePaymentLink] Redis updated for key: customer-${uniqueRef}`);
        } else {
          console.warn(`[updatePaymentLink] No existing Redis data found for key: customer-${uniqueRef}`);
        }
      } else {
        console.warn(`[updatePaymentLink] Could not extract uniqueRef from payment_link: ${paymentLinkUrl}`);
      }
    }

    successResponseHelper(res, 200, "Payment link updated successfully", updatedLink);
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
  const userData = jwt.decode(res.locals.token) as any;
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
      const forwardingWalletWhere: any = {
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

const sendingLeftover = async () => {
  const USDTAddressBalance: ITemporaryAddress[] = await sequelize.query(
    `select ut.* from tbl_user_temp_address ut join tbl_admin_fee_transaction at
    on ut.wallet_address=at.wallet_address
    where ut.wallet_type in ('USDT-ERC20','USDT-TRC20') and ut.status='successful'
    and ut.admin_status='successful' and ut."createdAt" >= NOW() - INTERVAL '2 days' 
    `,
    {
      type: QueryTypes.SELECT,
    }
  );
  for (let i = 0; i < USDTAddressBalance.length; i++) {
    try {
      const currentAddress = USDTAddressBalance[i];

      const wallet_type =
        currentAddress?.wallet_type === "USDT-TRC20" ? "TRX" : "ETH";
      const addressBalance = await tatumApi.getAddressBalance(
        currentAddress?.wallet_address,
        wallet_type
      );
      
      // Get gas fee wallet from tbl_admin_fee_wallet
      // This is correct because leftover ETH/TRX from USDT transfers should be 
      // returned to the gas fee wallet (where it originally came from to fund the transfer)
      const adminFeeWallet = await (
        await adminFeeModel.findOne({
          where: { wallet_type },
        })
      ).dataValues;
      
      if (!adminFeeWallet) {
        console.error(`[sendingLeftover] Gas fee wallet not found for ${wallet_type}`);
        continue;
      }
      
      if (addressBalance?.balance && Number(addressBalance?.balance) > 0) {
        let fees, sendAmount;
        if (wallet_type === "ETH") {
          fees = await tatumApi.feeEstimation(
            wallet_type,
            currentAddress?.wallet_address,
            adminFeeWallet?.wallet_address,
            addressBalance?.balance,
            process.env.ETH_CONTRACT
          );
          sendAmount = (
            Number(addressBalance?.balance) - Number(fees?.slow)
          ).toFixed(5);
        } else {
          sendAmount = Math.floor(addressBalance?.balance / 1000000);
        }
        if (sendAmount && sendAmount > 0) {
          const privateKey = await tatumApi.decryptSymmetric(
            currentAddress.privateKey,
            process.env.TEMP_KEY_ID
          );
          const transactionDetails = await tatumApi.assetToOtherAddress({
            amount: sendAmount,
            currency: wallet_type,
            fee: fees,
            fromAddress: currentAddress?.wallet_address,
            privateKey: privateKey,
            toAddress: adminFeeWallet?.wallet_address,
          });
          const finalAmount = await currencyConvert({
            sourceCurrency: wallet_type,
            currency: ["USD"],
            amount: sendAmount,
            fixedDecimal: false,
          });
          const usd = Number(Number(finalAmount[0].amount).toFixed(2));

          await adminFeeTransactionModel.create({
            wallet_address: currentAddress?.wallet_address,
            amount: sendAmount,
            amount_in_usd: usd,
            wallet_type,
            transaction_id: transactionDetails?.txId,
            status: "successful",
            blockchain_fee: fees?.slow ?? 0,
            transaction_type: "CREDIT",
            amount_to_be_paid: 0,
          });
        }
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
       AND ut."createdAt" >= NOW() - INTERVAL '30 days'`,
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
                adminTxId: (currentAddress as any).adminTxId 
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
      const currentBalance = await tatumApi.getAddressBalance(
        adminFeesWallets[i]?.dataValues.wallet_address,
        adminFeesWallets[i]?.dataValues.wallet_type
      );
      let amount = adminFeesWallets[i]?.dataValues.amount;
      let newBalance =
        adminFeesWallets[i]?.dataValues.wallet_type === "TRX"
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
        // Try to get admin email from database or environment variable
        let adminEmail = process.env.ADMIN_EMAIL || "moxxcompany@gmail.com"; // Default fallback
        
        try {
          const adminData: any[] = await sequelize.query(
            "select email from tbl_admin limit 1",
            {
              type: QueryTypes.SELECT,
            }
          );
          if (adminData && adminData.length > 0 && adminData[0].email) {
            adminEmail = adminData[0].email;
          }
        } catch (dbError) {
          console.log("Could not fetch admin from database, using fallback email:", adminEmail);
        }
        
        textData += `\n\n Please recharge as soon as possible.`;
        
        console.log(`Sending low fee balance alert to: ${adminEmail}`);
        
        await sendEmail(
          adminEmail,
          "DynoPay Admin",
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
    const tempData: any[] = await sequelize.query(
      `select * from tbl_user_temp_address 
      where "createdAt"::date = CURRENT_DATE - INTERVAL '1 day' 
      and "createdAt" <= NOW() - INTERVAL '15 minutes' 
      and status='pending' and check_count=0`,
      { type: QueryTypes.SELECT }
    );
    if (tempData.length > 0) {
      for (let i = 0; i < tempData.length; i++) {
        const addressDetails = await blockchairApi.getAddressStatus(
          tempData[i].wallet_address,
          tempData[i].wallet_type
        );

        const items = await getRedisItem(
          "crypto-" + tempData[i].wallet_address
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
    const tempData: any[] = await sequelize.query(
      `select subscription_id,temp_id from tbl_user_temp_address where "txId" is null 
    and "updatedAt" < NOW() - INTERVAL '1 day' and subscription_id is not null`,
      { type: QueryTypes.SELECT }
    );

    for (let i = 0; i < tempData.length; i++) {
      try {
        await tatumApi.deleteSubscription(tempData[i]?.subscription_id);
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
    const pendingTransactions: any[] = await sequelize.query(
      `SELECT * FROM tbl_user_temp_address 
       WHERE status = 'partial' 
       AND "txId" IS NOT NULL
       AND COALESCE(partial_payment_timestamp, "updatedAt") < NOW() - INTERVAL '30 minutes'`,
      { type: QueryTypes.SELECT }
    );

    if (pendingTransactions.length > 0) {
      console.log(`Found ${pendingTransactions.length} incomplete payments to process after 30-minutes grace period.`);

      for (const tempTx of pendingTransactions) {
        try {
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

            const totalReceived = Number(tempTx.amount) + Number(actualBalance);

            // Check fee_payer mode from temp address record
            const fee_payer = tempTx.fee_payer || 'company';
            const merchant_amount = tempTx.merchant_amount;

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
              tempAddressData: tempTx,
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId,
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
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
                  "DynoPay Admin",
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
              tempAddressData: tempTx,
              receivedAmount: Number(adminAmountToSend),
              currency: tempTx.wallet_type,
              transactionId: tempTx.txId,
              ...(userAmountToSend > 0 && {
                userAmount: Number(userAmountToSend),
                userAddress: merchantWallet.dataValues.wallet_address,
              }),
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
                  "DynoPay Admin",
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
  req: express.Request,
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
    
    // First try to get company_id from payment link using transaction_id
    if (userData.pathType === 'createLink' && userData.transaction_id) {
      const paymentLink = await paymentLinkModel.findOne({
        where: { transaction_id: userData.transaction_id },
        attributes: ['company_id', 'user_id', 'fee_payer', 'base_amount', 'base_currency', 'link_id'],
      });
      
      if (paymentLink) {
        companyId = (paymentLink as any).company_id;
        userId = (paymentLink as any).user_id;
        feePayerFromLink = (paymentLink as any).fee_payer || 'company';
      }
    }
    
    // Fallback: try to get from Redis data
    if (!userId && paymentRef) {
      const redisData = await getRedisItem(`customer-${paymentRef}`);
      if (redisData) {
        companyId = redisData.company_id ? parseInt(redisData.company_id) : null;
        userId = redisData.adm_id ? parseInt(redisData.adm_id) : (redisData.user_id ? parseInt(redisData.user_id) : null);
        feePayerFromLink = redisData.fee_payer || 'company';
      }
    }
    
    if (!userId) {
      return errorResponseHelper(res, 400, "Invalid payment session - merchant not found");
    }
    
    console.log(`[getConfiguredCurrenciesForCheckout] Looking up wallets for user_id: ${userId}, company_id: ${companyId}`);
    
    // Get configured wallets for this merchant
    // IMPORTANT: Only return wallets that have a wallet_address configured
    const walletWhereClause: any = {
      user_id: userId,
      wallet_address: { [Op.not]: null },
      wallet_type: { [Op.in]: ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'BCH', 'USDT-TRC20', 'USDT-ERC20', 'USDC-ERC20'] },
    };
    
    // If company_id exists, filter by it
    if (companyId) {
      walletWhereClause.company_id = companyId;
    }
    
    const configuredWallets = await userWalletModel.findAll({
      where: walletWhereClause,
      attributes: ['wallet_type', 'wallet_address', 'wallet_name'],
    });
    
    // Extract unique currencies (only those with actual addresses)
    const currencies = [...new Set(configuredWallets.map((w: any) => w.wallet_type))];
    
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
        linkId = (paymentLink as any).link_id;
        if (!transactionAmount && (paymentLink as any).base_amount) {
          transactionAmount = parseFloat((paymentLink as any).base_amount);
        }
        if ((paymentLink as any).base_currency) {
          transactionCurrency = (paymentLink as any).base_currency;
        }
        if ((paymentLink as any).fee_payer) {
          feeInfo.fee_payer = (paymentLink as any).fee_payer;
        }
      }
    }
    
    // Calculate total processing fee if customer pays fees (internal calculation - not exposed in detail)
    let totalProcessingFee = 0;
    if (feeInfo.fee_payer === 'customer' && transactionAmount > 0) {
      const feeTiers = (await import("../utils/feeConfigUtils")).getFeeTiers();
      let fixedFee = 0;
      let blockchainBuffer = 0;
      for (const tier of feeTiers) {
        if (transactionAmount >= tier.min && (tier.max === null || transactionAmount <= tier.max)) {
          fixedFee = tier.fixed;
          blockchainBuffer = tier.buffer || 0;
          break;
        }
      }
      const percentageFee = transactionAmount * (feeInfo.transaction_fee_percent / 100);
      const bufferFee = transactionAmount * (blockchainBuffer / 100);
      totalProcessingFee = percentageFee + fixedFee + bufferFee;
    }
    
    const response: any = {
      configured_currencies: currencies,
      wallet_count: configuredWallets.length,
      wallets: configuredWallets.map((w: any) => ({
        currency: w.wallet_type,
        label: w.wallet_name,
        address_masked: w.wallet_address ? 
          `${w.wallet_address.substring(0, 6)}...${w.wallet_address.substring(w.wallet_address.length - 4)}` : 
          null
      })),
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
 * Get fee preview with user's referral discount applied
 * GET /api/pay/fee-preview
 */
const getFeePreview = async (req: express.Request, res: express.Response) => {
  try {
    const userData = jwt.decode(res.locals.token) as any;
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
  sendingLeftover,
  sweepNativeAdminFees,
  checkFeeBalance,
  checkOnBlockchair,
  removeUnwantedSubscriptions,
  processIncompletePayments,
  getNetworkFees,
  calculatePaymentAmount,
  getConfiguredCurrenciesForCheckout,
  getFeePreview,
};

