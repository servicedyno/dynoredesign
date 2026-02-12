/**
 * Binance WebSocket Price Stream Service
 *
 * Replaces REST polling with a persistent WebSocket connection to Binance.
 * Subscribes to:
 *   - Individual ticker streams for real-time prices
 *   - 5-minute kline streams for volatility calculation
 *
 * Features:
 *   - Auto-reconnect with exponential backoff
 *   - In-memory price + kline cache with Redis sync
 *   - REST fallback when WebSocket is down > 5 minutes
 *   - Circuit breaker for REST fallback to avoid rate-limit loops
 *
 * Reference: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
 */

import WebSocket from "ws";
import axios from "axios";
import { setRedisItemWithTTL, getRedisItem } from "../utils/redisInstance";
import { captureError } from "./errorMonitoringService";

const LOG_PREFIX = "[BinanceWS]";
const log = (msg: string) => console.log(`${LOG_PREFIX} ${msg}`);

// ============================================
// Configuration
// ============================================

const BINANCE_WS_BASE = process.env.BINANCE_WS_URL || "wss://stream.binance.com:9443";
const BINANCE_REST_BASE = process.env.BINANCE_BASE_URL || "https://api.binance.com";

/** All volatile assets we track (same list as volatilityMonitorService) */
export const TRACKED_ASSETS = ["BTC", "ETH", "LTC", "DOGE", "SOL", "XRP", "BCH", "BNB", "TRX", "POL"];

const REDIS_PRICE_KEY = "dynopay:ws:prices";
const REDIS_KLINE_PREFIX = "dynopay:ws:kline:";

/** Max age (ms) before WebSocket data is considered stale and REST fallback kicks in */
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ============================================
// Types
// ============================================

export interface TickerData {
  symbol: string;
  asset: string;
  price: number;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
  updatedAt: number; // Unix ms
}

export interface KlineCandle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  isClosed: boolean;
}

// ============================================
// State
// ============================================

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let pingTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let isConnecting = false;
let lastMessageTime = 0;
let geoBlocked = false; // True when we detect 451 / region-blocked

/** Real-time price cache: { "BTC": TickerData, ... } */
const priceCache: Record<string, TickerData> = {};

/** Rolling kline window: { "BTC": KlineCandle[] } — last 12 candles per asset */
const klineCache: Record<string, KlineCandle[]> = {};

/** REST fallback circuit breaker */
let restFallbackFailures = 0;
let restFallbackCooldownUntil = 0;
const REST_MAX_FAILURES = 3;
const REST_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown after 3 consecutive REST failures

// ============================================
// WebSocket Connection
// ============================================

/**
 * Build the combined stream URL for all tracked assets.
 * Subscribes to both @miniTicker and @kline_5m for each asset.
 */
const buildStreamUrl = (): string => {
  const streams: string[] = [];
  for (const asset of TRACKED_ASSETS) {
    const symbol = `${asset.toLowerCase()}usdt`;
    streams.push(`${symbol}@miniTicker`); // Real-time price
    streams.push(`${symbol}@kline_5m`);   // 5-min candles for volatility
  }
  return `${BINANCE_WS_BASE}/stream?streams=${streams.join("/")}`;
};

/**
 * Connect to Binance WebSocket combined stream.
 */
const connect = () => {
  if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) return;
  isConnecting = true;

  const url = buildStreamUrl();
  log(`Connecting to ${TRACKED_ASSETS.length} streams (${TRACKED_ASSETS.join(", ")})...`);

  try {
    ws = new WebSocket(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DynoPay/1.0)" },
      handshakeTimeout: 15000,
    });
  } catch (err) {
    log(`❌ WebSocket constructor error: ${(err as Error).message}`);
    isConnecting = false;
    scheduleReconnect();
    return;
  }

  ws.on("open", () => {
    isConnecting = false;
    reconnectAttempts = 0;
    lastMessageTime = Date.now();
    log(`✅ Connected — tracking ${TRACKED_ASSETS.length} assets`);

    // Start ping/pong keep-alive every 3 minutes (Binance closes idle after 5 min)
    clearInterval(pingTimer as NodeJS.Timeout);
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 3 * 60 * 1000);
  });

  ws.on("message", (raw: WebSocket.Data) => {
    lastMessageTime = Date.now();
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.stream && msg.data) {
        handleStreamMessage(msg.stream, msg.data);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  ws.on("error", (err) => {
    const errMsg = err.message || "";
    log(`❌ WebSocket error: ${errMsg}`);
    isConnecting = false;

    // Detect geo-restriction (HTTP 451 Unavailable For Legal Reasons)
    if (errMsg.includes("451") || errMsg.includes("403")) {
      if (!geoBlocked) {
        geoBlocked = true;
        log(`🌍 Binance WebSocket geo-blocked from this server region. ` +
          `Will retry every 5 minutes. In production (non-US server), this will work automatically.`);
      }
    }
  });

  ws.on("close", (code, reason) => {
    isConnecting = false;
    clearInterval(pingTimer as NodeJS.Timeout);
    log(`🔌 Connection closed (code=${code}, reason=${reason?.toString() || "none"})`);
    scheduleReconnect();
  });

  ws.on("pong", () => {
    // Connection alive
  });
};

/**
 * Exponential backoff reconnect: 1s, 2s, 4s, 8s, ... capped at 60s.
 * When geo-blocked: slow retry every 5 minutes to detect when region changes.
 */
const scheduleReconnect = () => {
  if (reconnectTimer) return;

  let delay: number;
  if (geoBlocked) {
    delay = 5 * 60 * 1000; // 5 min for geo-blocked (just probing)
  } else {
    delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 60000);
  }
  reconnectAttempts++;

  if (!geoBlocked || reconnectAttempts % 5 === 1) {
    // Only log every 5th attempt when geo-blocked to reduce noise
    log(`Reconnecting in ${(delay / 1000).toFixed(0)}s (attempt #${reconnectAttempts}${geoBlocked ? ", geo-blocked" : ""})...`);
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
};

// ============================================
// Message Handlers
// ============================================

const handleStreamMessage = (stream: string, data: Record<string, unknown>) => {
  if (stream.endsWith("@miniTicker")) {
    handleMiniTicker(data);
  } else if (stream.includes("@kline_")) {
    handleKline(data);
  }
};

/**
 * Handle miniTicker event — updates real-time price cache.
 * Binance miniTicker payload:
 *   { e, E, s, c (close/last price), o (open), h, l, v, q }
 */
const handleMiniTicker = (data: Record<string, unknown>) => {
  const symbol = data.s as string;  // e.g. "BTCUSDT"
  const asset = symbol.replace("USDT", "");

  if (!TRACKED_ASSETS.includes(asset)) return;

  const price = parseFloat(data.c as string);
  const open = parseFloat(data.o as string);
  const changePercent = open > 0 ? ((price - open) / open) * 100 : 0;

  priceCache[asset] = {
    symbol,
    asset,
    price,
    priceChangePercent: parseFloat(changePercent.toFixed(4)),
    volume: parseFloat(data.v as string || "0"),
    quoteVolume: parseFloat(data.q as string || "0"),
    updatedAt: Date.now(),
  };
};

/**
 * Handle kline event — maintains rolling 12-candle window per asset.
 * Binance kline payload:
 *   { e, E, s, k: { t, T, s, i, f, L, o, c, h, l, v, n, x, q, V, Q, B } }
 */
const handleKline = (data: Record<string, unknown>) => {
  const k = data.k as Record<string, unknown>;
  if (!k) return;

  const symbol = k.s as string;
  const asset = symbol.replace("USDT", "");
  if (!TRACKED_ASSETS.includes(asset)) return;

  const candle: KlineCandle = {
    openTime: k.t as number,
    open: parseFloat(k.o as string),
    high: parseFloat(k.h as string),
    low: parseFloat(k.l as string),
    close: parseFloat(k.c as string),
    volume: parseFloat(k.v as string),
    closeTime: k.T as number,
    isClosed: k.x as boolean,
  };

  if (!klineCache[asset]) {
    klineCache[asset] = [];
  }

  const candles = klineCache[asset];

  // Update or append: if openTime matches last candle, update it; otherwise append
  if (candles.length > 0 && candles[candles.length - 1].openTime === candle.openTime) {
    candles[candles.length - 1] = candle;
  } else {
    candles.push(candle);
  }

  // Keep only last 12 candles (60 min of 5-min data)
  if (candles.length > 12) {
    klineCache[asset] = candles.slice(-12);
  }
};

// ============================================
// REST Fallback (when WebSocket is stale/down)
// ============================================

const BINANCE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; DynoPay/1.0)",
  Accept: "application/json",
};

/**
 * Fetch current prices via REST (single call for all symbols).
 * Only used when WebSocket data is stale.
 */
const restFetchPrices = async (): Promise<void> => {
  if (Date.now() < restFallbackCooldownUntil) return; // Respect cooldown

  try {
    const symbols = TRACKED_ASSETS.map((a) => `"${a}USDT"`).join(",");
    const url = `${BINANCE_REST_BASE}/api/v3/ticker/price?symbols=[${symbols}]`;
    const resp = await axios.get(url, { timeout: 10000, headers: BINANCE_HEADERS });

    for (const item of resp.data) {
      const asset = (item.symbol as string).replace("USDT", "");
      if (!TRACKED_ASSETS.includes(asset)) continue;
      priceCache[asset] = {
        symbol: item.symbol,
        asset,
        price: parseFloat(item.price),
        priceChangePercent: priceCache[asset]?.priceChangePercent || 0,
        volume: priceCache[asset]?.volume || 0,
        quoteVolume: priceCache[asset]?.quoteVolume || 0,
        updatedAt: Date.now(),
      };
    }

    restFallbackFailures = 0; // Reset on success
    log("REST fallback price refresh succeeded");
  } catch (err: unknown) {
    restFallbackFailures++;
    const msg = err instanceof Error ? err.message : String(err);

    if (restFallbackFailures >= REST_MAX_FAILURES) {
      restFallbackCooldownUntil = Date.now() + REST_COOLDOWN_MS;
      log(`❌ REST fallback failed ${restFallbackFailures}x — cooling down for ${REST_COOLDOWN_MS / 1000}s`);
      captureError(
        new Error(`Binance REST fallback exhausted after ${restFallbackFailures} failures: ${msg}`),
        "blockchain",
        { severity: "high", extraContext: "REST price fallback circuit open" }
      );
    }
  }
};

/**
 * Fetch kline data via REST for a single asset (fallback).
 */
const restFetchKlines = async (asset: string): Promise<KlineCandle[]> => {
  if (Date.now() < restFallbackCooldownUntil) return []; // Respect cooldown

  const symbol = `${asset}USDT`;
  const url = `${BINANCE_REST_BASE}/api/v3/klines?symbol=${symbol}&interval=5m&limit=12`;

  try {
    const resp = await axios.get(url, { timeout: 10000, headers: BINANCE_HEADERS });
    const candles: KlineCandle[] = resp.data.map((k: unknown[]) => ({
      openTime: k[0] as number,
      open: parseFloat(k[1] as string),
      high: parseFloat(k[2] as string),
      low: parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
      closeTime: k[6] as number,
      isClosed: true,
    }));
    klineCache[asset] = candles.slice(-12);
    return klineCache[asset];
  } catch {
    return [];
  }
};

// ============================================
// Public API
// ============================================

/**
 * Get real-time price for an asset. Uses WebSocket cache first, REST fallback if stale.
 */
export const getPrice = async (asset: string): Promise<number> => {
  const upperAsset = asset.toUpperCase().replace("-ERC20", "").replace("-TRC20", "").replace("-POLYGON", "").replace("-BEP20", "").replace("-SOL", "");
  const cached = priceCache[upperAsset];

  if (cached && (Date.now() - cached.updatedAt) < STALE_THRESHOLD_MS) {
    return cached.price;
  }

  // WebSocket data is stale — try REST fallback
  await restFetchPrices();
  return priceCache[upperAsset]?.price || 0;
};

/**
 * Get all tracked prices. { "BTC": 65000, "ETH": 3200, ... }
 */
export const getAllPrices = async (): Promise<Record<string, number>> => {
  const oldest = Math.min(...Object.values(priceCache).map((t) => t.updatedAt), Date.now());
  if (Object.keys(priceCache).length === 0 || (Date.now() - oldest) > STALE_THRESHOLD_MS) {
    await restFetchPrices();
  }
  const result: Record<string, number> = {};
  for (const [asset, data] of Object.entries(priceCache)) {
    result[asset] = data.price;
  }
  return result;
};

/**
 * Get full ticker data for an asset.
 */
export const getTickerData = (asset: string): TickerData | null => {
  return priceCache[asset.toUpperCase()] || null;
};

/**
 * Get all ticker data.
 */
export const getAllTickerData = (): Record<string, TickerData> => {
  return { ...priceCache };
};

/**
 * Get kline candles for an asset. Falls back to REST if WebSocket hasn't collected enough candles yet.
 */
export const getKlines = async (asset: string): Promise<KlineCandle[]> => {
  const upperAsset = asset.toUpperCase();
  const cached = klineCache[upperAsset];

  // Need at least 7 candles for 30-min ROC calculation
  if (cached && cached.length >= 7) {
    return cached;
  }

  // Not enough WebSocket data yet — fetch via REST (happens during startup)
  return restFetchKlines(upperAsset);
};

/**
 * Check if the WebSocket is currently connected.
 */
export const isConnected = (): boolean => {
  return ws !== null && ws.readyState === WebSocket.OPEN;
};

/**
 * Get the service status for health checks.
 */
export const getStatus = (): {
  connected: boolean;
  lastMessageAge: number;
  trackedAssets: number;
  cachedPrices: number;
  cachedKlines: number;
  reconnectAttempts: number;
  restFallbackFailures: number;
  restCooldownActive: boolean;
} => {
  return {
    connected: isConnected(),
    lastMessageAge: lastMessageTime > 0 ? Date.now() - lastMessageTime : -1,
    trackedAssets: TRACKED_ASSETS.length,
    cachedPrices: Object.keys(priceCache).length,
    cachedKlines: Object.keys(klineCache).length,
    reconnectAttempts,
    restFallbackFailures,
    restCooldownActive: Date.now() < restFallbackCooldownUntil,
  };
};

// ============================================
// Redis Sync (periodic)
// ============================================

let redisSyncTimer: NodeJS.Timeout | null = null;

const syncToRedis = async () => {
  try {
    // Sync prices
    const priceData = JSON.stringify(priceCache);
    await setRedisItemWithTTL(REDIS_PRICE_KEY, priceData, 300);

    // Sync klines (per asset, with shorter TTL)
    for (const [asset, candles] of Object.entries(klineCache)) {
      await setRedisItemWithTTL(`${REDIS_KLINE_PREFIX}${asset}`, JSON.stringify(candles), 120);
    }
  } catch {
    // Redis sync is best-effort
  }
};

// ============================================
// Lifecycle
// ============================================

/**
 * Start the Binance WebSocket price stream.
 * Should be called once during server startup.
 */
export const startBinanceWebSocket = () => {
  log("Starting Binance WebSocket price stream...");
  connect();

  // Sync to Redis every 10 seconds
  clearInterval(redisSyncTimer as NodeJS.Timeout);
  redisSyncTimer = setInterval(syncToRedis, 10000);
};

/**
 * Stop the WebSocket connection and cleanup.
 */
export const stopBinanceWebSocket = () => {
  log("Stopping Binance WebSocket...");

  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (redisSyncTimer) {
    clearInterval(redisSyncTimer);
    redisSyncTimer = null;
  }
};

export default {
  startBinanceWebSocket,
  stopBinanceWebSocket,
  getPrice,
  getAllPrices,
  getTickerData,
  getAllTickerData,
  getKlines,
  isConnected,
  getStatus,
  TRACKED_ASSETS,
};
