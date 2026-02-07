/**
 * Merchant Pool Configuration
 * 
 * Shared constants, config, types, and utilities used across all pool modules.
 */

import { Op } from "sequelize";
import {
  UTXO_CHAINS as MODEL_UTXO_CHAINS,
  TOKEN_CHAINS as MODEL_TOKEN_CHAINS,
} from "../../models";
import { getErrorMessage } from "../../helper";

// Configuration
export const POOL_CONFIG = {
  INITIAL_SIZE: parseInt(process.env.MERCHANT_POOL_INITIAL_SIZE || "2"),
  
  // Pre-warming: minimum AVAILABLE addresses to maintain per merchant per chain
  MIN_AVAILABLE: parseInt(process.env.MERCHANT_POOL_MIN_AVAILABLE || "1"),
  
  // Timeout settings
  RESERVATION_TIMEOUT_MINUTES: parseInt(process.env.RESERVATION_TIMEOUT_MINUTES || "120"),
  PROCESSING_TIMEOUT_MINUTES: 60,
  STALE_LOCK_TIMEOUT_MINUTES: 120,
  
  // Smart Gas Funding Settings
  GAS_SAFETY_BUFFER: 1.3,  // 30% extra to ensure transaction success
  
  // Minimum gas to maintain (fallback if estimation fails)
  TRX_GAS_FALLBACK: 15,
  ETH_GAS_FALLBACK: 0.001,
  
  // Minimum deficit to trigger funding (avoid micro-transactions)
  TRX_MIN_DEFICIT: 2,
  ETH_MIN_DEFICIT: 0.0002,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
  SWEEP_RETRY_DELAY_MS: 5000,
};

// UTXO chains that support batch transfers
export const UTXO_CHAINS = MODEL_UTXO_CHAINS || ["BTC", "LTC", "DOGE", "BCH"];

// Native currencies that can use both threshold and time-based sweep
export const NATIVE_CURRENCIES = ["TRX", "ETH"];

// Tokens that can only use threshold-based sweep
export const TOKEN_CHAINS = MODEL_TOKEN_CHAINS || ["USDT-TRC20", "USDT-ERC20", "USDC-ERC20"];

// Fee wallet addresses (for gas funding)
export const FEE_WALLETS = {
  TRX: process.env.TRX_FEE_WALLET || "",
  ETH: process.env.ETH_FEE_WALLET || "",
};

// Admin wallets for sweeping
export const ADMIN_WALLETS: Record<string, string> = {
  "BTC": process.env.BTC || "",
  "ETH": process.env.ETH || "",
  "LTC": process.env.LTC || "",
  "DOGE": process.env.DOGE || "",
  "TRX": process.env.TRX || "",
  "BCH": process.env.BCH || "",
  "USDT-TRC20": process.env.USDT_TRC20_ADMIN_WALLET || process.env.USDT_TRC20 || "",
  "USDT-ERC20": process.env.USDT_ERC20_ADMIN_WALLET || process.env.USDT_ERC20 || "",
  "USDC-ERC20": process.env.USDC_ERC20 || "",
};

// Token contract addresses
export const TOKEN_CONTRACTS: Record<string, string> = {
  "USDT-TRC20": process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "USDT-ERC20": process.env.ETH_CONTRACT || "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "USDC-ERC20": process.env.USDC_CONTRACT || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
};

/**
 * Sweep configuration per chain
 */
export interface SweepConfig {
  mode: "threshold" | "time" | "batch";
  value?: number;
}

const parseSweepConfig = (walletType: string): SweepConfig => {
  if (UTXO_CHAINS.includes(walletType)) {
    return { mode: "batch" };
  }

  const envKey = `${walletType.replace(/-/g, "_")}_SWEEP`;
  const configValue = process.env[envKey];

  if (!configValue) {
    console.warn(`[MerchantPool] No sweep config for ${walletType}, using default: threshold:30`);
    return { mode: "threshold", value: 30 };
  }

  const [mode, valueStr] = configValue.split(":");

  if (mode !== "threshold" && mode !== "time") {
    console.error(`[MerchantPool] Invalid sweep mode for ${walletType}: ${mode}. Using threshold:30`);
    return { mode: "threshold", value: 30 };
  }

  if (TOKEN_CHAINS.includes(walletType) && mode === "time") {
    console.error(`[MerchantPool] Tokens cannot use time-based sweep! ${walletType} must use threshold. Using threshold:30`);
    return { mode: "threshold", value: 30 };
  }

  const value = valueStr ? parseInt(valueStr) : (mode === "threshold" ? 30 : 10);

  if (isNaN(value) || value <= 0) {
    console.error(`[MerchantPool] Invalid sweep value for ${walletType}: ${valueStr}. Using default.`);
    return { mode, value: mode === "threshold" ? 30 : 10 };
  }

  return { mode, value };
};

export const getSweepConfig = (walletType: string): SweepConfig => {
  return parseSweepConfig(walletType);
};

/**
 * Retry helper with exponential backoff
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = POOL_CONFIG.MAX_RETRIES,
  delayMs: number = POOL_CONFIG.RETRY_DELAY_MS
): Promise<T> => {
  let lastError: Error | null = null;
  
  const NON_RETRYABLE_ERRORS = [
    'invalid address', 'invalid private key', 'insufficient balance',
    'insufficient funds', 'nonce too low', 'replacement transaction underpriced',
    'already known', 'invalid signature', 'bad request', 'unauthorized',
    'forbidden', 'not found', '400', '401', '403', '404',
  ];
  
  const isRetryable = (error: Error): boolean => {
    const message = error.message?.toLowerCase() || '';
    return !NON_RETRYABLE_ERRORS.some(pattern => message.includes(pattern.toLowerCase()));
  };
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      const message = getErrorMessage(error);
      
      if (!isRetryable(lastError)) {
        console.error(`[MerchantPool] ❌ ${operationName} failed with non-retryable error: ${message}`);
        throw lastError;
      }
      
      if (attempt < maxRetries) {
        const waitTime = delayMs * Math.pow(2, attempt - 1);
        console.warn(`[MerchantPool] ⚠️ ${operationName} failed (attempt ${attempt}/${maxRetries}): ${message}`);
        console.warn(`[MerchantPool] Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.error(`[MerchantPool] ❌ ${operationName} failed after ${maxRetries} attempts: ${message}`);
      }
    }
  }
  
  throw lastError;
};

// Minimum time to wait before considering a webhook "failed" (in minutes)
export const WEBHOOK_GRACE_PERIOD_MINUTES = 10;

// Re-export Op for convenience
export { Op };
