/**
 * TRON Energy & Resource Optimization Service
 * 
 * Provides real-time TRON network data for:
 * - Energy/Bandwidth price fetching (via TronGrid HTTP API)
 * - Account resource checking (available staked Energy)
 * - Dynamic feeLimit calculation for TRC20 transfers
 * - Cost-saving estimation and logging
 * 
 * Post Proposal #104 (Aug 2025): Energy price reduced from 420 → 100 SUN/unit
 * This service fetches live data so fee calculations remain accurate.
 */

import axios from "axios";
import { cronLogger } from "../utils/loggers";
import { getRedisItem, setRedisItem } from "../utils/redisInstance";

// ─── Constants ───────────────────────────────────────────────────────────────

// TronGrid public API (no key required for basic queries)
const TRONGRID_API = process.env.TRONGRID_API_URL || "https://api.trongrid.io";

// Redis cache keys
const CACHE_KEYS = {
  NETWORK_PARAMS: "tron:network_params",
  ACCOUNT_RESOURCES_PREFIX: "tron:resources:",
  ACCOUNT_ACTIVATED_PREFIX: "tron:activated:",
};

// Cache TTLs (seconds)
const CACHE_TTL = {
  NETWORK_PARAMS: 300,      // 5 min — network params change rarely
  ACCOUNT_RESOURCES: 30,    // 30 sec — resources can change with each block
  ACCOUNT_ACTIVATED: 3600,  // 1 hour — activation status is permanent once true
};

// Energy required for TRC20 transfers
export const TRC20_ENERGY = {
  EXISTING_RECIPIENT: 65000,   // Transfer to a wallet that already holds the token
  NEW_RECIPIENT: 130000,       // Transfer to a wallet that has never held the token
};

// Bandwidth for a typical TRC20 transfer (~345 bytes)
export const TRC20_BANDWIDTH = 345;

// Fallback values (post Proposal #104, Aug 2025)
const FALLBACK = {
  ENERGY_PRICE_SUN: parseInt(process.env.TRON_ENERGY_PRICE_SUN || "100"),
  BANDWIDTH_PRICE_SUN: 1000,
  FREE_BANDWIDTH: 600,
};

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TronNetworkParams {
  energyPriceSun: number;
  bandwidthPriceSun: number;
  totalEnergyLimit: number;
  totalEnergyWeight: number;
  totalBandwidthLimit: number;
  totalBandwidthWeight: number;
  timestamp: number;
}

export interface AccountResources {
  address: string;
  energyLimit: number;
  energyUsed: number;
  availableEnergy: number;
  bandwidthLimit: number;
  freeBandwidth: number;
  bandwidthUsed: number;
  availableBandwidth: number;
  hasSufficientEnergy: boolean;
  timestamp: number;
}

export interface FeeLimitResult {
  feeLimit: number;
  energyNeeded: number;
  energyAvailable: number;
  energyDeficit: number;
  estimatedCostTRX: number;
  isNewRecipient: boolean;
  savingsPercent: number;
}

// ─── Network Parameter Fetching ──────────────────────────────────────────────

/**
 * Fetch current TRON network parameters (energy price, bandwidth price, etc.)
 * Uses TronGrid /wallet/getchainparameters endpoint.
 */
export const getTronNetworkParams = async (): Promise<TronNetworkParams> => {
  // Check Redis cache
  try {
    const cached = await getRedisItem(CACHE_KEYS.NETWORK_PARAMS) as TronNetworkParams | null;
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL.NETWORK_PARAMS * 1000) {
      return cached;
    }
  } catch (_cacheErr) {
    // Continue without cache
  }

  try {
    const chainParamsRes = await axios.post(
      `${TRONGRID_API}/wallet/getchainparameters`,
      {},
      { timeout: 8000 }
    );

    let energyPriceSun = FALLBACK.ENERGY_PRICE_SUN;
    let bandwidthPriceSun = FALLBACK.BANDWIDTH_PRICE_SUN;

    const params = chainParamsRes.data?.chainParameter || [];
    for (const p of params) {
      if (p.key === "getEnergyFee") {
        energyPriceSun = p.value;
      }
      if (p.key === "getTransactionFee") {
        bandwidthPriceSun = p.value;
      }
    }

    // Override from env if explicitly set
    if (process.env.TRON_ENERGY_PRICE_SUN) {
      energyPriceSun = parseInt(process.env.TRON_ENERGY_PRICE_SUN);
    }

    const result: TronNetworkParams = {
      energyPriceSun,
      bandwidthPriceSun,
      totalEnergyLimit: 0,
      totalEnergyWeight: 0,
      totalBandwidthLimit: 0,
      totalBandwidthWeight: 0,
      timestamp: Date.now(),
    };

    // Cache result
    try {
      await setRedisItem(CACHE_KEYS.NETWORK_PARAMS, result);
    } catch (_e) {
      // Non-critical
    }

    cronLogger.info(`[TronEnergy] 📊 Network params: Energy=${energyPriceSun} SUN/unit, Bandwidth=${bandwidthPriceSun} SUN/point`);
    return result;

  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.warn(`[TronEnergy] ⚠️ Failed to fetch network params: ${err.message}, using fallbacks`);
    return {
      energyPriceSun: FALLBACK.ENERGY_PRICE_SUN,
      bandwidthPriceSun: FALLBACK.BANDWIDTH_PRICE_SUN,
      totalEnergyLimit: 0,
      totalEnergyWeight: 0,
      totalBandwidthLimit: 0,
      totalBandwidthWeight: 0,
      timestamp: Date.now(),
    };
  }
};

// ─── Account Resource Checking ───────────────────────────────────────────────

/**
 * Get an account's available Energy and Bandwidth resources.
 * Uses TronGrid /wallet/getaccountresource endpoint.
 */
export const getAccountResources = async (address: string): Promise<AccountResources> => {
  const cacheKey = `${CACHE_KEYS.ACCOUNT_RESOURCES_PREFIX}${address}`;

  // Check cache (short TTL)
  try {
    const cached = await getRedisItem(cacheKey) as AccountResources | null;
    if (cached && cached.timestamp && (Date.now() - cached.timestamp) < CACHE_TTL.ACCOUNT_RESOURCES * 1000) {
      return cached;
    }
  } catch (_e) {
    // Continue
  }

  try {
    const response = await axios.post(
      `${TRONGRID_API}/wallet/getaccountresource`,
      { address, visible: true },
      { timeout: 8000 }
    );

    const data = response.data;

    const energyLimit = data.EnergyLimit || 0;
    const energyUsed = data.EnergyUsed || 0;
    const availableEnergy = Math.max(0, energyLimit - energyUsed);

    const freeBandwidth = data.freeNetLimit || FALLBACK.FREE_BANDWIDTH;
    const freeBandwidthUsed = data.freeNetUsed || 0;
    const stakedBandwidth = data.NetLimit || 0;
    const stakedBandwidthUsed = data.NetUsed || 0;

    const totalBandwidth = freeBandwidth + stakedBandwidth;
    const totalBandwidthUsed = freeBandwidthUsed + stakedBandwidthUsed;
    const availableBandwidth = Math.max(0, totalBandwidth - totalBandwidthUsed);

    const result: AccountResources = {
      address,
      energyLimit,
      energyUsed,
      availableEnergy,
      bandwidthLimit: stakedBandwidth,
      freeBandwidth,
      bandwidthUsed: totalBandwidthUsed,
      availableBandwidth,
      hasSufficientEnergy: availableEnergy >= TRC20_ENERGY.EXISTING_RECIPIENT,
      timestamp: Date.now(),
    };

    // Cache
    try {
      await setRedisItem(cacheKey, result);
    } catch (_e) {
      // Non-critical
    }

    return result;

  } catch (error: unknown) {
    const err = error as { message?: string };
    cronLogger.warn(`[TronEnergy] ⚠️ Failed to get resources for ${address}: ${err.message}`);
    return {
      address,
      energyLimit: 0,
      energyUsed: 0,
      availableEnergy: 0,
      bandwidthLimit: 0,
      freeBandwidth: FALLBACK.FREE_BANDWIDTH,
      bandwidthUsed: 0,
      availableBandwidth: FALLBACK.FREE_BANDWIDTH,
      hasSufficientEnergy: false,
      timestamp: Date.now(),
    };
  }
};

// ─── Recipient Activation Check ──────────────────────────────────────────────

/**
 * Check if a recipient address has received a specific TRC20 token before.
 * New recipients cost ~2x energy (130k vs 65k).
 */
export const isRecipientActivatedForToken = async (
  recipientAddress: string,
  tokenContractAddress: string
): Promise<boolean> => {
  const cacheKey = `${CACHE_KEYS.ACCOUNT_ACTIVATED_PREFIX}${recipientAddress}:${tokenContractAddress}`;

  // Check cache (long TTL — once activated, stays activated)
  try {
    const cached = await getRedisItem(cacheKey) as { activated?: boolean } | null;
    if (cached && cached.activated !== undefined) {
      return cached.activated;
    }
  } catch (_e) {
    // Continue
  }

  try {
    // FIX: Add retry logic with exponential backoff and TronScan fallback
    let lastError: unknown;
    
    // Attempt 1: TronGrid API (primary)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await axios.get(
          `${TRONGRID_API}/v1/accounts/${recipientAddress}/tokens/trc20?contract_address=${tokenContractAddress}&limit=1`,
          { timeout: 10000 } // FIX: Increased timeout from 8s → 10s
        );

        const tokens = response.data?.data || [];
        const activated = tokens.length > 0 && parseFloat(tokens[0]?.balance || "0") > 0;

        // Only cache if activated (permanent state)
        if (activated) {
          try {
            await setRedisItem(cacheKey, { activated: true });
          } catch (_e) {
            // Non-critical
          }
        }

        return activated;
      } catch (err: unknown) {
        lastError = err;
        if (attempt === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1s backoff before retry
        }
      }
    }

    // Attempt 2: TronScan API fallback
    try {
      const tronscanResponse = await axios.get(
        `https://apilist.tronscanapi.com/api/account/tokens?address=${recipientAddress}&token=${tokenContractAddress}&start=0&limit=1`,
        { timeout: 8000, headers: { 'Accept': 'application/json' } }
      );
      
      const tronscanTokens = tronscanResponse.data?.data || tronscanResponse.data?.tokens || [];
      const activated = tronscanTokens.length > 0;
      
      if (activated) {
        try {
          await setRedisItem(cacheKey, { activated: true });
        } catch (_e) { /* Non-critical */ }
      }
      
      cronLogger.info(`[TronEnergy] Token activation check succeeded via TronScan fallback for ${recipientAddress}: ${activated}`);
      return activated;
    } catch (_tronscanErr) {
      // Both APIs failed
    }

    // Default to existing recipient (cheaper estimate, safer)
    cronLogger.warn(`[TronEnergy] ⚠️ Could not check token activation for ${recipientAddress} after retries, assuming existing`);
    return true;

  } catch (_error: unknown) {
    // Default to existing recipient (cheaper estimate, safer)
    cronLogger.warn(`[TronEnergy] ⚠️ Could not check token activation for ${recipientAddress}, assuming existing`);
    return true;
  }
};

// ─── Dynamic feeLimit Calculation ────────────────────────────────────────────

/**
 * Calculate optimal feeLimit for a TRC20 transfer.
 * Considers: current energy price, sender's staked Energy, recipient activation.
 * Returns feeLimit in TRX (not SUN).
 */
export const calculateOptimalFeeLimit = async (
  senderAddress: string,
  recipientAddress: string,
  tokenContractAddress?: string
): Promise<FeeLimitResult> => {
  const [networkParams, senderResources] = await Promise.all([
    getTronNetworkParams(),
    getAccountResources(senderAddress),
  ]);

  // Check if recipient is new (costs 2x energy)
  let isNewRecipient = false;
  if (tokenContractAddress) {
    isNewRecipient = !(await isRecipientActivatedForToken(recipientAddress, tokenContractAddress));
  }

  const energyNeeded = isNewRecipient
    ? TRC20_ENERGY.NEW_RECIPIENT
    : TRC20_ENERGY.EXISTING_RECIPIENT;

  // Energy deficit = what must be burned as TRX
  const energyDeficit = Math.max(0, energyNeeded - senderResources.availableEnergy);

  // Cost of energy deficit in SUN, then convert to TRX
  const energyCostSun = energyDeficit * networkParams.energyPriceSun;

  // Bandwidth cost — check if free bandwidth covers it
  let bandwidthCostSun = 0;
  if (senderResources.availableBandwidth < TRC20_BANDWIDTH) {
    bandwidthCostSun = TRC20_BANDWIDTH * networkParams.bandwidthPriceSun;
  }

  const totalCostSun = energyCostSun + bandwidthCostSun;
  const estimatedCostTRX = totalCostSun / 1_000_000;

  // feeLimit with 20% safety buffer, minimum 5 TRX
  const minFeeLimit = parseInt(process.env.TRON_MIN_FEE_LIMIT_TRX || "5");
  const maxFeeLimit = parseInt(process.env.TRON_MAX_FEE_LIMIT_TRX || "30");
  const feeLimitTRX = Math.max(Math.ceil(estimatedCostTRX * 1.2), minFeeLimit);
  const finalFeeLimit = Math.min(feeLimitTRX, maxFeeLimit);

  const savingsPercent = ((50 - finalFeeLimit) / 50) * 100;

  cronLogger.info(
    `[TronEnergy] 💡 Fee optimization: ` +
    `Energy needed=${energyNeeded}, available=${senderResources.availableEnergy}, deficit=${energyDeficit} | ` +
    `Est. cost=${estimatedCostTRX.toFixed(2)} TRX | feeLimit=${finalFeeLimit} TRX (was 50, saving ${savingsPercent.toFixed(0)}%)`
  );

  return {
    feeLimit: finalFeeLimit,
    energyNeeded,
    energyAvailable: senderResources.availableEnergy,
    energyDeficit,
    estimatedCostTRX,
    isNewRecipient,
    savingsPercent,
  };
};

// ─── Dynamic TRC20 Fee for SmartGas ─────────────────────────────────────────

/**
 * Calculate the TRX amount needed for a TRC20 transfer (for SmartGas funding).
 * Returns the estimated TRX cost considering available Energy.
 */
export const calculateDynamicTRC20Fee = async (
  senderAddress?: string
): Promise<{ fast: number; energyPrice: number; energyNeeded: number; energyAvailable: number }> => {
  const networkParams = await getTronNetworkParams();

  let availableEnergy = 0;
  if (senderAddress) {
    try {
      const resources = await getAccountResources(senderAddress);
      availableEnergy = resources.availableEnergy;
    } catch (_e) {
      // Continue with 0 available
    }
  }

  // Assume existing recipient (65k energy) as the common case
  const energyNeeded = TRC20_ENERGY.EXISTING_RECIPIENT;
  const energyDeficit = Math.max(0, energyNeeded - availableEnergy);

  // Cost in TRX
  const energyCostTRX = (energyDeficit * networkParams.energyPriceSun) / 1_000_000;

  // Bandwidth cost (~0.345 TRX in worst case at 1000 SUN/point)
  const bandwidthCostTRX = (TRC20_BANDWIDTH * networkParams.bandwidthPriceSun) / 1_000_000;
  const totalCostTRX = energyCostTRX + bandwidthCostTRX;

  // Round up with 15% buffer, min 1 TRX
  const fastFee = Math.max(Math.ceil(totalCostTRX * 1.15 * 10) / 10, 1);

  cronLogger.info(
    `[TronEnergy] 📊 Dynamic TRC20 fee: ${fastFee} TRX ` +
    `(energy: ${energyNeeded} needed, ${availableEnergy} available, ${energyDeficit} deficit @ ${networkParams.energyPriceSun} SUN/unit)`
  );

  return {
    fast: fastFee,
    energyPrice: networkParams.energyPriceSun,
    energyNeeded,
    energyAvailable: availableEnergy,
  };
};

// ─── Cost Savings Logger ─────────────────────────────────────────────────────

/**
 * Log cost comparison between old (hardcoded) and new (dynamic) fee approach.
 */
export const logCostSavings = (
  context: string,
  oldFeeTRX: number,
  newFeeTRX: number,
  details?: Record<string, unknown>
): void => {
  const savedTRX = oldFeeTRX - newFeeTRX;
  const savedPercent = oldFeeTRX > 0 ? ((savedTRX / oldFeeTRX) * 100).toFixed(1) : "0";

  cronLogger.info(
    `[TronEnergy] 💰 COST SAVINGS [${context}]: ` +
    `Old=${oldFeeTRX} TRX → New=${newFeeTRX.toFixed(2)} TRX | ` +
    `Saved=${savedTRX.toFixed(2)} TRX (${savedPercent}%)` +
    (details ? ` | ${JSON.stringify(details)}` : "")
  );
};

// ─── TRX Native Transfer Fee ────────────────────────────────────────────────

// Bandwidth needed for a simple TRX native transfer (~270 bytes)
const TRX_NATIVE_BANDWIDTH = 270;

/**
 * Calculate fee for a native TRX transfer.
 * TRX native transfers use ONLY Bandwidth (no Energy).
 * With 600 free daily Bandwidth points, most transfers are FREE.
 * If bandwidth exhausted: ~0.27 TRX per transfer (270 bytes × 1000 SUN/byte).
 */
export const calculateDynamicTRXNativeFee = async (
  senderAddress?: string
): Promise<{ fast: number; medium: number; slow: number; bandwidthFree: boolean }> => {
  let bandwidthFree = false;

  if (senderAddress) {
    try {
      const resources = await getAccountResources(senderAddress);
      if (resources.availableBandwidth >= TRX_NATIVE_BANDWIDTH) {
        bandwidthFree = true;
      }
    } catch (_e) {
      // Continue assuming no free bandwidth
    }
  }

  if (bandwidthFree) {
    cronLogger.info(`[TronEnergy] 🆓 TRX native transfer: FREE (bandwidth available)`);
    return { fast: 0, medium: 0, slow: 0, bandwidthFree: true };
  }

  // Worst case: burn TRX for bandwidth
  const networkParams = await getTronNetworkParams();
  const costSun = TRX_NATIVE_BANDWIDTH * networkParams.bandwidthPriceSun;
  const costTRX = costSun / 1_000_000;
  const fee = Math.max(Math.ceil(costTRX * 1.1 * 10) / 10, 0.5); // 10% buffer, min 0.5 TRX

  cronLogger.info(
    `[TronEnergy] 📊 TRX native fee: ${fee} TRX (${TRX_NATIVE_BANDWIDTH} bandwidth @ ${networkParams.bandwidthPriceSun} SUN/point)`
  );

  return { fast: fee, medium: fee, slow: fee, bandwidthFree: false };
};

// ─── Optimization Diagnostics ────────────────────────────────────────────────

/**
 * Returns a full diagnostic snapshot of TRON fee optimization status.
 * Useful for monitoring dashboards and verifying the service works.
 */
export const getOptimizationDiagnostics = async (
  testAddress?: string
): Promise<Record<string, unknown>> => {
  const networkParams = await getTronNetworkParams();

  let accountResources = null;
  if (testAddress) {
    try {
      accountResources = await getAccountResources(testAddress);
    } catch (_e) {
      accountResources = { error: "Failed to fetch" };
    }
  }

  // Calculate comparison: old vs new fees
  const oldTRC20FeeTRX = 20;
  const oldFeeLimitTRX = 50;
  const oldNativeTRXFee = 10;

  // New dynamic calculations
  const newEnergyDeficit = TRC20_ENERGY.EXISTING_RECIPIENT; // Worst case: no staked Energy
  const newTRC20CostSun = newEnergyDeficit * networkParams.energyPriceSun + TRC20_BANDWIDTH * networkParams.bandwidthPriceSun;
  const newTRC20CostTRX = newTRC20CostSun / 1_000_000;

  const newNativeCostSun = TRX_NATIVE_BANDWIDTH * networkParams.bandwidthPriceSun;
  const newNativeCostTRX = newNativeCostSun / 1_000_000;

  return {
    service: "TRON Energy Optimization Service",
    status: "active",
    networkParams: {
      energyPriceSun: networkParams.energyPriceSun,
      bandwidthPriceSun: networkParams.bandwidthPriceSun,
      fetchedAt: new Date(networkParams.timestamp).toISOString(),
      source: "TronGrid API (cached 5 min)",
    },
    trc20Transfer: {
      energyRequired: {
        existingRecipient: TRC20_ENERGY.EXISTING_RECIPIENT,
        newRecipient: TRC20_ENERGY.NEW_RECIPIENT,
      },
      bandwidthRequired: TRC20_BANDWIDTH,
      costEstimate: {
        worstCaseTRX: Math.ceil(newTRC20CostTRX * 1.2),
        oldHardcodedTRX: oldTRC20FeeTRX,
        savingsPercent: (((oldTRC20FeeTRX - newTRC20CostTRX) / oldTRC20FeeTRX) * 100).toFixed(1),
      },
      feeLimit: {
        oldHardcodedTRX: oldFeeLimitTRX,
        newDynamicMaxTRX: parseInt(process.env.TRON_MAX_FEE_LIMIT_TRX || "30"),
        newDynamicMinTRX: parseInt(process.env.TRON_MIN_FEE_LIMIT_TRX || "5"),
      },
    },
    trxNativeTransfer: {
      bandwidthRequired: TRX_NATIVE_BANDWIDTH,
      costEstimate: {
        withBandwidthTRX: 0,
        withoutBandwidthTRX: Math.ceil(newNativeCostTRX * 1.1 * 10) / 10,
        oldHardcodedTRX: oldNativeTRXFee,
        savingsPercent: (((oldNativeTRXFee - newNativeCostTRX) / oldNativeTRXFee) * 100).toFixed(1),
      },
    },
    accountResources: accountResources,
    config: {
      TRON_MIN_FEE_LIMIT_TRX: process.env.TRON_MIN_FEE_LIMIT_TRX || "5",
      TRON_MAX_FEE_LIMIT_TRX: process.env.TRON_MAX_FEE_LIMIT_TRX || "30",
      TRON_ENERGY_PRICE_SUN: process.env.TRON_ENERGY_PRICE_SUN || "auto (from TronGrid)",
    },
  };
};

export default {
  getTronNetworkParams,
  getAccountResources,
  isRecipientActivatedForToken,
  calculateOptimalFeeLimit,
  calculateDynamicTRC20Fee,
  calculateDynamicTRXNativeFee,
  getOptimizationDiagnostics,
  logCostSavings,
  TRC20_ENERGY,
  TRC20_BANDWIDTH,
  FALLBACK,
};
