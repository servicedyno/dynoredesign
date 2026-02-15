/**
 * Diagnostics Controller - Binance Testing Endpoints
 * Add these endpoints to test Binance integration from Railway deployment
 */

import express from "express";
import * as binanceService from "../services/binanceService";
import { getTunnelStatus } from "../services/sshTunnelManager";
import { dynoPayEmailTemplate } from "../helper/sendEmail";
import { baseEmailTemplate, infoBox, dataRow, statusBadge, p, otpBlock } from "../utils/emailTemplate";

const router = express.Router();

/**
 * GET /diagnostics/tunnel-status
 * SSH SOCKS5 tunnel health and diagnostics
 */
router.get("/tunnel-status", (_req: express.Request, res: express.Response) => {
  const status = getTunnelStatus();
  const proxyState = binanceService.getProxyState();
  res.status(200).json({
    success: true,
    tunnel: status,
    binanceProxy: proxyState,
  });
});

/**
 * GET /diagnostics/email-preview
 * Preview all email template styles in a gallery
 */
router.get("/email-preview", async (req: express.Request, res: express.Response) => {
  const template = req.query.template as string || 'payment';
  
  const templates: Record<string, () => string> = {
    payment: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`Great news! Your company <strong>Acme Corp</strong> has received a payment.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Amount', `<strong>0.05 BTC</strong>`)}
          ${dataRow('Status', statusBadge('Received', 'success'))}
          ${dataRow('Date', `14 Feb 2026 at 10:30 AM`)}
          ${dataRow('Transaction ID', `<span style="font-size: 12px; font-family: monospace;">TX-00482</span>`, true)}
        </table>
      `, '#22c55e')}
      ${p(`The funds have been forwarded to your payout wallet. You can view the full transaction details in your dashboard.`)}`;
      return baseEmailTemplate("Payment Received", content, { showButton: true, buttonText: "View Transaction", buttonLink: "#" });
    },
    otp: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`Here's your one-time login code for Dynopay:`)}
      ${otpBlock('847291')}
      ${p(`This code expires in 10 minutes. If you didn't request this code, please secure your account immediately.`)}`;
      return baseEmailTemplate("Your Login Code", content);
    },
    security: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`We detected unusual activity on your Dynopay account.`)}
      ${infoBox(`
        <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: 600; color: #991b1b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Alert Details</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Type', 'New Login from Unknown Device')}
          ${dataRow('Date', '14 Feb 2026 at 3:45 PM')}
          ${dataRow('IP Address', '192.168.1.100', true)}
        </table>
      `, '#ef4444')}
      ${p(`<strong>Was this you?</strong><br />If you recognize this activity, you can ignore this message.`)}
      ${p(`<strong>Didn't perform this action?</strong><br />Please change your password immediately and contact support.`)}`;
      return baseEmailTemplate("Security Alert", content, { showButton: true, buttonText: "Secure My Account", buttonLink: "#" });
    },
    welcome: () => {
      const content = `${p(`Hey Richard,`)}
      ${p(`Welcome to Dynopay! We're excited to have you on board.`)}
      ${p(`Dynopay makes accepting crypto payments simple, secure, and fast.`)}
      ${infoBox(`
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0d1f5c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">Here's what you can do next:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 4px 0; font-size: 14px; color: #374151;">1. Complete your company profile</td></tr>
          <tr><td style="padding: 4px 0; font-size: 14px; color: #374151;">2. Add your payout wallet</td></tr>
          <tr><td style="padding: 4px 0; font-size: 14px; color: #374151;">3. Start accepting payments</td></tr>
        </table>
      `)}`;
      return baseEmailTemplate("Welcome to Dynopay", content, { showButton: true, buttonText: "Get Started", buttonLink: "#" });
    },
    admin: () => {
      const content = `${p(`Hey Admin,`)}
      ${p(`Platform fee received from <strong>Acme Corp</strong>.`)}
      ${infoBox(`
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${dataRow('Platform Fee', `<strong>$15.00 USDT</strong>`)}
          ${dataRow('Status', statusBadge('Processed', 'success'))}
          ${dataRow('Merchant Net', '$985.00 USDT')}
          ${dataRow('Total Processed', '$1,000.00 USDT')}
          ${dataRow('Company', 'Acme Corp')}
          ${dataRow('Transaction ID', `<span style="font-size: 12px; font-family: monospace;">TX-00482</span>`, true)}
        </table>
      `, '#22c55e')}
      ${p(`The fee has been credited to the admin USDT wallet.`)}`;
      return baseEmailTemplate("Platform Fee Received", content);
    },
  };

  const names = Object.keys(templates);
  const nav = names.map(n => `<a href="?template=${n}" style="display:inline-block;padding:8px 16px;margin:4px;background:${n === template ? '#0d1f5c' : '#e5e7eb'};color:${n === template ? '#fff' : '#374151'};border-radius:6px;text-decoration:none;font-size:13px;font-family:sans-serif;">${n}</a>`).join('');
  
  const html = (templates[template] || templates.payment)();
  res.setHeader("Content-Type", "text/html");
  res.send(`<div style="background:#f3f4f6;padding:16px;text-align:center;">${nav}</div>${html}`);
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

/**
 * GET /diagnostics/conversion-email-preview
 * Preview the auto-conversion payout email template with sample data
 * Query params: ?volatile=true for volatile market version, default is stable
 */
router.get("/conversion-email-preview", async (req: express.Request, res: express.Response) => {
  const isVolatile = req.query.volatile === "true";

  // Sample data for preview
  const sampleData = {
    sourceCurrency: "BTC",
    sourceAmount: "0.00150000",
    sourceAmountUsd: "101.82",
    targetCurrency: "USDT",
    payoutAmount: "100.45",
    conversionRate: "67880.40",
    priceAtConversion: 67880.40,
    currentPrice: isVolatile ? 66200.00 : 68100.50,
    priceMovementPct: isVolatile ? -2.47 : -0.12,
    marketState: isVolatile ? "VOLATILE" : "STABLE",
    feeTierUsed: isVolatile ? "fast" : "slow",
    transactionId: "TXN-2026-00847",
    conversionId: "142",
    withdrawalTxHash: "0x7a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
  };

  const priceAtConversion = sampleData.priceAtConversion;
  const currentPrice = sampleData.currentPrice;
  const priceMovementPct = sampleData.priceMovementPct;
  const marketState = sampleData.marketState;
  const feeTierUsed = sampleData.feeTierUsed;
  const priceDiffSinceConversion = ((currentPrice - priceAtConversion) / priceAtConversion) * 100;
  const priceDroppedSinceConversion = priceDiffSinceConversion < -0.1;
  const savedAmount = priceDroppedSinceConversion
    ? Math.abs(priceDiffSinceConversion / 100) * parseFloat(sampleData.payoutAmount)
    : 0;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const volatilityVisual = isVolatile ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 24px 0;">
      <tr>
        <td style="padding: 16px 20px; background: #fef2f2; border-radius: 8px; border-left: 4px solid #ef4444;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 13px; font-weight: 600; color: #991b1b; font-family: 'Inter', Arial, sans-serif; padding-bottom: 10px;">
                MARKET VOLATILITY AT TIME OF CONVERSION
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fecaca; border-radius: 4px; height: 10px;">
                  <tr>
                    <td style="width: ${Math.min(100, Math.abs(priceMovementPct) * 20)}%; background: linear-gradient(90deg, #ef4444, #dc2626); border-radius: 4px; height: 10px;">&nbsp;</td>
                    <td style="height: 10px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="font-size: 12px; color: #7f1d1d; font-family: 'Inter', Arial, sans-serif; padding-top: 6px;">
                BTC moved <strong>${Math.abs(priceMovementPct).toFixed(2)}%</strong> during conversion window &mdash; fast-tracked with priority fees
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : '';

  const savingsBlock = priceDroppedSinceConversion ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; border-left: 4px solid #22c55e; text-align: center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size: 13px; font-weight: 600; color: #166534; font-family: 'Inter', Arial, sans-serif; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                Auto-Conversion Protected You
              </td>
            </tr>
            <tr>
              <td style="font-size: 28px; font-weight: 700; color: #15803d; font-family: 'Inter', Arial, sans-serif; padding: 8px 0;">
                ~$${savedAmount.toFixed(2)} saved
              </td>
            </tr>
            <tr>
              <td style="font-size: 13px; color: #166534; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">
                BTC has dropped <strong>${Math.abs(priceDiffSinceConversion).toFixed(2)}%</strong> since your conversion<br/>
                <span style="color: #6b7280;">Converted at $${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &mdash; Now $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>` : '';

  const priceUpBlock = !priceDroppedSinceConversion && Math.abs(priceDiffSinceConversion) > 0.1 ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 16px 20px; background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6;">
          <p style="margin: 0; font-size: 13px; color: #4a4a4a; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">
            BTC is currently at <strong>$${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            (+${priceDiffSinceConversion.toFixed(2)}% since conversion).
            Your payout was locked in at <strong>$${priceAtConversion.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> for price certainty.
          </p>
        </td>
      </tr>
    </table>` : '';

  const htmlContent = `
    <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">
      Your crypto payment has been auto-converted and the payout has been sent to your wallet.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="padding: 0 4px 12px 0; width: 50%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px;">
            <tr><td style="padding: 16px; text-align: center;">
              <p style="font-size: 11px; font-weight: 600; color: #6b7280; margin: 0 0 4px 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Received</p>
              <p style="font-size: 22px; font-weight: 700; color: #1034a6; margin: 0; font-family: 'Inter', Arial, sans-serif;">${sampleData.sourceAmount} BTC</p>
              <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">~$${sampleData.sourceAmountUsd} USD</p>
            </td></tr>
          </table>
        </td>
        <td style="padding: 0 0 12px 4px; width: 50%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px;">
            <tr><td style="padding: 16px; text-align: center;">
              <p style="font-size: 11px; font-weight: 600; color: #6b7280; margin: 0 0 4px 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">Payout</p>
              <p style="font-size: 22px; font-weight: 700; color: #15803d; margin: 0; font-family: 'Inter', Arial, sans-serif;">${sampleData.payoutAmount} USDT</p>
              <p style="font-size: 12px; color: #166534; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif;">Sent to your wallet</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
    ${volatilityVisual}
    ${savingsBlock}
    ${priceUpBlock}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 0 0 24px 0;">
      <tr><td style="padding: 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Conversion Rate</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">1 BTC = 67,880.40 USDT</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Market State</td><td style="padding: 8px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;"><span style="background: ${isVolatile ? '#fef3c7' : '#dcfce7'}; color: ${isVolatile ? '#92400e' : '#166534'}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 500;">${marketState}</span></td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Date</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">${dateStr} at ${timeStr}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">Withdrawal TX</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 12px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all; border-bottom: 1px solid #f3f4f6;">0x7a3f8b...d8e9f0</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif;">Conversion ID</td><td style="padding: 8px 0; color: #1a1a2e; font-size: 13px; font-family: 'Inter', Arial, monospace; text-align: right; word-break: break-all;">#142</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">
      Auto-conversion ensures you receive stablecoins, protecting your revenue from crypto price swings. View your full transaction history in your Dynopay dashboard.
    </p>`;

  const html = dynoPayEmailTemplate("Alex", htmlContent, "Payout Complete");
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

/**
 * GET /diagnostics/weekly-conversion-email-preview
 * Preview the weekly conversion summary email with sample data
 */
router.get("/weekly-conversion-email-preview", async (_req: express.Request, res: express.Response) => {
  const sampleData = {
    periodStart: "2026-02-05",
    periodEnd: "2026-02-12",
    totalConversions: 12,
    totalSourceUsd: 4250.00,
    totalPayoutUsd: 4182.35,
    totalSavedUsd: 47.82,
    totalVolatileConversions: 5,
    avgPriceMovementPct: -1.28,
    cryptoBreakdown: [
      { currency: "BTC", count: 5, totalAmount: "0.06250000", totalPayoutUsd: 2845.20, avgMovementPct: -1.85 },
      { currency: "ETH", count: 4, totalAmount: "1.42000000", totalPayoutUsd: 985.60, avgMovementPct: -0.92 },
      { currency: "SOL", count: 2, totalAmount: "4.35000000", totalPayoutUsd: 285.55, avgMovementPct: -0.45 },
      { currency: "XRP", count: 1, totalAmount: "47.80000000", totalPayoutUsd: 66.00, avgMovementPct: 0.12 },
    ],
    dailyVolume: [
      { day: "2026-02-06", label: "Thu", payoutUsd: 420 },
      { day: "2026-02-07", label: "Fri", payoutUsd: 850 },
      { day: "2026-02-08", label: "Sat", payoutUsd: 0 },
      { day: "2026-02-09", label: "Sun", payoutUsd: 120 },
      { day: "2026-02-10", label: "Mon", payoutUsd: 1580 },
      { day: "2026-02-11", label: "Tue", payoutUsd: 910 },
      { day: "2026-02-12", label: "Wed", payoutUsd: 302 },
    ],
  };

  const maxDailyVolume = Math.max(...sampleData.dailyVolume.map(d => d.payoutUsd), 1);

  const chartRows = sampleData.dailyVolume.map(d => {
    const barWidth = Math.max(2, Math.round((d.payoutUsd / maxDailyVolume) * 100));
    const hasActivity = d.payoutUsd > 0;
    return `
      <tr>
        <td style="padding: 4px 8px 4px 0; font-size: 12px; color: #6b7280; font-family: 'Inter', Arial, sans-serif; white-space: nowrap; width: 40px;">${d.label}</td>
        <td style="padding: 4px 0; width: 100%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f3f4f6; border-radius: 3px; height: 18px;">
            <tr>
              <td style="width: ${barWidth}%; background: ${hasActivity ? 'linear-gradient(90deg, #1034a6, #3b82f6)' : 'transparent'}; border-radius: 3px; height: 18px;">&nbsp;</td>
              <td style="height: 18px;">&nbsp;</td>
            </tr>
          </table>
        </td>
        <td style="padding: 4px 0 4px 8px; font-size: 12px; color: ${hasActivity ? '#1a1a2e' : '#9ca3af'}; font-family: 'Inter', Arial, sans-serif; white-space: nowrap; text-align: right; width: 60px; font-weight: ${hasActivity ? '600' : '400'};">${hasActivity ? '$' + d.payoutUsd : '-'}</td>
      </tr>`;
  }).join('');

  const breakdownRows = sampleData.cryptoBreakdown.map(c => {
    const movementColor = c.avgMovementPct < -1 ? '#dc2626' : c.avgMovementPct < 0 ? '#f59e0b' : '#22c55e';
    const movementSign = c.avgMovementPct >= 0 ? '+' : '';
    return `
      <tr>
        <td style="padding: 10px 0; color: #1a1a2e; font-size: 14px; font-weight: 600; font-family: 'Inter', Arial, sans-serif; border-bottom: 1px solid #f3f4f6;">${c.currency}</td>
        <td style="padding: 10px 0; color: #6b7280; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: center; border-bottom: 1px solid #f3f4f6;">${c.count}</td>
        <td style="padding: 10px 0; color: #1a1a2e; font-size: 14px; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">$${c.totalPayoutUsd.toFixed(2)}</td>
        <td style="padding: 10px 0; font-family: 'Inter', Arial, sans-serif; text-align: right; border-bottom: 1px solid #f3f4f6;">
          <span style="color: ${movementColor}; font-size: 13px; font-weight: 500;">${movementSign}${c.avgMovementPct.toFixed(2)}%</span>
        </td>
      </tr>`;
  }).join('');

  const htmlContent = `
    <p style="font-size: 15px; color: #4a4a4a; line-height: 1.6; margin: 0 0 16px 0; font-family: 'Inter', Arial, sans-serif;">
      Here's your weekly auto-conversion report for <strong style="color: #1a1a2e;">Acme Payments Inc.</strong>.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="padding: 0 4px 8px 0; width: 33%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px;">
            <tr><td style="padding: 16px 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: 700; color: #1034a6; margin: 0; font-family: 'Inter', Arial, sans-serif;">12</p>
              <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase;">Conversions</p>
            </td></tr>
          </table>
        </td>
        <td style="padding: 0 4px 8px 4px; width: 34%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px;">
            <tr><td style="padding: 16px 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: 700; color: #15803d; margin: 0; font-family: 'Inter', Arial, sans-serif;">$4182</p>
              <p style="font-size: 11px; color: #166534; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase;">Total Payout</p>
            </td></tr>
          </table>
        </td>
        <td style="padding: 0 0 8px 4px; width: 33%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #fef2f2; border-radius: 8px;">
            <tr><td style="padding: 16px 8px; text-align: center;">
              <p style="font-size: 24px; font-weight: 700; color: #dc2626; margin: 0; font-family: 'Inter', Arial, sans-serif;">-1.3%</p>
              <p style="font-size: 11px; color: #6b7280; margin: 4px 0 0 0; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase;">Avg Movement</p>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px 0;">
      <tr>
        <td style="padding: 24px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 8px; text-align: center;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="font-size: 13px; font-weight: 600; color: #166534; font-family: 'Inter', Arial, sans-serif; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Total Protected This Week</td></tr>
            <tr><td style="font-size: 32px; font-weight: 700; color: #15803d; font-family: 'Inter', Arial, sans-serif; padding: 8px 0;">~$47.82</td></tr>
            <tr><td style="font-size: 13px; color: #166534; font-family: 'Inter', Arial, sans-serif; line-height: 1.5;">saved by converting before further price drops<br/><span style="color: #6b7280;">5 of 12 conversions occurred during volatile markets</span></td></tr>
          </table>
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; margin: 0 0 24px 0;">
      <tr><td style="padding: 20px;">
        <p style="font-size: 13px; font-weight: 600; color: #1a1a2e; font-family: 'Inter', Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Daily Conversion Volume</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          ${chartRows}
        </table>
      </td></tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f8f9ff; border-radius: 8px; border-left: 4px solid #1034a6; margin: 0 0 24px 0;">
      <tr><td style="padding: 20px;">
        <p style="font-size: 13px; font-weight: 600; color: #1a1a2e; font-family: 'Inter', Arial, sans-serif; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Breakdown by Crypto</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Asset</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-align: center; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Count</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Payout</td>
            <td style="padding: 6px 0; color: #9ca3af; font-size: 11px; font-family: 'Inter', Arial, sans-serif; text-align: right; text-transform: uppercase; border-bottom: 2px solid #e5e7eb;">Avg Move</td>
          </tr>
          ${breakdownRows}
        </table>
      </td></tr>
    </table>
    <p style="font-size: 13px; color: #9ca3af; line-height: 1.6; margin: 0; font-family: 'Inter', Arial, sans-serif;">
      Report period: Feb 5, 2026 to Feb 12, 2026. Auto-conversion protects your revenue from crypto price volatility by instantly converting to stablecoins.
    </p>`;

  const html = dynoPayEmailTemplate("Alex", htmlContent, "Weekly Conversion Report");
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

export default router;
