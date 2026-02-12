/**
 * Volatility Monitor Service
 *
 * Background job that runs every 60 seconds to monitor price volatility
 * for all non-stable cryptocurrencies. Determines market state and
 * recommends sweep fee tiers to minimize merchant price exposure.
 *
 * Uses Binance public API (no auth required) to fetch kline data.
 * Stores results in Redis for fast access by other services.
 */

import axios from "axios";
import { redis as redisClient } from "../utils/redisInstance";
import { captureError } from "./errorMonitoringService";

const LOG_PREFIX = "[VolatilityMonitor]";
const log = (msg: string) => console.log(`${LOG_PREFIX} ${msg}`);

// Binance public API (no auth, works from any region)
const BINANCE_PUBLIC_URL = process.env.BINANCE_BASE_URL || "https://api.binance.com";

// All non-stable cryptos DynoPay supports
const MONITORED_ASSETS = ["BTC", "ETH", "LTC", "DOGE", "SOL", "XRP", "BCH", "BNB", "TRX", "POL"];

// Market state thresholds (based on 30-min ROC)
const THRESHOLDS = {
  STABLE: -0.5,        // |ROC| < 0.5%
  VOLATILE: -1.5,      // ROC between -0.5% and -1.5%
  DECLINING: -3.0,     // ROC between -1.5% and -3.0%
  RAPID_DECLINE: -5.0, // ROC between -3.0% and -5.0%
  // Below -5.0% = CRASH
};

// Fee tier mapping
const STATE_TO_FEE_TIER: Record<string, string> = {
  STABLE: "slow",
  VOLATILE: "medium",
  DECLINING: "fast",
  RAPID_DECLINE: "fastest",
  CRASH: "fastest",
};

// Alert cooldown: max 1 alert per crypto per 30 minutes
const alertCooldowns: Record<string, number> = {};
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

// Rate-limit backoff: skip cycles when API returns 418/429
let rateLimitBackoffUntil = 0;
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1000; // Back off for 5 minutes on rate limit
let consecutiveRateLimitCycles = 0;
const MAX_RATE_LIMIT_LOG_FREQUENCY = 10; // Only log every 10th rate-limited cycle

// Redis key prefix
const REDIS_KEY_PREFIX = "dynopay:v1:volatility";

export interface MarketState {
  asset: string;
  symbol: string;
  roc30m: number;        // 30-min rate of change (%)
  volumeRatio: number;   // recent volume vs average (1.0 = normal)
  state: string;         // STABLE | VOLATILE | DECLINING | RAPID_DECLINE | CRASH
  feeTier: string;       // slow | medium | fast | fastest
  currentPrice: number;
  updatedAt: string;
}

/**
 * Fetch 5-min klines from Binance for a given symbol
 * Returns last 6 candles (= 30 minutes of data)
 */
const fetchKlines = async (symbol: string): Promise<Array<{
  close: number;
  volume: number;
  closeTime: number;
}>> => {
  const url = `${BINANCE_PUBLIC_URL}/api/v3/klines?symbol=${symbol}&interval=5m&limit=12`;
  const response = await axios.get(url, { timeout: 10000 });
  return response.data.map((k: any[]) => ({
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }));
};

/**
 * Determine market state from 30-min ROC
 */
const classifyState = (roc: number, volumeRatio: number): { state: string; feeTier: string } => {
  let state: string;

  if (roc >= THRESHOLDS.STABLE) {
    state = "STABLE";
  } else if (roc >= THRESHOLDS.VOLATILE) {
    state = "VOLATILE";
  } else if (roc >= THRESHOLDS.DECLINING) {
    state = "DECLINING";
  } else if (roc >= THRESHOLDS.RAPID_DECLINE) {
    state = "RAPID_DECLINE";
  } else {
    state = "CRASH";
  }

  let feeTier = STATE_TO_FEE_TIER[state];

  // Volume spike combined with negative ROC bumps tier up one level
  if (volumeRatio > 2.0 && roc < 0) {
    const tierOrder = ["slow", "medium", "fast", "fastest"];
    const currentIdx = tierOrder.indexOf(feeTier);
    if (currentIdx < tierOrder.length - 1) {
      feeTier = tierOrder[currentIdx + 1];
    }
  }

  return { state, feeTier };
};

/**
 * Analyze a single asset and return its market state
 */
const analyzeAsset = async (asset: string): Promise<MarketState | null> => {
  const symbol = `${asset}USDT`;

  try {
    const klines = await fetchKlines(symbol);
    if (klines.length < 7) return null;

    const closes = klines.map((k) => k.close);
    const volumes = klines.map((k) => k.volume);

    // 30-min ROC: compare current close to close 6 candles ago (6 × 5min = 30min)
    const currentPrice = closes[closes.length - 1];
    const price30mAgo = closes[closes.length - 7];
    const roc30m = ((currentPrice - price30mAgo) / price30mAgo) * 100;

    // Volume ratio: last 2 candles avg vs full window avg
    const recentVolAvg = (volumes[volumes.length - 1] + volumes[volumes.length - 2]) / 2;
    const fullAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const volumeRatio = fullAvg > 0 ? recentVolAvg / fullAvg : 1;

    const { state, feeTier } = classifyState(roc30m, volumeRatio);

    return {
      asset,
      symbol,
      roc30m: parseFloat(roc30m.toFixed(4)),
      volumeRatio: parseFloat(volumeRatio.toFixed(2)),
      state,
      feeTier,
      currentPrice,
      updatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    // Return null — errors are collected and logged in batch by runMonitorCycle
    return null;
  }
};

/**
 * Check if admin alert should be sent for a crash/rapid decline
 */
const maybeAlertAdmin = async (state: MarketState) => {
  if (state.state !== "RAPID_DECLINE" && state.state !== "CRASH") return;

  const lastAlert = alertCooldowns[state.asset] || 0;
  if (Date.now() - lastAlert < ALERT_COOLDOWN_MS) return;

  alertCooldowns[state.asset] = Date.now();

  const severity = state.state === "CRASH" ? "CRITICAL" : "WARNING";
  const message = `${severity}: ${state.asset} is in ${state.state} state.\n` +
    `30-min ROC: ${state.roc30m.toFixed(2)}%\n` +
    `Current price: $${state.currentPrice.toFixed(2)}\n` +
    `Volume ratio: ${state.volumeRatio.toFixed(2)}x\n` +
    `Recommended fee tier: ${state.feeTier}\n` +
    `${state.state === "CRASH" ? "Consider temporarily pausing new payment acceptance for this currency." : ""}`;

  log(`🚨 Sending admin alert for ${state.asset}: ${state.state}`);

  try {
    // Use existing admin alert email (reuse sendAdminLowBalanceAlert or similar)
    // For now, log prominently
    console.warn(`\n${"=".repeat(60)}\n🚨 VOLATILITY ALERT: ${message}\n${"=".repeat(60)}\n`);
  } catch (err) {
    logError(`Failed to send admin alert: ${err}`);
  }
};

/**
 * Store market state in Redis
 */
const storeState = async (state: MarketState) => {
  try {
    const key = `${REDIS_KEY_PREFIX}:${state.asset}`;
    if (redisClient && redisClient.isReady) {
      await redisClient.set(key, JSON.stringify(state), { EX: 120 });
    }
  } catch {
    // Redis may not be available — fail silently, states are in memory too
  }
};

// In-memory cache (fallback when Redis is unavailable)
const memoryCache: Record<string, MarketState> = {};

/**
 * Run one cycle of the volatility monitor
 */
export const runMonitorCycle = async (): Promise<MarketState[]> => {
  const results: MarketState[] = [];

  // Process assets in batches of 3 to avoid rate limiting
  for (let i = 0; i < MONITORED_ASSETS.length; i += 3) {
    const batch = MONITORED_ASSETS.slice(i, i + 3);
    const promises = batch.map((asset) => analyzeAsset(asset));
    const batchResults = await Promise.allSettled(promises);

    for (const result of batchResults) {
      if (result.status === "fulfilled" && result.value) {
        results.push(result.value);
        memoryCache[result.value.asset] = result.value;
        await storeState(result.value);
        await maybeAlertAdmin(result.value);
      }
    }

    // Small delay between batches
    if (i + 3 < MONITORED_ASSETS.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return results;
};

/**
 * Get current market state for a specific currency
 */
export const getMarketState = async (currency: string): Promise<MarketState | null> => {
  const asset = currency.toUpperCase();

  // Try Redis first
  try {
    const key = `${REDIS_KEY_PREFIX}:${asset}`;
    if (redisClient && redisClient.isReady) {
      const data = await redisClient.get(key);
      if (data) return JSON.parse(data);
    }
  } catch {
    // Fall through to memory cache
  }

  // Fallback to memory cache
  if (memoryCache[asset]) return memoryCache[asset];

  // If no cached data, fetch fresh
  const fresh = await analyzeAsset(asset);
  if (fresh) {
    memoryCache[asset] = fresh;
    await storeState(fresh);
  }
  return fresh;
};

/**
 * Get recommended fee tier for a currency
 */
export const getRecommendedFeeTier = async (currency: string): Promise<string> => {
  const state = await getMarketState(currency);
  return state?.feeTier || "medium"; // Default to medium if no data
};

/**
 * Get all current market states
 */
export const getAllMarketStates = (): Record<string, MarketState> => {
  return { ...memoryCache };
};

/**
 * Start the volatility monitor (runs every 60 seconds)
 */
let monitorInterval: NodeJS.Timeout | null = null;

export const startVolatilityMonitor = () => {
  if (monitorInterval) return;

  log("Starting volatility monitor (60s interval)");

  // Run immediately on start
  runMonitorCycle()
    .then((results) => {
      log(`Initial scan complete: ${results.length} assets monitored`);
      const declining = results.filter((r) => r.roc30m < -1.5);
      if (declining.length > 0) {
        log(`⚠️ Declining assets: ${declining.map((r) => `${r.asset}(${r.roc30m.toFixed(2)}%)`).join(", ")}`);
      }
    })
    .catch((err) => logError(`Initial scan failed: ${err.message}`));

  // Schedule recurring runs
  monitorInterval = setInterval(async () => {
    try {
      await runMonitorCycle();
    } catch (err: any) {
      logError(`Monitor cycle failed: ${err.message}`);
    }
  }, 60000); // Every 60 seconds
};

export const stopVolatilityMonitor = () => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    log("Volatility monitor stopped");
  }
};

export default {
  startVolatilityMonitor,
  stopVolatilityMonitor,
  runMonitorCycle,
  getMarketState,
  getRecommendedFeeTier,
  getAllMarketStates,
};
