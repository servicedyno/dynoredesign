/**
 * Diagnostics Controller - Binance Testing Endpoints
 * Add these endpoints to test Binance integration from Railway deployment
 */

import express from "express";
import * as binanceService from "../services/binanceService";
import { dynoPayEmailTemplate } from "../helper/sendEmail";

const router = express.Router();

/**
 * GET /diagnostics/email-preview
 * Preview the email template to verify logo rendering
 */
router.get("/email-preview", async (_req: express.Request, res: express.Response) => {
  const html = dynoPayEmailTemplate(
    "Test User",
    "<p>This is a test email to verify the logo renders correctly.</p><p>If you can see the DynoPay logo in the header and footer, the fix is working.</p>",
    "Email Logo Test"
  );
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

/**
 * GET /diagnostics/binance-ping
 * Test basic Binance connectivity (public endpoint, no auth)
 */
router.get("/binance-ping", async (_req: express.Request, res: express.Response) => {
  try {
    await binanceService.ping();
    res.status(200).json({
      success: true,
      message: "Binance API is reachable from Railway",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      message: "Cannot reach Binance API",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /diagnostics/binance-time
 * Get Binance server time (public endpoint)
 */
router.get("/binance-time", async (_req: express.Request, res: express.Response) => {
  try {
    const serverTime = await binanceService.getServerTime();
    res.status(200).json({
      success: true,
      serverTime: serverTime,
      serverDate: new Date(serverTime).toISOString(),
      message: "Binance API accessible from Railway"
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /diagnostics/binance-account
 * Test authenticated Binance endpoint (requires API key)
 */
router.get("/binance-account", async (_req: express.Request, res: express.Response) => {
  try {
    const accountInfo: any = await binanceService.getAccountInfo();
    res.status(200).json({
      success: true,
      accountType: accountInfo.accountType || 'SPOT',
      canTrade: accountInfo.canTrade || false,
      canWithdraw: accountInfo.canWithdraw || false,
      canDeposit: accountInfo.canDeposit || false,
      balanceCount: accountInfo.balances?.length || 0,
      message: "Binance authenticated API working"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Binance API authentication failed"
    });
  }
});

/**
 * GET /diagnostics/binance-quote
 * Test spot price quote (non-executing, safe for testing)
 */
router.get("/binance-quote", async (req: express.Request, res: express.Response) => {
  try {
    const fromAsset = req.query.from as string || "BTC";
    const toAsset = req.query.to as string || "USDT";
    const amount = parseFloat(req.query.amount as string || "0.001");

    // Use spot price quote instead of Convert API (Convert requires special Binance approval)
    const quote = await binanceService.getSpotQuote(fromAsset, toAsset, amount);
    
    res.status(200).json({
      success: true,
      quote: {
        symbol: quote.symbol,
        fromAsset: quote.fromAsset,
        toAsset: quote.toAsset,
        fromAmount: quote.fromAmount,
        estimatedToAmount: quote.estimatedToAmount,
        price: quote.price,
      },
      method: "spot_market_price",
      message: "Binance Spot quote retrieved successfully"
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Binance Spot quote failed"
    });
  }
});

/**
 * GET /diagnostics/binance-exchange-info
 * Get trading pair info (min quantity, step size)
 */
router.get("/binance-exchange-info", async (req: express.Request, res: express.Response) => {
  try {
    const symbol = req.query.symbol as string || "BTCUSDT";
    const info = await binanceService.getExchangeInfo(symbol);
    res.status(200).json({ success: true, ...info });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /diagnostics/binance-info
 * Get Binance connection info
 */
router.get("/binance-info", async (_req: express.Request, res: express.Response) => {
  const hasApiKey = !!process.env.BINANCE_API_KEY;
  const hasApiSecret = !!process.env.BINANCE_API_SECRET;
  
  res.status(200).json({
    success: true,
    binanceConfigured: hasApiKey && hasApiSecret,
    apiKeyPresent: hasApiKey,
    apiSecretPresent: hasApiSecret,
    baseUrl: process.env.BINANCE_BASE_URL || "https://api.binance.com",
    railwayEnvironment: !!process.env.RAILWAY_ENVIRONMENT,
    nodeEnv: process.env.NODE_ENV
  });
});

export default router;
