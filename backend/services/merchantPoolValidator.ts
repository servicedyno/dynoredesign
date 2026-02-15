/**
 * Merchant Pool Configuration Validator
 * Validates all required configurations on backend startup
 * Prevents runtime errors from missing configurations
 */

import { cronLogger } from "../utils/loggers";

export async function validateMerchantPoolConfiguration(): Promise<void> {
  cronLogger.info("[MerchantPool] 🔍 Validating configuration...");

  const errors: string[] = [];
  const warnings: string[] = [];

  // Import constants locally to avoid circular dependency
  const UTXO_CHAINS = ["BTC", "LTC", "DOGE", "BCH"];
  const NATIVE_CURRENCIES = ["TRX", "ETH", "SOL", "XRP", "POLYGON"];
  const TOKEN_CHAINS = ["USDT-TRC20", "USDT-ERC20", "USDC-ERC20", "RLUSD", "RLUSD-ERC20", "USDT-POLYGON"];
  
  const ADMIN_WALLETS: Record<string, string> = {
    BTC: process.env.BTC || "",
    ETH: process.env.ETH || "",
    LTC: process.env.LTC || "",
    DOGE: process.env.DOGE || "",
    TRX: process.env.TRX || "",
    BCH: process.env.BCH || "",
    SOL: process.env.SOL || "",
    XRP: process.env.XRP || "",
    POLYGON: process.env.POLYGON || "",
    "USDT-TRC20": process.env.USDT_TRC20 || "",
    "USDT-ERC20": process.env.USDT_ERC20 || "",
    "USDC-ERC20": process.env.USDC_ERC20 || "",
    "RLUSD": process.env.RLUSD_ADMIN_WALLET || process.env.XRP || "",
    "RLUSD-ERC20": process.env.RLUSD_ERC20 || process.env.ETH || "",
    "USDT-POLYGON": process.env.USDT_POLYGON || process.env.POLYGON || "",
  };
  
  const FEE_WALLETS = {
    TRX: process.env.TRX_FEE_WALLET || "",
    ETH: process.env.ETH_FEE_WALLET || "",
    XRP: process.env.XRP_FEE_WALLET || "",
    POLYGON: process.env.POLYGON_FEE_WALLET || "",
  };

  // 1. Validate Admin Wallets
  const allChains = [...UTXO_CHAINS, ...NATIVE_CURRENCIES, ...TOKEN_CHAINS];
  
  for (const chain of allChains) {
    if (!ADMIN_WALLETS[chain]) {
      errors.push(`Missing admin wallet for ${chain}`);
    } else {
      // Basic address validation (not empty, reasonable length)
      const address = ADMIN_WALLETS[chain];
      if (address.length < 20) {
        errors.push(`Invalid admin wallet address for ${chain}: too short`);
      }
    }
  }

  // 2. Validate Fee Wallets (for account-based chains)
  if (!FEE_WALLETS.TRX) {
    errors.push("Missing TRX fee wallet address (required for TRC20 tokens)");
  }
  if (!FEE_WALLETS.ETH) {
    errors.push("Missing ETH fee wallet address (required for ERC20 tokens)");
  }
  if (!FEE_WALLETS.XRP) {
    errors.push("Missing XRP fee wallet address (required for XRP gas funding)");
  }
  
  // Validate XRP master wallet (required for tag-based XRP/RLUSD payments)
  if (!process.env.XRP_MASTER_WALLET) {
    errors.push("Missing XRP_MASTER_WALLET address (required for XRP/RLUSD tag-based payments)");
  }
  if (!FEE_WALLETS.POLYGON) {
    errors.push("Missing POLYGON fee wallet address (required for USDT-POLYGON)");
  }

  // 3. Validate Sweep Configurations
  const sweepConfigs = [
    { key: "TRX_SWEEP", chain: "TRX", required: false },
    { key: "ETH_SWEEP", chain: "ETH", required: false },
    { key: "USDT_TRC20_SWEEP", chain: "USDT-TRC20", required: false },
    { key: "USDT_ERC20_SWEEP", chain: "USDT-ERC20", required: false },
    { key: "USDC_ERC20_SWEEP", chain: "USDC-ERC20", required: false },
    { key: "RLUSD_SWEEP", chain: "RLUSD", required: false },
    { key: "RLUSD_ERC20_SWEEP", chain: "RLUSD-ERC20", required: false },
    { key: "SOL_SWEEP", chain: "SOL", required: false },
    { key: "XRP_SWEEP", chain: "XRP", required: false },
    { key: "POLYGON_SWEEP", chain: "POLYGON", required: false },
    { key: "USDT_POLYGON_SWEEP", chain: "USDT-POLYGON", required: false },
  ];

  for (const config of sweepConfigs) {
    const value = process.env[config.key];
    if (!value) {
      warnings.push(`${config.key} not configured, will use default: threshold:30`);
    } else {
      // Validate format: mode:value
      const [mode, valueStr] = value.split(":");
      if (!["threshold", "time"].includes(mode)) {
        errors.push(`Invalid sweep mode for ${config.key}: ${mode} (must be threshold or time)`);
      }
      if (!valueStr || isNaN(parseInt(valueStr)) || parseInt(valueStr) <= 0) {
        errors.push(`Invalid sweep value for ${config.key}: ${valueStr} (must be positive number)`);
      }
      
      // Validate tokens can't use time mode
      if (TOKEN_CHAINS.includes(config.chain) && mode === "time") {
        errors.push(`${config.key} cannot use time mode (tokens require threshold only)`);
      }
    }
  }

  // 4. Validate Environment Variables
  const requiredEnvVars = [
    "TEMP_KEY_ID", // For encrypting/decrypting private keys
    "DB_NAME",
    "HOST",
    "DB_PORT",
    "USER_NAME",
    "PASSWORD",
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  // 5. Validate Pool Configuration
  const poolInitialSize = parseInt(process.env.MERCHANT_POOL_INITIAL_SIZE || "2");
  if (isNaN(poolInitialSize) || poolInitialSize < 1) {
    errors.push("MERCHANT_POOL_INITIAL_SIZE must be positive integer");
  }

  // 6. Report Results
  cronLogger.info("[MerchantPool] ========================================");
  
  if (warnings.length > 0) {
    cronLogger.info("[MerchantPool] ⚠️  Configuration Warnings:");
    warnings.forEach(w => cronLogger.info(`[MerchantPool]    - ${w}`));
  }

  if (errors.length > 0) {
    cronLogger.info("[MerchantPool] ❌ Configuration Errors:");
    errors.forEach(e => cronLogger.info(`[MerchantPool]    - ${e}`));
    cronLogger.info("[MerchantPool] ========================================");
    throw new Error(`Merchant Pool configuration validation failed with ${errors.length} errors`);
  }

  cronLogger.info("[MerchantPool] ✅ Configuration validation passed");
  cronLogger.info("[MerchantPool] ========================================");
}

// Export for use in server startup
export default validateMerchantPoolConfiguration;
