import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import router from "./routes";
import tatumApi from "./apis/tatumApi";
import { setupSwagger } from "./swagger";
import { allowedOrigins } from "./utils/constants";

import {
  deleteRedisItem,
  getRedisItem,
  setRedisItem,
} from "./utils/redisInstance";
import {
  adminFeeModel,
  adminFeeTransactionModel,
  adminTransferFeeModel,
  adminWalletModel,
  customerModel,
  feesModel,
  userTempAddressModel,
} from "./models";
import jwt from "jsonwebtoken";
import { currencyConvert, encrypt, getErrorMessage, sendEmail } from "./helper";
import axios from "axios";
import { webhookLogs } from "./utils/loggers";
import blockchairApi from "./apis/blockchairApi";
import cron from "node-cron";
import { getTransactionFee, getBlockchainFee, paymentController } from "./controller";
import { connectRedis } from "./utils/redisInstance";
import sequelize from "./utils/dbInstance";
import { QueryTypes } from "sequelize";
import { setupWeeklySummaryCron, setupWalletReminderCron, setupHealthCheckCron } from "./utils/cronJobs";

dotenv.config();
const app = express();
const port = process.env.PORT || 3300;

// CORS Configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? allowedOrigins
    : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));
app.use(express.json());
app.use(helmet({
  contentSecurityPolicy: false, // Required for Swagger UI
}));
app.options("*", cors());

// Static files
const uploadsPath = process.env.UPLOAD_PATH || path.join(__dirname, '../uploads');
app.use(express.static("public"));
app.use("/images", express.static(path.join(uploadsPath, "images")));
app.use("/videos", express.static(path.join(uploadsPath, "videos")));

// Setup Swagger API documentation
setupSwagger(app);

app.use("/api", router);

// Health check endpoint for Railway
app.get("/health", async (req: express.Request, res: express.Response) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({ 
      status: "healthy",
      service: "DynoPay Backend",
      database: "connected",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({ 
      status: "unhealthy",
      service: "DynoPay Backend",
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get("/", async (req: express.Request, res: express.Response) => {
  const transaction_fee = await getTransactionFee();
  const blockchain_fee = await getBlockchainFee();

  res.json({
    message: "DynoPay Backend API",
    version: "1.0.0",
    status: "running",
    transaction_fee,
    blockchain_fee,
  });
});

cron.schedule("*/30 * * * *", function () {
  console.log("usdt-checked==============> checked");
  paymentController.checkingUSDT();
});

cron.schedule("*/15 * * * *", function () {
  console.log("sweepNativeAdminFees ==============> checked");
  paymentController.sweepNativeAdminFees();
});

cron.schedule("*/50 * * * *", function () {
  console.log("sending Leftover ==============> checked");
  paymentController.sendingLeftover();
});

cron.schedule("*/10 * * * *", () => {
  console.log("processIncompletePayments ==============> checked");
  paymentController.processIncompletePayments();
});

cron.schedule("*/15 * * * *", function () {
  console.log("checkFeeBalance ==============> checked");
  paymentController.checkFeeBalance();
});

cron.schedule("0 */24 * * *", function () {
  console.log("removeUnwantedSubscriptions ==============> checked");
  paymentController.removeUnwantedSubscriptions();
});

// ===========================================
// MERCHANT POOL: Per-merchant pool cron jobs
// ===========================================
import * as merchantPoolService from "./services/merchantPoolService";

// Merchant Pool: Sweep accumulated admin fees every 5 minutes
// Handles both threshold-based ($30 USD) and time-based (10 min) sweeps
cron.schedule("*/5 * * * *", function () {
  console.log("performMerchantPoolScheduledSweeps ==============> checked");
  merchantPoolService.performScheduledSweeps();
});

// Merchant Pool: Release expired reservations every 5 minutes
cron.schedule("*/5 * * * *", function () {
  console.log("releaseMerchantPoolExpiredReservations ==============> checked");
  merchantPoolService.releaseExpiredReservations();
});

// Merchant Pool: Cleanup stuck addresses every 15 minutes (safety net)
cron.schedule("*/15 * * * *", function () {
  console.log("cleanupStaleMerchantPoolAddresses ==============> checked");
  merchantPoolService.cleanupStaleAddresses();
});

// Merchant Pool: Recover stranded gas every hour
// Handles gas that was funded but token transfer failed
cron.schedule("0 * * * *", function () {
  console.log("recoverStrandedGas ==============> checked");
  merchantPoolService.recoverStrandedGas();
});

// Setup weekly summary cron job (every Monday at 9:00 AM UTC)
setupWeeklySummaryCron();

// Setup wallet reminder cron job (every hour for users without wallets after 24h)
setupWalletReminderCron();

// Setup infrastructure health check cron job (every 5 minutes)
setupHealthCheckCron();

const startServer = async () => {
  await connectRedis();
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL Connection has been established successfully.");
    
    // Sync Merchant Pool models (per-merchant system for ALL chains including USDT)
    const {
      merchantWalletModel,
      merchantTempAddressModel,
      merchantPoolTransactionModel,
      merchantPoolSweepModel,
    } = await import("./models");
    
    await merchantWalletModel.sync({ alter: true });
    await merchantTempAddressModel.sync({ alter: true });
    await merchantPoolTransactionModel.sync({ alter: true });
    await merchantPoolSweepModel.sync({ alter: true });
    console.log("Merchant Pool tables synced successfully.");
    
    // Validate Merchant Pool Configuration (CRITICAL STARTUP CHECK)
    try {
      const validateMerchantPoolConfiguration = (await import("./services/merchantPoolValidator")).default;
      await validateMerchantPoolConfiguration();
    } catch (validationError: any) {
      console.error("❌ MERCHANT POOL CONFIGURATION VALIDATION FAILED");
      console.error("❌ Server cannot start with invalid configuration");
      console.error("❌ Error:", validationError.message);
      process.exit(1); // Exit server - don't start with bad config
    }
  } catch (error) {
    console.error("PostgreSQL Unable to connect to the database:", error);
  }
  app.listen(port, () =>
    console.log(`Server is listening on port ${port}!`)
  );
};

startServer();
