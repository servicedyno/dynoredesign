/**
 * Binance Relay Endpoint
 * Forwards Binance API requests through Railway's non-US IP
 * 
 * Deploy this on Railway (non-US region) and use it as a proxy relay
 * for your main application running elsewhere
 */

import express from "express";
import axios, { AxiosError } from "axios";
import crypto from "crypto";

const router = express.Router();

const BINANCE_BASE_URL = "https://api.binance.com";

/**
 * POST /api/binance-relay
 * 
 * Forwards any Binance API request through Railway's IP
 * 
 * Request body:
 * {
 *   "method": "GET" | "POST" | "DELETE",
 *   "endpoint": "/api/v3/time",
 *   "params": { ... },
 *   "apiKey": "...",
 *   "apiSecret": "...",
 *   "signed": true/false
 * }
 */
router.post("/binance-relay", async (req: express.Request, res: express.Response) => {
  try {
    const {
      method,
      endpoint,
      params = {},
      apiKey,
      apiSecret,
      signed = false
    } = req.body;

    // Validate required fields
    if (!method || !endpoint) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: method, endpoint"
      });
    }

    // Build query string
    let queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null && value !== "")
        .map(([key, value]) => [key, String(value)])
    ).toString();

    // Add signature if needed
    if (signed) {
      if (!apiKey || !apiSecret) {
        return res.status(400).json({
          success: false,
          error: "API key and secret required for signed requests"
        });
      }

      const timestamp = Date.now();
      const paramsWithTimestamp = { ...params, timestamp };
      const paramsString = new URLSearchParams(
        Object.entries(paramsWithTimestamp)
          .filter(([_, value]) => value !== undefined && value !== null && value !== "")
          .map(([key, value]) => [key, String(value)])
      ).toString();

      const signature = crypto
        .createHmac("sha256", apiSecret)
        .update(paramsString)
        .digest("hex");

      queryString = `${paramsString}&signature=${signature}`;
    }

    // Make request to Binance
    const url = `${BINANCE_BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;
    
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded"
    };
    
    if (apiKey) {
      headers["X-MBX-APIKEY"] = apiKey;
    }

    console.log(`[BinanceRelay] ${method} ${endpoint} - Forwarding to Binance...`);

    const response = await axios({
      method: method as any,
      url,
      headers,
      timeout: 30000
    });

    console.log(`[BinanceRelay] ${method} ${endpoint} - Success (${response.status})`);

    // Return Binance response
    res.status(response.status).json({
      success: true,
      data: response.data,
      relayedFrom: "Railway non-US"
    });

  } catch (error) {
    const axiosError = error as AxiosError<{ code?: number; msg?: string }>;
    const statusCode = axiosError.response?.status || 500;
    const errorMsg = axiosError.response?.data?.msg || axiosError.message;
    const errorCode = axiosError.response?.data?.code;

    console.error(`[BinanceRelay] Error: [${errorCode}] ${errorMsg}`);

    res.status(statusCode).json({
      success: false,
      error: errorMsg,
      errorCode: errorCode,
      relayedFrom: "Railway non-US"
    });
  }
});

/**
 * GET /api/binance-relay/health
 * Test the relay connectivity
 */
router.get("/binance-relay/health", async (_req: express.Request, res: express.Response) => {
  try {
    // Test connection to Binance
    const response = await axios.get(`${BINANCE_BASE_URL}/api/v3/time`, {
      timeout: 5000
    });

    res.status(200).json({
      success: true,
      message: "Binance relay is operational",
      binanceConnected: true,
      serverTime: response.data.serverTime,
      relayLocation: "Railway non-US",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: "Binance relay cannot connect to Binance",
      binanceConnected: false,
      error: error.message,
      relayLocation: "Railway non-US",
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/binance-relay/ip
 * Show the relay's public IP (Railway's IP)
 */
router.get("/binance-relay/ip", async (_req: express.Request, res: express.Response) => {
  try {
    const ipResponse = await axios.get("https://api.ipify.org?format=json", {
      timeout: 5000
    });

    res.status(200).json({
      success: true,
      relayIP: ipResponse.data.ip,
      relayLocation: "Railway non-US",
      message: "This is the IP that Binance sees"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
