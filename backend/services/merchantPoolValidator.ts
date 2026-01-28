/**
 * Merchant Pool Configuration Validator
 * Validates all required configurations on backend startup
 * Prevents runtime errors from missing configurations
 */

import { ADMIN_WALLETS, FEE_WALLETS, UTXO_CHAINS, NATIVE_CURRENCIES, TOKEN_CHAINS } from "./merchantPoolService";

export async function validateMerchantPoolConfiguration(): Promise<void> {
  console.log("[MerchantPool] 🔍 Validating configuration...");

  const errors: string[] = [];
  const warnings: string[] = [];

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

  // 3. Validate Sweep Configurations
  const sweepConfigs = [
    { key: "TRX_SWEEP", chain: "TRX", required: false },
    { key: "ETH_SWEEP", chain: "ETH", required: false },
    { key: "USDT_TRC20_SWEEP", chain: "USDT-TRC20", required: false },
    { key: "USDT_ERC20_SWEEP", chain: "USDT-ERC20", required: false },
    { key: "USDC_ERC20_SWEEP", chain: "USDC-ERC20", required: false },
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
  console.log("[MerchantPool] ========================================");
  
  if (warnings.length > 0) {
    console.log("[MerchantPool] ⚠️  Configuration Warnings:");
    warnings.forEach(w => console.log(`[MerchantPool]    - ${w}`));
  }

  if (errors.length > 0) {
    console.log("[MerchantPool] ❌ Configuration Errors:");
    errors.forEach(e => console.log(`[MerchantPool]    - ${e}`));
    console.log("[MerchantPool] ========================================");
    throw new Error(`Merchant Pool configuration validation failed with ${errors.length} errors`);
  }

  console.log("[MerchantPool] ✅ Configuration validation passed");
  console.log("[MerchantPool] ========================================");
}

// Export for use in server startup
export default validateMerchantPoolConfiguration;
