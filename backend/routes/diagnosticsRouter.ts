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

/**
 * GET /diagnostics/binance-balances
 * List all non-zero balances in the Binance account
 */
router.get("/binance-balances", async (_req: express.Request, res: express.Response) => {
  try {
    const account: any = await binanceService.getAccountInfo();
    const nonZero = account.balances
      .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map((b: any) => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        total: (parseFloat(b.free) + parseFloat(b.locked)).toFixed(8),
      }));
    res.status(200).json({ success: true, balances: nonZero, count: nonZero.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /diagnostics/binance-sell
 * Execute a market sell order for testing. Body: { asset: "POL", amount: 10.5 }
 * Sells to USDT via spot market order.
 */
router.post("/binance-sell", async (req: express.Request, res: express.Response) => {
  try {
    const { asset, amount } = req.body;
    if (!asset || !amount) {
      return res.status(400).json({ success: false, error: "Provide 'asset' and 'amount' in request body" });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ success: false, error: "Amount must be a positive number" });
    }

    // Check balance first
    const balance = await binanceService.getAssetBalance(asset.toUpperCase());
    if (balance.free < numAmount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${asset} balance. Available: ${balance.free}, Requested: ${numAmount}`,
      });
    }

    // Execute spot market sell
    const result = await binanceService.convertViaSpotTrade(asset, "USDT", numAmount);

    res.status(200).json({
      success: true,
      order: {
        orderId: result.orderId,
        fromAsset: result.fromAsset,
        toAsset: result.toAsset,
        fromAmount: result.fromAmount,
        toAmount: result.toAmount,
        avgPrice: result.avgPrice,
        status: result.status,
      },
      message: `Sold ${result.fromAmount} ${result.fromAsset} → ${result.toAmount} USDT @ avg price ${result.avgPrice}`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /diagnostics/binance-orderbook
 * Get order book depth for a trading pair
 */
router.get("/binance-orderbook", async (req: express.Request, res: express.Response) => {
  try {
    const symbol = (req.query.symbol as string) || "BTCUSDT";
    const limit = parseInt(req.query.limit as string) || 5;
    const data = await binanceService.getOrderBookDepth(symbol, limit);
    res.status(200).json({ success: true, ...data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
