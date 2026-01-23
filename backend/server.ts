import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import router from "./routes";
import tatumApi from "./apis/tatumApi";

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

dotenv.config();
const app = express();
const port = process.env.PORT || 3300;

app.use(cors());
app.use(express.json());
app.use(helmet());
app.options("*", cors());

app.use(express.static("public"));
app.use("/images", express.static("/images"));
app.use("/videos", express.static("/videos"));
app.use("/api", router);

app.get("/", async (req: express.Request, res: express.Response) => {
  const transaction_fee = await getTransactionFee();
  const blockchain_fee = await getBlockchainFee();

  res.json({
    message: "Server Error!",
    transaction_fee,
    blockchain_fee,
  });
});

cron.schedule("*/30 * * * *", function () {
  console.log("usdt-checked==============> checked");
  paymentController.checkingUSDT();
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

const startServer = async () => {
  await connectRedis();
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL Connection has been established successfully.");
  } catch (error) {
    console.error("PostgreSQL Unable to connect to the database:", error);
  }
  app.listen(port, () =>
    console.log(`Server is listening on port ${port}!`)
  );
};

startServer();
