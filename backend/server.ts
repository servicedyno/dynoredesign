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
import usdtPoolService from "./services/usdtPoolService";
import {
  usdtPoolAddressModel,
  usdtPoolTransactionModel,
  usdtPoolSweepModel,
} from "./models";

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

// USDT Pool: Sweep accumulated admin fees every 30 minutes
cron.schedule("*/30 * * * *", function () {
  console.log("sweepUSDTPoolFees ==============> checked");
  usdtPoolService.sweepAllEligibleAddresses();
});

// USDT Pool: Release expired reservations every 5 minutes
cron.schedule("*/5 * * * *", function () {
  console.log("releaseExpiredReservations ==============> checked");
  usdtPoolService.releaseExpiredReservations();
});

// USDT Pool: Process expired partial payments every 5 minutes
cron.schedule("*/5 * * * *", function () {
  console.log("processExpiredPartialPayments ==============> checked");
  usdtPoolService.processExpiredPartialPayments();
});

// USDT Pool: Cleanup stuck addresses every 15 minutes (safety net)
cron.schedule("*/15 * * * *", function () {
  console.log("cleanupStalePoolAddresses ==============> checked");
  usdtPoolService.cleanupStaleAddresses();
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
    
    // Sync USDT Pool models
    await usdtPoolAddressModel.sync({ alter: true });
    await usdtPoolTransactionModel.sync({ alter: true });
    await usdtPoolSweepModel.sync({ alter: true });
    console.log("USDT Pool tables synced successfully.");
    
    // Initialize USDT pools if empty
    try {
      await usdtPoolService.initializePool("USDT-TRC20");
      await usdtPoolService.initializePool("USDT-ERC20");
    } catch (poolError) {
      console.warn("USDT Pool initialization skipped (may already exist or xpub not ready):", poolError.message);
    }
  } catch (error) {
    console.error("PostgreSQL Unable to connect to the database:", error);
  }
  app.listen(port, () =>
    console.log(`Server is listening on port ${port}!`)
  );
};

startServer();
