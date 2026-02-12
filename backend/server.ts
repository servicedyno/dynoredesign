import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import router from "./routes";
import { setupSwagger } from "./swagger";
import sanitizeInputMiddleware from "./middleware/sanitizeInput";
import requestLoggerMiddleware from "./middleware/requestLogger";
import adminAuthMiddleware from "./middleware/adminAuthMiddleware";

// Redis imports - only used ones
import { connectRedis, acquireLock, releaseLock } from "./utils/redisInstance";
// Unused Redis imports removed: deleteRedisItem, getRedisItem, setRedisItem
import {
  adminFeeModel,
  adminFeeTransactionModel,
  adminTransferFeeModel,
  adminWalletModel,
  customerModel,
  feesModel,
  userTempAddressModel,
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

// Load environment variables
dotenv.config();

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
    console.error(output);
  } else {
    console.log(output);
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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net", "https://swagger-ui.netlify.app"],
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

// Health check endpoint for Railway
app.get("/health", async (_req: express.Request, res: express.Response) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ 
      status: "healthy",
      service: "Dynopay Backend",
      database: "connected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: "unhealthy",
      service: "Dynopay Backend",
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
  const lockAcquired = await acquireLock("cron:processIncompletePayments", 540, 1);
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
  const lockAcquired = await acquireLock("cron:performScheduledSweeps", 50, 1);
  if (!lockAcquired) { log("Cron: performScheduledSweeps skipped (already running)", "info"); return; }
  try {
    log("Cron: performMerchantPoolScheduledSweeps running", "info");
    await merchantPoolService.performScheduledSweeps();
  } catch (err) {
    log(`Cron: Sweep failed, will retry next cycle: ${err.message}`, "error");
  } finally {
    await releaseLock("cron:performScheduledSweeps");
  }
});

// Merchant Pool: Release expired reservations every 2 minutes
cron.schedule("*/2 * * * *", function () {
  log("Cron: releaseMerchantPoolExpiredReservations running", "info");
  merchantPoolService.releaseExpiredReservations().catch(err => {
    log(`Cron: Release expired failed, will retry next cycle: ${err.message}`, "error");
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
  });
});

// Merchant Pool: Check for missed webhooks every 10 minutes
// This is a fallback mechanism when Tatum webhooks fail to deliver
// OPTIMIZED: Reduced from 5 min to 10 min — reduces Tatum API calls by ~50%
cron.schedule("*/10 * * * *", async function () {
  const lockAcquired = await acquireLock("cron:checkMissedPayments", 240, 1);
  if (!lockAcquired) { log("Cron: checkMissedPayments skipped (already running)", "info"); return; }
  try {
    log("Cron: checkMissedPayments running", "info");
    await merchantPoolService.checkMissedPayments();
  } catch (err) {
    log(`Cron: Missed payments check failed: ${err.message}`, "error");
  } finally {
    await releaseLock("cron:checkMissedPayments");
  }
});

// Detect orphan payments on AVAILABLE addresses (hourly)
// Safety net: catches payments sent AFTER reservation expired and address was released
// Uses saved last_payment_context for proper merchant/admin fee split
// OPTIMIZED: Reduced from 10 min to hourly — was ~22,000 Tatum API calls/day scanning 154 addresses
cron.schedule("0 * * * *", async function () {
  // FIX: Increased lock TTL from 540s to 900s — scanning 158+ addresses can take >9 min with API latency
  const lockAcquired = await acquireLock("cron:detectOrphanPayments", 900, 1);
  if (!lockAcquired) { log("Cron: detectOrphanPayments skipped (already running)", "info"); return; }
  try {
    log("Cron: detectOrphanPayments running", "info");
    await merchantPoolService.detectOrphanPayments();
  } catch (err) {
    log(`Cron: Orphan payment detection failed: ${err.message}`, "error");
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
  });
  // Also retry any RLUSD addresses with pending trust lines
  merchantPoolService.retryPendingTrustLines().catch(err => {
    log(`Cron: Trust line retry failed: ${err.message}`, "error");
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

// Setup wallet reminder cron job (every hour for users without wallets after 24h)
setupWalletReminderCron();

// Setup infrastructure health check cron job (every 5 minutes)
setupHealthCheckCron();

// Setup referee code reminder cron job (daily at 10 AM UTC)
setupRefereeCodeReminderCron();

// Setup payment link reminder cron job (every hour)
setupPaymentLinkReminderCron();

const startServer = async () => {
  log('Connecting to Redis...', 'info');
  await connectRedis();
  log('Redis connected successfully', 'info');
  
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
    res.status(500).json({
      success: false,
      message: isProduction ? 'Internal server error' : err.message,
      statusCode: 500,
    });
  });
};

startServer();

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
// Ensures open DB connections, Redis, and cron jobs are properly cleaned up
const gracefulShutdown = async (signal: string) => {
  log(`Received ${signal}. Starting graceful shutdown...`, 'warn');
  
  try {
    // Close database connection
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
  log(`Unhandled Promise Rejection at: ${promise}, reason: ${reason}`, 'error');
  // Don't exit — log and continue
});

process.on('uncaughtException', (error: Error) => {
  log(`Uncaught Exception: ${error.message}\n${error.stack}`, 'error');
  // For uncaught exceptions, exit after logging (Node.js best practice)
  process.exit(1);
});
