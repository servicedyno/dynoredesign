import express from "express";
import { apiLogger } from "./utils/loggers";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import router from "./routes";
import { setupSwagger } from "./swagger";
import sanitizeInputMiddleware from "./middleware/sanitizeInput";
import requestLoggerMiddleware from "./middleware/requestLogger";
import adminAuthMiddleware from "./middleware/adminAuthMiddleware";
import authMiddleware from "./middleware/authMiddleware";

// Load environment variables FIRST
dotenv.config();

// Validate environment variables on startup (SECURITY FIX)
import { validateEnvironment } from "./utils/envValidator";
validateEnvironment();

// Redis imports - only used ones
import { connectRedis, acquireLock, releaseLock, cleanupStaleLocks } from "./utils/redisInstance";
// Unused Redis imports removed: deleteRedisItem, getRedisItem, setRedisItem
import {
  adminFeeModel,
  adminFeeTransactionModel,
  adminTransferFeeModel,
  adminWalletModel,
  customerModel,
  feesModel,
  userTempAddressModel,
  companyModel,
} from "./models";
// Unused imports removed: currencyConvert, encrypt, sendEmail
import { getErrorMessage } from "./helper";
import { refreshBackgroundRateCache } from "./helper/currencyConvert";
import cron from "node-cron";
import { getTransactionFee, getBlockchainFee, paymentController } from "./controller";
import sequelize from "./utils/dbInstance";
import { setupWeeklySummaryCron, setupWalletReminderCron, setupHealthCheckCron, setupRefereeCodeReminderCron, setupPaymentLinkReminderCron } from "./utils/cronJobs";
import { getOptimizationDiagnostics } from "./services/tronEnergyService";
import { migrateWebhookUrls } from "./services/migrateWebhookUrls";
import { processStablecoinConversions, getConversionStats, sendWeeklyConversionSummaries } from "./services/conversionService";
import stablecoinConversionModel from "./models/stablecoinConversionModel";
import { processWebhookRetryQueue } from "./utils/webhookRetry";
import { startVolatilityMonitor, getAllMarketStates, runMonitorCycle } from "./services/volatilityMonitorService";
import { startBinanceWebSocket, getStatus as getWsStatus } from "./services/binanceWebSocketService";
import { detectBinanceAccess, forceProxyState, getProxyState } from "./services/binanceService";
import { startTunnelManager, getTunnelStatus } from "./services/sshTunnelManager";
import { getAllFeeRates, getFeeRates } from "./services/feeRateService";
import { captureError, startErrorMonitoring, stopErrorMonitoring, getMonitoringStats, flushErrorDigest, sendErrorDigest } from "./services/errorMonitoringService";

// ============================================
// RAILWAY LOGGING FIX: Disable output buffering
// This ensures logs appear immediately in Railway's deploy logs
// ============================================
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RAILWAY_ENVIRONMENT;
if (isProduction) {
  // Force unbuffered output for Railway
  if (process.stdout.isTTY === false) {
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string | Uint8Array, encoding?: BufferEncoding | ((err?: Error) => void), callback?: (err?: Error) => void) => {
      const result = originalWrite(chunk, encoding, callback);
      // Force flush after each write
      if (process.stdout.writable) {
        try {
          (process.stdout as unknown as { _handle?: { flush?: () => void } })._handle?.flush?.();
        } catch (e) {
          // Ignore flush errors
        }
      }
      return result;
    };
  }
}

// Custom logger that ensures Railway visibility
const log = (message: string, level: 'info' | 'error' | 'warn' = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  const output = `[${timestamp}] ${prefix} ${message}`;
  
  if (level === 'error') {
    apiLogger.error(output);
  } else {
    apiLogger.info(output);
  }
};

log('Dynopay Backend Starting...', 'info');
log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'info');
log(`Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'not detected'}`, 'info');
const app = express();
const port = process.env.PORT || 3300;

// Trust proxy — required behind K8s/Nginx so req.ip returns real client IP (critical for rate limiters)
app.set('trust proxy', 1);

// CORS Configuration — env-configurable, defaults to permissive for merchant API compatibility
const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : null; // null = allow all (backward compat for merchant API integrations)
app.use(cors({
  origin: allowedOrigins || '*',
  credentials: !!allowedOrigins, // Only allow credentials when origins are restricted
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Requested-With', 'Accept', 'Origin', 'X-Request-ID']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Body Parser Error Handler ──────────────────────────────────────────────
// Catches malformed JSON (SyntaxError from body-parser) and returns 400 instead of 500
// Still captures the error for monitoring so digest emails include it
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err && (err as any).type === 'entity.parse.failed') {
    // Track in error monitoring (low severity — these are bot/scanner noise)
    captureError(err, 'api', {
      severity: 'low',
      requestContext: `${req.method} ${req.originalUrl}`,
      extraContext: `IP: ${req.ip} | Malformed JSON body`,
    });
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body",
      statusCode: 400,
    });
  }
  next(err);
});
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://swagger-ui.netlify.app", "https://files.catbox.moe", "https://cdn-icons-png.flaticon.com"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for Swagger UI assets
}));
app.options("*", cors());

// Request-level logging middleware (response time, correlation ID, method/url/status)
app.use(requestLoggerMiddleware);

// XSS sanitization middleware — strips malicious HTML/JS from all inputs
app.use(sanitizeInputMiddleware);

// Static files — served via /api/static prefix so K8s ingress routes to backend (port 8001)
const uploadsPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
app.use("/api/static", express.static("public"));
app.use(express.static("public")); // Keep backward compat for internal access
app.use("/api/static/images", express.static(path.join(uploadsPath, "images")));
app.use("/images", express.static(path.join(uploadsPath, "images")));
app.use("/api/static/videos", express.static(path.join(uploadsPath, "videos")));
app.use("/videos", express.static(path.join(uploadsPath, "videos")));

// Setup Swagger API documentation
setupSwagger(app);

// API Versioning: Mount routes at both /api (backward compat) and /api/v1 (versioned)
// Existing merchants keep using /api/... — no code changes needed
// New integrations can use /api/v1/... for explicit versioning
app.use("/api", router);
app.use("/api/v1", router);

// Diagnostics routes (for testing)
import diagnosticsRouter from "./routes/diagnosticsRouter";
app.use("/diagnostics", diagnosticsRouter);
app.use("/api/diagnostics", diagnosticsRouter);

// Health check endpoint for Railway
app.get("/health", async (_req: express.Request, res: express.Response) => {
  const health: Record<string, unknown> = {
    status: "healthy",
    service: "Dynopay Backend",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
  
  let statusCode = 200;
  
  // Check PostgreSQL
  try {
    await sequelize.authenticate();
    health.database = "connected";
  } catch (error) {
    health.database = "disconnected";
    health.database_error = error.message;
    statusCode = 503;
  }
  
  // Check Redis
  try {
    const { getRedisItem } = require('./utils/redisInstance');
    await getRedisItem('health-check-test');
    health.redis = "connected";
  } catch (error) {
    health.redis = "disconnected";
    health.redis_error = error.message;
    statusCode = 503;
  }
  
  // Check Tatum API (non-blocking)
  try {
    const { TatumCircuitBreaker } = require('./utils/circuitBreaker');
    const breakerStats = TatumCircuitBreaker.getStats();
    health.tatum_api = {
      operational: TatumCircuitBreaker.isOperational(),
      circuit_state: breakerStats.state,
      failures: breakerStats.failures
    };
    if (!TatumCircuitBreaker.isOperational()) {
      health.status = "degraded";
    }
  } catch (error) {
    health.tatum_api = "unknown";
  }
  
  // Check Binance WebSocket
  try {
    const wsStatus = getWsStatus();
    const wsInfo: Record<string, unknown> = {
      connected: wsStatus.connected,
      geo_blocked: wsStatus.geoBlocked,
      cached_prices: wsStatus.cachedPrices,
      cached_klines: wsStatus.cachedKlines,
      last_message_age_ms: wsStatus.lastMessageAge,
      rest_fallback_failures: wsStatus.restFallbackFailures,
    };
    if (wsStatus.geoBlocked) {
      wsInfo.note = "Binance API geo-blocked from this server region. Deploy to a non-US server for full functionality.";
    }
    health.binance_websocket = wsInfo;
    if (!wsStatus.connected && wsStatus.lastMessageAge > 5 * 60 * 1000) {
      health.status = "degraded";
    }
  } catch {
    health.binance_websocket = "unknown";
  }

  // Overall status
  if (statusCode !== 200) {
    health.status = "unhealthy";
  }
  
  res.status(statusCode).json(health);
});

app.get("/", async (_req: express.Request, res: express.Response) => {
  const transaction_fee = await getTransactionFee();
  const blockchain_fee = await getBlockchainFee();

  res.json({
    message: "Dynopay Backend API",
    version: "1.0.0",
    status: "running",
    transaction_fee,
    blockchain_fee,
  });
});

// ─── Fee Optimization Diagnostics (Admin-protected) ──────────────────────────
app.get("/diagnostics/fee-optimization", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const testAddress = req.query.address as string | undefined;
    const diagnostics = await getOptimizationDiagnostics(testAddress);
    res.status(200).json({
      success: true,
      ...diagnostics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: getErrorMessage(error),
    });
  }
});

// ─── Webhook URL Migration (Admin-protected) ─────────────────────────────────
app.post("/diagnostics/migrate-webhook-urls", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    log("Admin triggered webhook URL migration", "info");
    const stats = await migrateWebhookUrls();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Stablecoin conversion stats and manual trigger
app.get("/diagnostics/conversion-stats", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const stats = await getConversionStats();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/trigger-conversion", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    log("Admin triggered manual stablecoin conversion cycle", "info");
    const result = await processStablecoinConversions();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Trigger manual sweep for a specific temp address
app.post("/diagnostics/trigger-sweep", authMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { temp_address_id } = req.body;
    if (!temp_address_id) {
      return res.status(400).json({ success: false, error: "temp_address_id is required" });
    }
    log(`Admin triggered manual sweep for temp_address_id=${temp_address_id}`, "info");
    const { sweepPoolAddress } = await import("./services/merchantPool/merchantPoolSweep");
    const result = await sweepPoolAddress(temp_address_id);
    res.status(200).json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Binance proxy state
app.get("/diagnostics/binance-proxy", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const proxyState = getProxyState();
    const wsStatus = getWsStatus();
    res.status(200).json({ success: true, proxy: proxyState, websocket: wsStatus });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Force Binance proxy on/off
app.post("/diagnostics/binance-proxy", adminAuthMiddleware, async (req: express.Request, res: express.Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ success: false, error: "enabled (boolean) is required" });
    }
    const result = forceProxyState(enabled);
    res.status(200).json({ success: true, message: `Proxy ${enabled ? "ENABLED" : "DISABLED"}`, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});


// Diagnostics: Volatility monitor states
app.get("/diagnostics/volatility", async (_req: express.Request, res: express.Response) => {
  try {
    const states = getAllMarketStates();
    const assets = Object.values(states);
    const declining = assets.filter((a) => a.roc30m < -1.5);
    res.status(200).json({
      success: true,
      monitoredAssets: assets.length,
      decliningAssets: declining.length,
      states,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Force volatility monitor cycle
app.post("/diagnostics/volatility-refresh", async (_req: express.Request, res: express.Response) => {
  try {
    const results = await runMonitorCycle();
    res.status(200).json({ success: true, refreshed: results.length, states: results });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// Diagnostics: Live blockchain fee rates
app.get("/diagnostics/fee-rates", async (req: express.Request, res: express.Response) => {
  try {
    const chain = req.query.chain as string;
    if (chain) {
      const rates = await getFeeRates(chain);
      res.status(200).json({ success: true, rates });
    } else {
      const allRates = getAllFeeRates();
      res.status(200).json({ success: true, rates: allRates });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// ─── Error Monitoring Diagnostics ────────────────────────────────────────────
app.get("/diagnostics/error-monitor", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const stats = getMonitoringStats();
    res.status(200).json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/error-monitor/flush", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    const result = await flushErrorDigest();
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

app.post("/diagnostics/error-monitor/test", adminAuthMiddleware, async (_req: express.Request, res: express.Response) => {
  try {
    captureError(new Error("Test error from diagnostics endpoint"), "system", {
      severity: "low",
      requestContext: "POST /diagnostics/error-monitor/test",
      extraContext: "This is a test error to verify the error monitoring pipeline",
    });
    res.status(200).json({ success: true, message: "Test error captured. It will appear in the next digest (or flush now via POST /diagnostics/error-monitor/flush)." });
  } catch (error) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// OPTIMIZED: Reduced from */30 to every 2h — legacy system, rarely has pending addresses
cron.schedule("0 */2 * * *", function () {
  log("Cron: USDT check running", "info");
  paymentController.checkingUSDT();
});

cron.schedule("*/15 * * * *", function () {
  log("Cron: sweepNativeAdminFees running", "info");
  paymentController.sweepNativeAdminFees();
});

cron.schedule("*/10 * * * *", async () => {
  const lockAcquired = await acquireLock("cron:processIncompletePayments", 540, 1, 100, true);
  if (!lockAcquired) { log("Cron: processIncompletePayments skipped (already running)", "info"); return; }
  try {
    log("Cron: processIncompletePayments running", "info");
    await paymentController.processIncompletePayments();
  } finally {
    await releaseLock("cron:processIncompletePayments");
  }
});

cron.schedule("*/15 * * * *", function () {
  log("Cron: checkFeeBalance running", "info");
  paymentController.checkFeeBalance();
});

cron.schedule("0 */24 * * *", function () {
  log("Cron: removeUnwantedSubscriptions running", "info");
  paymentController.removeUnwantedSubscriptions();
});

// ===========================================
// MERCHANT POOL: Per-merchant pool cron jobs
// ===========================================
import * as merchantPoolService from "./services/merchantPoolService";

// Merchant Pool: Sweep accumulated admin fees every 2 minutes
// Handles both threshold-based ($30 USD) and time-based (3 min for ETH/TRX) sweeps
// OPTIMIZED: Reduced from 1 min to 2 min — sweeps still trigger within time thresholds
cron.schedule("*/2 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:performScheduledSweeps", 180, 1, 100, true);
  if (!lockAcquired) { log("Cron: performScheduledSweeps skipped (already running)", "info"); return; }
  try {
    log("Cron: performMerchantPoolScheduledSweeps running", "info");
    await merchantPoolService.performScheduledSweeps();
  } catch (err) {
    log(`Cron: Sweep failed, will retry next cycle: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'performScheduledSweeps' });
  } finally {
    await releaseLock("cron:performScheduledSweeps");
  }
});

// Merchant Pool: Release expired reservations every 2 minutes
// Retry once on transient DB errors (Railway PG proxy can drop connections)
cron.schedule("*/2 * * * *", function () {
  log("Cron: releaseMerchantPoolExpiredReservations running", "info");
  merchantPoolService.releaseExpiredReservations().catch(async (err) => {
    const errMsg = err.message || '';
    // Retry once for transient connection errors
    if (errMsg.includes('Connection terminated') || errMsg.includes('ECONNRESET') || errMsg.includes('ETIMEDOUT')) {
      log(`Cron: Release expired hit transient DB error (${errMsg}), retrying in 5s...`, "error");
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        await merchantPoolService.releaseExpiredReservations();
        log("Cron: Release expired retry succeeded", "info");
      } catch (retryErr) {
        log(`Cron: Release expired retry also failed: ${(retryErr as Error).message}`, "error");
        captureError(retryErr as Error, 'cron', { extraContext: 'releaseExpiredReservations_retry' });
      }
    } else {
      log(`Cron: Release expired failed, will retry next cycle: ${errMsg}`, "error");
      captureError(err, 'cron', { extraContext: 'releaseExpiredReservations' });
    }
  });
});

// Merchant Pool: Cleanup stuck addresses every 15 minutes (safety net)
cron.schedule("*/15 * * * *", function () {
  log("Cron: cleanupStaleMerchantPoolAddresses running", "info");
  merchantPoolService.cleanupStaleAddresses();
});

// Merchant Pool: Subscription health monitor every 2 hours
// Ensures all pool addresses have valid Tatum webhook subscriptions
// OPTIMIZED: Reduced from 30 min to 2h — subscriptions rarely break on their own
cron.schedule("0 */2 * * *", function () {
  log("Cron: ensurePoolSubscriptions running", "info");
  merchantPoolService.ensurePoolSubscriptions().catch(err => {
    log(`Cron: Subscription health check failed: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'ensurePoolSubscriptions' });
  });
});

// Merchant Pool: Check for missed webhooks every 10 minutes
// This is a fallback mechanism when Tatum webhooks fail to deliver
// OPTIMIZED: Reduced from 5 min to 10 min — reduces Tatum API calls by ~50%
cron.schedule("*/10 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:checkMissedPayments", 240, 1, 100, true);
  if (!lockAcquired) { log("Cron: checkMissedPayments skipped (already running)", "info"); return; }
  try {
    log("Cron: checkMissedPayments running", "info");
    await merchantPoolService.checkMissedPayments();
  } catch (err) {
    log(`Cron: Missed payments check failed: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'checkMissedPayments' });
  } finally {
    await releaseLock("cron:checkMissedPayments");
  }
});

// Detect orphan payments on AVAILABLE addresses (hourly)
// Safety net: catches payments sent AFTER reservation expired and address was released
// Uses saved last_payment_context for proper merchant/admin fee split
// OPTIMIZED: Reduced from 10 min to hourly — was ~22,000 Tatum API calls/day scanning 154 addresses
cron.schedule("0 * * * *", async function () {
  // FIX: Increased lock TTL from 900s to 1800s (30 min) — scanning 158+ addresses can take 10+ min with API latency
  const lockAcquired = await acquireLock("cron:detectOrphanPayments", 1800, 1, 100, true);
  if (!lockAcquired) { log("Cron: detectOrphanPayments skipped (already running)", "info"); return; }
  try {
    log("Cron: detectOrphanPayments running", "info");
    await merchantPoolService.detectOrphanPayments();
  } catch (err) {
    log(`Cron: Orphan payment detection failed: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'detectOrphanPayments' });
  } finally {
    await releaseLock("cron:detectOrphanPayments");
  }
});

// Merchant Pool: Pre-warm pool addresses every 15 minutes
// Ensures each active merchant has AVAILABLE addresses ready for instant reservation
// Eliminates ~3-4s Tatum API call bottleneck during payment creation
// OPTIMIZED: Reduced from 3 min to 15 min — pool rarely needs new addresses
cron.schedule("*/15 * * * *", function () {
  log("Cron: prewarmPoolAddresses running", "info");
  merchantPoolService.prewarmPoolAddresses().catch(err => {
    log(`Cron: Pool pre-warming failed: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'prewarmPoolAddresses' });
  });
  // Also retry any RLUSD addresses with pending trust lines
  merchantPoolService.retryPendingTrustLines().catch(err => {
    log(`Cron: Trust line retry failed: ${err.message}`, "error");
    captureError(err, 'cron', { extraContext: 'retryPendingTrustLines' });
  });
});

// Background rate cache: Refresh crypto rates every 2 minutes via CoinGecko (free)
// FIX: Reduced from 60s to 120s to avoid CoinGecko rate-limiting (free tier: ~30 req/min)
// CoinGecko rates serve as fallback when FastForex/Tatum unavailable
cron.schedule("*/2 * * * *", function () {
  refreshBackgroundRateCache().catch(err => {
    log(`Cron: Background rate cache refresh failed: ${err.message}`, "error");
  });
});

// Setup weekly summary cron job (every Monday at 9:00 AM UTC)
setupWeeklySummaryCron();

// Weekly conversion summary email (every Monday at 9:30 AM UTC)
cron.schedule("30 9 * * 1", async function () {
  const lockAcquired = await acquireLock("cron:weeklyConversionSummary", 600, 1, 100, true);
  if (!lockAcquired) { log("Cron: weeklyConversionSummary skipped (already running)", "info"); return; }
  try {
    log("Cron: sendWeeklyConversionSummaries running", "info");
    const sent = await sendWeeklyConversionSummaries();
    log(`Cron: Weekly conversion summaries sent: ${sent}`, "info");
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Weekly conversion summary failed: ${errMsg}`, "error");
  } finally {
    await releaseLock("cron:weeklyConversionSummary");
  }
});
log("Weekly Conversion Summary Cron Job scheduled for every Monday at 9:30 AM UTC", "info");

// Setup wallet reminder cron job (every hour for users without wallets after 24h)
setupWalletReminderCron();

// Setup infrastructure health check cron job (every 5 minutes)
setupHealthCheckCron();

// Setup referee code reminder cron job (daily at 10 AM UTC)
setupRefereeCodeReminderCron();

// Setup payment link reminder cron job (every hour)
setupPaymentLinkReminderCron();

// Stablecoin Conversion: Process pending conversions via Binance
// Runs every N minutes (configurable via BINANCE_CONVERT_INTERVAL_MINUTES)
const convertIntervalMinutes = parseInt(process.env.BINANCE_CONVERT_INTERVAL_MINUTES || "5");
cron.schedule(`*/${convertIntervalMinutes} * * * *`, async function () {
  const lockAcquired = await acquireLock("cron:stablecoinConversion", 240, 1, 100, true);
  if (!lockAcquired) { log("Cron: stablecoinConversion skipped (already running)", "info"); return; }
  try {
    log("Cron: processStablecoinConversions running", "info");
    // Add timeout to prevent hanging indefinitely
    const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Stablecoin conversion timed out after 210s')), 210000));
    await Promise.race([processStablecoinConversions(), timeout]);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Stablecoin conversion failed: ${errMsg}`, "error");
  } finally {
    await releaseLock("cron:stablecoinConversion");
  }
});

// Webhook Retry Queue: Process failed webhooks with exponential backoff
// Runs every 2 minutes to retry webhooks that failed to deliver
cron.schedule("*/2 * * * *", async function () {
  try {
    log("Cron: processWebhookRetryQueue running", "info");
    const stats = await processWebhookRetryQueue();
    if (stats.processed > 0) {
      log(`Cron: Webhook retries - ${stats.succeeded} succeeded, ${stats.failed} failed`, "info");
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Cron: Webhook retry queue failed: ${errMsg}`, "error");
  }
});

const startServer = async () => {
  log('Connecting to Redis...', 'info');
  await connectRedis();
  log('Redis connected successfully', 'info');
  
  // Clean up stale locks from dead processes (prevents "stuck cron" after unclean restart)
  await cleanupStaleLocks();
  
  try {
    log('Connecting to PostgreSQL...', 'info');
    await sequelize.authenticate();
    log('PostgreSQL Connection has been established successfully.', 'info');
    
    // Sync Merchant Pool models (per-merchant system for ALL chains including USDT)
    // OPTIMIZED: Use alter:true only in development — production should use migrations
    const syncOptions = isProduction ? {} : { alter: true };
    
    // OPTIMIZED: Single consolidated import instead of 3 separate await import("./models") calls
    const {
      merchantWalletModel,
      merchantTempAddressModel,
      merchantPoolTransactionModel,
      merchantPoolSweepModel,
      referralModel,
      referralRewardModel,
      kbCategoryModel,
      kbArticleModel,
      refereeCodeModel,
      userModel,
    } = await import("./models");
    
    await merchantWalletModel.sync(syncOptions);
    await merchantTempAddressModel.sync(syncOptions);
    await merchantPoolTransactionModel.sync(syncOptions);
    await merchantPoolSweepModel.sync(syncOptions);
    log(`Merchant Pool tables synced successfully${isProduction ? ' (no-alter)' : ' (alter)' }.`, 'info');
    
    // Sync Referral models
    await referralModel.sync(syncOptions);
    await referralRewardModel.sync(syncOptions);
    log('Referral tables synced successfully.', 'info');
    
    // Sync Referee Code model
    await refereeCodeModel.sync(syncOptions);
    log('Referee Code table synced successfully.', 'info');
    
    // Sync Knowledge Base models
    await kbCategoryModel.sync(syncOptions);
    await kbArticleModel.sync(syncOptions);
    log('Knowledge Base tables synced successfully.', 'info');
    
    // Sync user model to add referral columns
    await userModel.sync(syncOptions);
    log('User model synced with referral columns.', 'info');
    
    // Sync stablecoin conversion model
    await stablecoinConversionModel.sync(syncOptions);
    log('Stablecoin conversion table synced.', 'info');
    
    // Sync company model (for auto-convert fields)
    await companyModel.sync(syncOptions);
    log('Company model synced with auto-convert fields.', 'info');
    
    // Validate Merchant Pool Configuration (CRITICAL STARTUP CHECK)
    // Can be disabled with SKIP_MERCHANT_POOL_VALIDATION=true for testing/development
    const skipValidation = process.env.SKIP_MERCHANT_POOL_VALIDATION === 'true';
    
    try {
      log('Validating Merchant Pool configuration...', 'info');
      const validateMerchantPoolConfiguration = (await import("./services/merchantPoolValidator")).default;
      await validateMerchantPoolConfiguration();
      log('Merchant Pool configuration validated successfully', 'info');
    } catch (validationError: unknown) {
      log('MERCHANT POOL CONFIGURATION VALIDATION FAILED', 'error');
      const errMsg = validationError instanceof Error ? validationError.message : String(validationError);
      
      if (skipValidation) {
        log(`⚠️  WARNING: Validation failed but SKIP_MERCHANT_POOL_VALIDATION=true`, 'warn');
        log(`⚠️  Configuration error: ${errMsg}`, 'warn');
        log('⚠️  Server starting anyway - Merchant Pool features may not work correctly', 'warn');
      } else {
        log(`Server cannot start with invalid configuration: ${errMsg}`, 'error');
        log('💡 Tip: Set SKIP_MERCHANT_POOL_VALIDATION=true to bypass this check for testing', 'info');
        process.exit(1); // Exit server - don't start with bad config
      }
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log(`PostgreSQL Unable to connect to the database: ${errMsg}`, 'error');
  }
  app.listen(port, () => {
    log(`🚀 Server is listening on port ${port}!`, 'info');
    log(`📚 Swagger docs available at /api/docs`, 'info');
    log(`❤️ Health check available at /health`, 'info');
    
    // Pre-populate background rate cache on startup (so first payment has fallback rates)
    refreshBackgroundRateCache().catch(err => {
      log(`Initial rate cache population failed: ${err.message}`, "error");
    });

    // Start SSH tunnel manager (auto-reconnect for Binance SOCKS5 proxy)
    // Must start BEFORE detectBinanceAccess so the tunnel is available for probe
    startTunnelManager();

    // Detect Binance access mode (direct vs proxy) BEFORE starting WebSocket
    // Non-US deployments get direct access (no proxy overhead)
    detectBinanceAccess().then(() => {
      // Start Binance WebSocket price stream (replaces REST polling for live prices)
      startBinanceWebSocket();
    }).catch(err => {
      log(`Binance access detection failed: ${err.message}, starting WebSocket anyway`, "error");
      startBinanceWebSocket();
    });

    // Start volatility monitor (now reads from WebSocket cache — zero REST calls)
    startVolatilityMonitor();

    // Start error monitoring (sends admin digest every 15 min when errors exist)
    startErrorMonitoring();

    // Migrate stale webhook URLs from previous deployments (runs once on startup)
    migrateWebhookUrls()
      .then(stats => {
        log(`Webhook URL migration complete: ${stats.updated} updated, ${stats.alreadyCorrect} already correct, ${stats.errors} errors (of ${stats.total} total)`, "info");
      })
      .catch(err => {
        log(`Webhook URL migration failed: ${err.message}`, "error");
      });
  });

  // ─── Global Error Handler (must be AFTER all routes) ─────────────────────────
  // Catches unhandled errors in route handlers and prevents stack trace leakage
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isProduction = process.env.NODE_ENV === 'production';
    log(`[GlobalErrorHandler] Unhandled error: ${err.message}${!isProduction ? `\n${err.stack}` : ''}`, 'error');
    captureError(err, 'api', {
      severity: 'high',
      requestContext: `${_req.method} ${_req.originalUrl}`,
      extraContext: `IP: ${_req.ip} | Body keys: ${Object.keys(_req.body || {}).join(', ') || 'none'}`,
    });
    res.status(500).json({
      success: false,
      message: isProduction ? 'Internal server error' : err.message,
      statusCode: 500,
    });
  });
};

startServer();

// ─── Shutdown State ──────────────────────────────────────────────────────────
// Exported flag so cron jobs and services can check before starting new work
export let isShuttingDown = false;

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
// ORDER: 1) Stop accepting work → 2) Wait for in-flight ops → 3) Close connections
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return; // Prevent double shutdown
  isShuttingDown = true;
  log(`Received ${signal}. Starting graceful shutdown...`, 'warn');

  // 1. Destroy all cron jobs so no new DB/Redis work is scheduled
  const cronTasks = cron.getTasks();
  cronTasks.forEach((task) => task.stop());
  log(`Stopped ${cronTasks.size} cron tasks.`, 'info');

  // 2. Flush error monitoring (uses Redis, not Sequelize)
  try {
    stopErrorMonitoring();
    await sendErrorDigest();
  } catch (err) {
    log(`Error flushing error digest: ${err}`, 'error');
  }

  // 3. Wait briefly for in-flight DB operations to finish
  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Close database connection pool LAST
  try {
    await sequelize.close();
    log('Database connection closed.', 'info');
  } catch (err) {
    log(`Error closing database: ${err}`, 'error');
  }

  log('Graceful shutdown complete. Exiting.', 'info');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
  // Suppress Sequelize "connection manager was closed" errors during shutdown
  const msg = reason instanceof Error ? reason.message : String(reason);
  if (isShuttingDown && msg.includes('connection manager was closed')) {
    log(`[Shutdown] Suppressed post-shutdown DB error: ${msg}`, 'warn');
    return;
  }
  log(`Unhandled Promise Rejection at: ${promise}, reason: ${reason}`, 'error');
  captureError(reason, 'unhandled-rejection', {
    severity: 'critical',
    extraContext: `Promise: ${String(promise)}`,
  });
  // Don't exit — log and continue
});

process.on('uncaughtException', (error: Error) => {
  // Suppress Sequelize "connection manager was closed" errors during shutdown
  if (isShuttingDown && error.message.includes('connection manager was closed')) {
    log(`[Shutdown] Suppressed post-shutdown DB error: ${error.message}`, 'warn');
    return;
  }
  log(`Uncaught Exception: ${error.message}\n${error.stack}`, 'error');
  captureError(error, 'uncaught', {
    severity: 'critical',
    extraContext: 'Process will exit after this error',
  });
  // Send digest immediately before exit (best-effort)
  sendErrorDigest().finally(() => {
    process.exit(1);
  });
});
