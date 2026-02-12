/**
 * Binance Service - Enhanced with Relay Support
 * 
 * Three modes of operation:
 * 1. Direct: Connect directly to Binance (works from non-US locations)
 * 2. Proxy: Route through HTTP/SOCKS proxy (BINANCE_PROXY_URL)
 * 3. Relay: Route through Railway deployment in non-US region (BINANCE_RELAY_URL)
 */

import crypto from "crypto";
import axios, { AxiosError } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || "";
const BINANCE_BASE_URL = process.env.BINANCE_BASE_URL || "https://api.binance.com";
const BINANCE_PROXY_URL = process.env.BINANCE_PROXY_URL || ""; // e.g., "http://proxy-server:port"
const BINANCE_RELAY_URL = process.env.BINANCE_RELAY_URL || ""; // e.g., "https://your-railway-app.up.railway.app"

// ============================================
// Mode Detection
// ============================================

const getConnectionMode = (): "relay" | "proxy" | "direct" => {
  if (BINANCE_RELAY_URL) {
    console.log(`[Binance] Using RELAY mode through: ${BINANCE_RELAY_URL}`);
    return "relay";
  }
  if (BINANCE_PROXY_URL) {
    console.log(`[Binance] Using PROXY mode through: ${BINANCE_PROXY_URL}`);
    return "proxy";
  }
  console.log(`[Binance] Using DIRECT mode`);
  return "direct";
};

// ============================================
// HMAC-SHA256 Signing
// ============================================

const generateSignature = (queryString: string): string => {
  return crypto
    .createHmac("sha256", BINANCE_API_SECRET)
    .update(queryString)
    .digest("hex");
};

const getTimestamp = (): number => Date.now();

const buildQueryString = (params: Record<string, string | number | boolean | undefined>): string => {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      filtered[key] = String(value);
    }
  }
  return new URLSearchParams(filtered).toString();
};

// ============================================
// HTTP Client with Relay/Proxy/Direct Support
// ============================================

/**
 * Get axios config with optional proxy (only for proxy mode)
 */
const getAxiosConfig = () => {
  const mode = getConnectionMode();
  const config: Record<string, unknown> = {};
  
  if (mode === "proxy" && BINANCE_PROXY_URL) {
    const agent = new HttpsProxyAgent(BINANCE_PROXY_URL);
    config.httpsAgent = agent;
    config.proxy = false; // Disable axios built-in proxy
  }
  
  return config;
};

/**
 * Make request via Railway relay
 */
const makeRelayRequest = async (
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {},
  signed: boolean = false
): Promise<unknown> => {
  const relayUrl = `${BINANCE_RELAY_URL}/api/binance-relay`;
  
  const payload = {
    method,
    endpoint,
    params,
    apiKey: signed ? BINANCE_API_KEY : undefined,
    apiSecret: signed ? BINANCE_API_SECRET : undefined,
    signed
  };
  
  try {
    console.log(`[Binance] Relaying ${method} ${endpoint} through Railway...`);
    
    const response = await axios.post(relayUrl, payload, {
      timeout: 35000, // Slightly longer for relay
      headers: {
        "Content-Type": "application/json"
      }
    });
    
    if (response.data.success) {
      console.log(`[Binance] Relay response received (${response.status})`);
      return response.data.data;
    } else {
      throw new Error(response.data.error || "Relay request failed");
    }
  } catch (error) {
    const axiosError = error as AxiosError<{ error?: string; errorCode?: number }>;
    const errMsg = axiosError.response?.data?.error || axiosError.message;
    const errCode = axiosError.response?.data?.errorCode;
    console.error(`[Binance] Relay error: [${errCode || "RELAY_ERROR"}] ${errMsg}`);
    throw new Error(`Binance relay error [${errCode || "RELAY"}]: ${errMsg}`);
  }
};

const makeSignedRequest = async (
  method: "GET" | "POST" | "DELETE",
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<unknown> => {
  const mode = getConnectionMode();
  
  // Relay mode: forward to Railway endpoint
  if (mode === "relay") {
    return makeRelayRequest(method, endpoint, params, true);
  }
  
  // Direct/Proxy mode: make direct request (with or without proxy)
  const timestamp = getTimestamp();
  const allParams = { ...params, timestamp };
  const queryString = buildQueryString(allParams);
  const signature = generateSignature(queryString);
  const signedQuery = `${queryString}&signature=${signature}`;

  const url = `${BINANCE_BASE_URL}${endpoint}?${signedQuery}`;
  const headers = {
    "X-MBX-APIKEY": BINANCE_API_KEY,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  try {
    const response = await axios({
      method,
      url,
      headers,
      timeout: 30000,
      ...getAxiosConfig(), // Add proxy config if in proxy mode
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ code?: number; msg?: string }>;
    const errMsg = axiosError.response?.data?.msg || axiosError.message;
    const errCode = axiosError.response?.data?.code;
    console.error(`[Binance] ${method} ${endpoint} failed: [${errCode}] ${errMsg}`);
    throw new Error(`Binance API error [${errCode || "NETWORK"}]: ${errMsg}`);
  }
};

const makePublicRequest = async (
  endpoint: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<unknown> => {
  const mode = getConnectionMode();
  
  // Relay mode: forward to Railway endpoint
  if (mode === "relay") {
    return makeRelayRequest("GET", endpoint, params, false);
  }
  
  // Direct/Proxy mode
  const queryString = buildQueryString(params);
  const url = `${BINANCE_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await axios.get(url, { 
      timeout: 15000,
      ...getAxiosConfig() // Add proxy config if in proxy mode
    });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<{ code?: number; msg?: string }>;
    throw new Error(`Binance public API error: ${axiosError.response?.data?.msg || axiosError.message}`);
  }
};

// ============================================
// Account & Server
// ============================================

/** Test connectivity */
export const ping = async (): Promise<void> => {
  await makePublicRequest("/api/v3/ping");
};

/** Get server time */
export const getServerTime = async (): Promise<number> => {
  const data: any = await makePublicRequest("/api/v3/time");
  return data.serverTime;
};

/** Get exchange info */
export const getExchangeInfo = async (): Promise<any> => {
  return await makePublicRequest("/api/v3/exchangeInfo");
};

/** Get account information */
export const getAccountInfo = async (): Promise<any> => {
  return await makeSignedRequest("GET", "/api/v3/account");
};

// ============================================
// Convert API
// ============================================

export const getConvertQuote = async (
  fromAsset: string,
  toAsset: string,
  fromAmount: number
): Promise<any> => {
  return await makeSignedRequest("POST", "/sapi/v1/convert/getQuote", {
    fromAsset,
    toAsset,
    fromAmount
  });
};

export const acceptQuote = async (quoteId: string): Promise<any> => {
  return await makeSignedRequest("POST", "/sapi/v1/convert/acceptQuote", {
    quoteId
  });
};

// Export connection mode for diagnostics
export const getConnectionInfo = () => ({
  mode: getConnectionMode(),
  relayUrl: BINANCE_RELAY_URL || null,
  proxyUrl: BINANCE_PROXY_URL || null,
  baseUrl: BINANCE_BASE_URL
});

export default {
  ping,
  getServerTime,
  getExchangeInfo,
  getAccountInfo,
  getConvertQuote,
  acceptQuote,
  getConnectionInfo
};
