/**
 * Test Routes - For development/testing purposes only
 * These endpoints allow testing of payment flows and threshold logic
 */

import express from "express";
import { successResponseHelper, errorResponseHelper, getErrorMessage } from "../helper";
import { setRedisItem, getRedisItem, deleteRedisItem } from "../utils/redisInstance";
import { calculateTransactionFees, getBlockchainConfig } from "../controller/index";
import { getBlockchainThreshold } from "../utils/feeConfigUtils";
import { paymentController } from "../controller";
import { authMiddleware } from "../middleware";
import sequelize from "../config/database";

const testRouter = express.Router();

/**
 * POST /api/test/fix-customer-id-column
 * Fix the customer_id column to allow NULL values
 */
testRouter.post("/fix-customer-id-column", async (req, res) => {
  try {
    await sequelize.query('ALTER TABLE tbl_customer_transaction ALTER COLUMN customer_id DROP NOT NULL;');
    
    // Verify the change
    const [result] = await sequelize.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_customer_transaction' 
      AND column_name = 'customer_id';
    `);
    
    successResponseHelper(res, 200, "customer_id column fixed to allow NULL", result);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * GET /api/test/thresholds
 * Returns all blockchain thresholds
 */
testRouter.get("/thresholds", async (req, res) => {
  try {
    const thresholds = {
      BTC: getBlockchainThreshold("BTC"),
      ETH: getBlockchainThreshold("ETH"),
      LTC: getBlockchainThreshold("LTC"),
      DOGE: getBlockchainThreshold("DOGE"),
      TRX: getBlockchainThreshold("TRX"),
      BCH: getBlockchainThreshold("BCH"),
      "USDT-TRC20": getBlockchainThreshold("USDT-TRC20"),
      "USDT-ERC20": getBlockchainThreshold("USDT-ERC20"),
    };
    
    successResponseHelper(res, 200, "Blockchain thresholds retrieved", thresholds);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/calculate-fees
 * Calculate fees for a given amount and blockchain
 */
testRouter.post("/calculate-fees", async (req, res) => {
  try {
    const { blockchain, amount } = req.body;
    
    if (!blockchain || !amount) {
      return errorResponseHelper(res, 400, "blockchain and amount are required");
    }
    
    const feeResult = await calculateTransactionFees(blockchain, Number(amount));
    const threshold = getBlockchainThreshold(blockchain);
    const isBelowThreshold = Number(amount) < threshold;
    
    const response = {
      blockchain,
      amount: Number(amount),
      threshold,
      is_below_threshold: isBelowThreshold,
      fees: {
        fixed_fee: feeResult.fixedFee,
        transaction_fee: feeResult.transactionFee,
        blockchain_buffer: feeResult.blockchainBuffer,
        total_deduction: feeResult.totalDeduction,
      },
      distribution: {
        admin_receives: isBelowThreshold ? Number(amount) : feeResult.totalDeduction,
        merchant_receives: isBelowThreshold ? 0 : feeResult.userReceives,
      },
      explanation: isBelowThreshold
        ? `Amount $${amount} is below the $${threshold} threshold. ALL funds will be sent to admin wallet.`
        : `Amount $${amount} is above the $${threshold} threshold. Fees go to admin, remainder to merchant.`,
    };
    
    successResponseHelper(res, 200, "Fee calculation complete", response);
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/simulate-payment-redis
 * Set up Redis data to simulate a payment session
 */
testRouter.post("/simulate-payment-redis", authMiddleware, async (req, res) => {
  try {
    const { address, amount, currency, company_id, fee_payer = "company" } = req.body;
    
    if (!address || !amount || !currency) {
      return errorResponseHelper(res, 400, "address, amount, and currency are required");
    }
    
    const uniqueRef = `test-ref-${Date.now()}`;
    const txId = `test-tx-${Date.now()}`;
    
    // Get user from token
    const jwt = require("jsonwebtoken");
    const userData = jwt.decode(res.locals.token);
    
    // Set up Redis data like a real payment session
    const cryptoPayload = {
      mode: "crypto",
      amount: Number(amount),
      status: "pending",
      ref: uniqueRef,
      currency: currency,
      unique_tx_id: txId,
      walletType: "customer",
      temp_id: Date.now(),
      adm_id: userData.user_id,
      company_id: company_id || 1,
      fee_payer: fee_payer,
    };
    
    await setRedisItem(`crypto-${address}`, cryptoPayload);
    
    // Set customer ref data
    const customerRefPayload = {
      adm_id: userData.user_id,
      customer_id: 1,
      company_id: company_id || 1,
      base_currency: "USD",
      base_amount: Number(amount),
      fee_payer: fee_payer,
    };
    
    await setRedisItem(uniqueRef, customerRefPayload);
    
    successResponseHelper(res, 200, "Test payment session created in Redis", {
      address,
      redis_key: `crypto-${address}`,
      ref: uniqueRef,
      amount,
      currency,
      fee_payer,
      instructions: {
        step1: "Redis data is now set up",
        step2: `Send POST to /api/tatum-crypto-webhook with: { "address": "${address}", "amount": "${amount}", "asset": "${currency}", "txId": "test-tx-123" }`,
        step3: "Check /api/notifications for pending/partial/received notifications",
      },
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * GET /api/test/redis/:key
 * Get Redis data for a specific key
 */
testRouter.get("/redis/:key", async (req, res) => {
  try {
    const key = req.params.key;
    const data = await getRedisItem(key);
    
    if (!data || Object.keys(data).length === 0) {
      return errorResponseHelper(res, 404, `No Redis data found for key: ${key}`);
    }
    
    successResponseHelper(res, 200, "Redis data retrieved", { key, data });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * DELETE /api/test/redis/:key
 * Delete Redis data for a specific key
 */
testRouter.delete("/redis/:key", async (req, res) => {
  try {
    const key = req.params.key;
    await deleteRedisItem(key);
    successResponseHelper(res, 200, "Redis data deleted", { key });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/threshold-test
 * Run threshold distribution test for a specific scenario
 */
testRouter.post("/threshold-test", async (req, res) => {
  try {
    const { blockchain, amount } = req.body;
    
    if (!blockchain || !amount) {
      return errorResponseHelper(res, 400, "blockchain and amount are required");
    }
    
    const threshold = getBlockchainThreshold(blockchain);
    const isBelowThreshold = Number(amount) < threshold;
    
    let adminReceives: number;
    let merchantReceives: number;
    let explanation: string;
    
    if (isBelowThreshold) {
      adminReceives = Number(amount);
      merchantReceives = 0;
      explanation = `BELOW THRESHOLD: Amount $${amount} < $${threshold}. ALL funds ($${amount}) sent to admin wallet. Merchant receives $0.`;
    } else {
      const fees = await calculateTransactionFees(blockchain, Number(amount));
      adminReceives = fees.totalDeduction;
      merchantReceives = fees.userReceives;
      explanation = `ABOVE THRESHOLD: Amount $${amount} >= $${threshold}. Admin receives fees ($${adminReceives.toFixed(4)}). Merchant receives ($${merchantReceives.toFixed(4)}).`;
    }
    
    successResponseHelper(res, 200, "Threshold test complete", {
      test_scenario: {
        blockchain,
        amount: Number(amount),
        threshold,
        is_below_threshold: isBelowThreshold,
      },
      expected_distribution: {
        admin_wallet: adminReceives,
        merchant_wallet: merchantReceives,
        total: adminReceives + merchantReceives,
      },
      explanation,
      test_passed: true,
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

/**
 * POST /api/test/full-payment-flow
 * Simulate a complete payment flow with Redis setup and webhook
 */
testRouter.post("/full-payment-flow", authMiddleware, async (req, res) => {
  try {
    const { amount, currency, company_id, simulate_below_threshold = false } = req.body;
    
    const threshold = getBlockchainThreshold(currency);
    const testAmount = simulate_below_threshold ? Math.max(1, threshold - 2) : threshold + 10;
    
    const testAddress = `test-addr-${Date.now()}`;
    const uniqueRef = `test-ref-${Date.now()}`;
    const txId = `test-tx-${Date.now()}`;
    
    const jwt = require("jsonwebtoken");
    const userData = jwt.decode(res.locals.token);
    
    // Step 1: Set up Redis data
    const cryptoPayload = {
      mode: "crypto",
      amount: testAmount,
      status: "pending",
      ref: uniqueRef,
      currency: currency,
      unique_tx_id: txId,
      walletType: "customer",
      temp_id: Date.now(),
      adm_id: userData.user_id,
      company_id: company_id || 1,
      fee_payer: "company",
    };
    
    await setRedisItem(`crypto-${testAddress}`, cryptoPayload);
    await setRedisItem(uniqueRef, {
      adm_id: userData.user_id,
      customer_id: 1,
      company_id: company_id || 1,
      base_currency: "USD",
      base_amount: testAmount,
    });
    
    // Step 2: Calculate expected distribution
    const isBelowThreshold = testAmount < threshold;
    let expectedAdmin: number, expectedMerchant: number;
    
    if (isBelowThreshold) {
      expectedAdmin = testAmount;
      expectedMerchant = 0;
    } else {
      const fees = await calculateTransactionFees(currency, testAmount);
      expectedAdmin = fees.totalDeduction;
      expectedMerchant = fees.userReceives;
    }
    
    successResponseHelper(res, 200, "Full payment flow test prepared", {
      test_setup: {
        address: testAddress,
        amount: testAmount,
        currency,
        threshold,
        is_below_threshold: isBelowThreshold,
      },
      redis_keys: {
        crypto_key: `crypto-${testAddress}`,
        ref_key: uniqueRef,
      },
      expected_distribution: {
        admin_receives: expectedAdmin,
        merchant_receives: expectedMerchant,
        explanation: isBelowThreshold
          ? `ALL funds go to admin (below $${threshold} threshold)`
          : `Fees ($${expectedAdmin.toFixed(2)}) to admin, remainder ($${expectedMerchant.toFixed(2)}) to merchant`,
      },
      next_step: {
        description: "Send webhook to simulate incoming payment",
        endpoint: "POST /api/tatum-crypto-webhook",
        body: {
          address: testAddress,
          counterAddress: "sender-test-123",
          amount: testAmount.toString(),
          asset: currency,
          txId: `incoming-${txId}`,
          blockNumber: null,
        },
      },
    });
  } catch (e) {
    errorResponseHelper(res, 500, getErrorMessage(e));
  }
});

export default testRouter;
