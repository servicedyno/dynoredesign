/**
 * Webhook Processor
 * 
 * Contains the core business logic extracted from tatumCryptoWebHook.
 * This is called by the BullMQ worker, NOT directly by the webhook endpoint.
 * 
 * Responsibilities:
 * - Duplicate detection (processed-tx Redis key)
 * - Atomic lock to prevent race conditions
 * - BCH CashAddr normalization
 * - Tag-based chain handling (XRP/RLUSD)
 * - Internal wallet filtering
 * - Underpayment / overpayment logic
 * - Crash recovery for stale "processing" payments
 * - cryptoVerification with retry
 * - Merchant webhook delivery
 */

import { getRedisItem, setRedisItem, setRedisTTL, acquireLock, releaseLock } from "../utils/redisInstance";
import { webhookLogs } from "../utils/loggers";
import { paymentController } from "../controller";
import { sendPendingPaymentNotification } from "./pendingPaymentService";
import { ADMIN_WALLETS, FEE_WALLETS, isTagBasedChain, getCryptoRedisKey, XRP_MASTER_ADDRESS } from "./merchantPool/merchantPoolConfig";
import tatumApi from "../apis/tatumApi";
import { callMerchantWebhook } from "../webhooks";
import { WebhookJobData } from "./webhookQueue";
import { validateTransition, parseState, PaymentState } from "./paymentStateMachine";

// ── Soft-enforcement helper ──────────────────────────────────────────────────
// Calls validateTransition() before every status change. Logs warnings for
// invalid transitions but NEVER throws — the payment flow always continues.
function softValidate(
  currentStatusRaw: string | undefined,
  newStatusRaw: string,
  paymentId: string,
  context: string,
): void {
  const currentState = parseState(currentStatusRaw);
  const nextState = parseState(newStatusRaw);

  if (!currentState || !nextState) {
    webhookLogs.warn(
      `[StateMachine] Unparseable status in ${context}: ` +
      `"${currentStatusRaw}" → "${newStatusRaw}" (payment ${paymentId})`
    );
    return;
  }

  validateTransition(currentState, nextState, paymentId, context);
}

// Build a set of all admin/fee wallet addresses for fast lookup (lowercase for case-insensitive match)
const INTERNAL_WALLETS = new Set(
  [...Object.values(ADMIN_WALLETS), ...Object.values(FEE_WALLETS)]
    .filter(Boolean)
    .map((addr) => addr.toLowerCase())
);

// Hard failures that should NOT be retried
const NON_RETRYABLE_ERRORS = [
  "invalid address", "invalid private key", "insufficient balance",
  "nonce too low", "already known", "bad request",
  "400", "401", "403", "404",
];

const isRetryable = (error: Error): boolean => {
  const message = error.message?.toLowerCase() || "";
  return !NON_RETRYABLE_ERRORS.some((pattern) => message.includes(pattern.toLowerCase()));
};

/**
 * Process a Tatum webhook job.
 * This is the full processing pipeline — called from the BullMQ worker.
 */
export async function processWebhookJob(data: WebhookJobData): Promise<void> {
  const payload = data.payload;
  const queryCompanyId = data.queryParams.company_id || null;
  const queryUserId = data.queryParams.user_id || null;
  const queryAddressId = data.queryParams.address_id || null;

  webhookLogs.info("[WebhookProcessor] Processing webhook:", {
    address: payload.address,
    amount: payload.amount,
    currency: (payload as Record<string, unknown>).currency || payload.asset,
    txId: payload.txId,
    source: data.source,
  });

  // ── 1. Duplicate detection ────────────────────────────────────────────────
  const processedTxKey = `processed-tx-${payload.txId}`;
  const alreadyProcessed = await getRedisItem(processedTxKey);
  if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
    webhookLogs.info("[WebhookProcessor] Transaction already processed, skipping:", payload.txId);
    return;
  }

  // ── 2. Atomic lock to prevent race conditions ─────────────────────────────
  const lockAcquired = await acquireLock(`tatum-webhook-${payload.txId}`, 300, 1, 50);
  if (!lockAcquired) {
    webhookLogs.info("[WebhookProcessor] Already being processed by another worker, skipping:", payload.txId);
    return;
  }
  webhookLogs.info("[WebhookProcessor] Acquired processing lock for tx:", payload.txId);

  try {
    // ── 3. Internal wallet filter ─────────────────────────────────────────────
    const counterAddr = (payload.counterAddress || "").toLowerCase();
    if (counterAddr && INTERNAL_WALLETS.has(counterAddr)) {
      webhookLogs.info(`[WebhookProcessor] Ignoring internal transfer to admin wallet: ${payload.counterAddress}`);
      await setRedisItem(processedTxKey, { processed: true, type: "internal_sweep", timestamp: new Date().toISOString() });
      await setRedisTTL(processedTxKey, 86400);
      return;
    }

    // ── 4. Address resolution (BCH + tag-based chains) ────────────────────────
    let address = payload.address;
    let items = await getRedisItem("crypto-" + address);

    // BCH CashAddr normalization
    if ((!items || Object.keys(items).length === 0) && address && !address.startsWith("bitcoincash:")) {
      const bchFullAddr = `bitcoincash:${address}`;
      const bchItems = await getRedisItem("crypto-" + bchFullAddr);
      if (bchItems && Object.keys(bchItems).length > 0) {
        webhookLogs.info(`[WebhookProcessor] BCH CashAddr resolved: ${address} → ${bchFullAddr}`);
        address = bchFullAddr;
        items = bchItems;
      }
    }

    // Tag-based chain handling (XRP, RLUSD)
    let resolvedDestinationTag: number | null = null;
    const isMasterAddress = address?.toLowerCase() === XRP_MASTER_ADDRESS?.toLowerCase();

    if (isMasterAddress || (!items || Object.keys(items).length === 0)) {
      if (isMasterAddress && payload.txId) {
        webhookLogs.info(`[WebhookProcessor] Master address detected, fetching destination tag from tx ${payload.txId}...`);
        resolvedDestinationTag = await tatumApi.getXrpDestinationTag(payload.txId);

        if (resolvedDestinationTag !== null) {
          const tagRedisKey = getCryptoRedisKey(address, resolvedDestinationTag);
          webhookLogs.info(`[WebhookProcessor] Destination tag: ${resolvedDestinationTag}, Redis key: ${tagRedisKey}`);
          items = await getRedisItem(tagRedisKey);
        } else {
          webhookLogs.error(`[WebhookProcessor] TAGLESS XRP PAYMENT — TX: ${payload.txId}, Amount: ${payload.amount}`);
        }
      }
    }

    // Fallback to counterAddress
    if (!items || Object.keys(items).length === 0) {
      webhookLogs.info("[WebhookProcessor] No Redis data for primary address, checking counterAddress");
      address = payload.counterAddress;
      items = await getRedisItem("crypto-" + address);

      // BCH normalization for counterAddress
      if ((!items || Object.keys(items).length === 0) && address && !address.startsWith("bitcoincash:")) {
        const bchFullAddr = `bitcoincash:${address}`;
        const bchItems = await getRedisItem("crypto-" + bchFullAddr);
        if (bchItems && Object.keys(bchItems).length > 0) {
          address = bchFullAddr;
          items = bchItems;
        }
      }

      // counterAddress as master address
      if ((!items || Object.keys(items).length === 0) && address?.toLowerCase() === XRP_MASTER_ADDRESS?.toLowerCase() && payload.txId) {
        if (resolvedDestinationTag === null) {
          resolvedDestinationTag = await tatumApi.getXrpDestinationTag(payload.txId);
        }
        if (resolvedDestinationTag !== null) {
          const tagRedisKey = getCryptoRedisKey(address, resolvedDestinationTag);
          items = await getRedisItem(tagRedisKey);
        }
      }
    }

    if (!items || Object.keys(items).length === 0) {
      webhookLogs.info("[WebhookProcessor] No Redis data found, ignoring webhook");
      return;
    }

    // Construct the Redis key that matched
    const redisKey = resolvedDestinationTag !== null
      ? getCryptoRedisKey(address, resolvedDestinationTag)
      : `crypto-${address}`;

    // Enrich items with company info from URL query params
    if (queryCompanyId && !items.company_id) items.company_id = queryCompanyId;
    if (queryUserId && !items.user_id) items.user_id = queryUserId;

    webhookLogs.info("[WebhookProcessor] Redis data found:", {
      currency: items.currency,
      expectedAmount: items.amount,
      payment_id: items.payment_id,
      company_id: items.company_id || queryCompanyId,
      hasTxId: !!items.txId,
    });

    // ── 5. Amount validation ──────────────────────────────────────────────────
    const incomingAmount = Number(payload.amount);
    if (!Number.isFinite(incomingAmount) || incomingAmount <= 0) {
      webhookLogs.info("[WebhookProcessor] Invalid amount, ignoring");
      return;
    }

    // ── 6. Status checks ──────────────────────────────────────────────────────
    const isFirstTransaction = !items.txId;
    const isCompletionPayment = String(items.incomplete) === "true" && items.txId !== payload.txId;
    const isAlreadySuccessful = items.status === "successful" || items.status === "completed" || items.status === "recovered";

    if (isAlreadySuccessful) {
      webhookLogs.info("[WebhookProcessor] Payment already successful, ignoring for tx:", payload.txId);
      return;
    }

    // ── 7. Crash recovery for stale "processing" payments ─────────────────────
    const isStaleProcessing = items.status === "processing"
      && !!items.txId
      && items.lastAttempt
      && (Date.now() - new Date(items.lastAttempt as string).getTime()) > 60000;

    if (isStaleProcessing && incomingAmount > 0) {
      webhookLogs.info("[WebhookProcessor] CRASH RECOVERY: Payment stuck in 'processing' state");
      await handleCrashRecovery(address, redisKey, items, payload, incomingAmount);
      return;
    }

    // ── 8. Main processing path ───────────────────────────────────────────────
    if ((isFirstTransaction || isCompletionPayment) && incomingAmount > 0) {
      await handleNewTransaction(
        address, redisKey, items, payload,
        incomingAmount, isCompletionPayment, isFirstTransaction,
        queryCompanyId
      );
    } else {
      webhookLogs.info("[WebhookProcessor] Duplicate transaction or txId already exists, ignoring");
    }

  } finally {
    // Always release the lock
    await releaseLock(`tatum-webhook-${payload.txId}`);
  }
}

// ── Crash Recovery Handler ────────────────────────────────────────────────────
async function handleCrashRecovery(
  address: string,
  redisKey: string,
  items: Record<string, any>,
  payload: WebhookJobData["payload"],
  incomingAmount: number
): Promise<void> {
  webhookLogs.info(`[WebhookProcessor] Recovery: payment_id=${items.payment_id}, stale since ${items.lastAttempt}`);

  try {
    const recoveryResult = await paymentController.cryptoVerification(address, true, redisKey);
    if (recoveryResult && recoveryResult.status && recoveryResult.status >= 400) {
      throw new Error(`Recovery cryptoVerification returned error ${recoveryResult.status}: ${recoveryResult.message || "Settlement failed"}`);
    }
    webhookLogs.info("[WebhookProcessor] Recovery: cryptoVerification completed successfully");

    await setRedisItem(redisKey, {
      ...items,
      status: "successful",
      txId: payload.txId,
      receivedAmount: items.receivedAmount || incomingAmount,
      completedAt: new Date().toISOString(),
      recoveredAt: new Date().toISOString(),
    });
    await setRedisTTL(redisKey, 1800);

    await setRedisItem(`processed-tx-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: items.receivedAmount || incomingAmount,
      processed_at: new Date().toISOString(), recovered: true,
    });
    await setRedisTTL(`processed-tx-${payload.txId}`, 172800);

  } catch (recoveryError: unknown) {
    const err = recoveryError as { message?: string };
    webhookLogs.error("[WebhookProcessor] Recovery cryptoVerification failed:", err.message);
    webhookLogs.info("[WebhookProcessor] Attempting direct webhook delivery as recovery fallback...");

    try {
      let customerData = items?.ref ? await getRedisItem(items.ref) : null;
      if (!customerData || Object.keys(customerData).length === 0) customerData = items;

      if (customerData && customerData !== items) {
        if (!customerData.webhook_url && items?.webhook_url) customerData.webhook_url = items.webhook_url;
        if (!customerData.callback_url && items?.callback_url) customerData.callback_url = items.callback_url;
        if (!customerData.webhook_secret && items?.webhook_secret) customerData.webhook_secret = items.webhook_secret;
        if (!customerData.company_id && items?.company_id) customerData.company_id = items.company_id;
        if (!customerData.link_id && items?.link_id) customerData.link_id = items.link_id;
      }

      if (customerData) {
        const linkId = customerData?.link_id || items?.link_id || null;
        const paymentType = linkId ? "payment_link" : "direct_api";

        await callMerchantWebhook(customerData, {
          event: "payment.confirmed",
          payment_type: paymentType,
          payment_id: items?.payment_id || items?.unique_tx_id,
          transaction_reference: items.txId,
          status: "processing",
          amount: parseFloat(items.receivedAmount as string) || incomingAmount,
          currency: items?.currency || payload.asset,
          base_amount: customerData?.base_amount || items?.base_amount_usd || null,
          base_currency: customerData?.base_currency || "USD",
          customer_name: customerData?.customer_name || null,
          customer_email: customerData?.email || null,
          description: customerData?.description || null,
          link_id: linkId,
          fee_payer: customerData?.fee_payer || items?.fee_payer || "company",
          recovered: true,
          completed_at: new Date().toISOString(),
        });
      }
    } catch (webhookErr) {
      webhookLogs.error("[WebhookProcessor] Recovery direct webhook error:", webhookErr);
    }

    await setRedisItem(redisKey, {
      ...items,
      status: "recovered",
      recoveredAt: new Date().toISOString(),
      recoveryNote: "Settlement completed on-chain, direct webhook sent as fallback",
    });
    await setRedisTTL(redisKey, 1800);

    await setRedisItem(`processed-tx-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: items.receivedAmount || incomingAmount,
      processed_at: new Date().toISOString(), recovered: true,
    });
    await setRedisTTL(`processed-tx-${payload.txId}`, 172800);
  }
}

// ── New Transaction Handler ───────────────────────────────────────────────────
async function handleNewTransaction(
  address: string,
  redisKey: string,
  items: Record<string, any>,
  payload: WebhookJobData["payload"],
  incomingAmount: number,
  isCompletionPayment: boolean,
  isFirstTransaction: boolean,
  queryCompanyId: number | null
): Promise<void> {
  if (isCompletionPayment) {
    webhookLogs.info(`[WebhookProcessor] COMPLETION payment: prev=${items.txId}, new=${payload.txId}`);
  } else {
    webhookLogs.info("[WebhookProcessor] First transaction detected, processing...");
  }

  // Get customer data
  let customerData = await getRedisItem(items?.ref);
  if (!customerData || Object.keys(customerData).length === 0) {
    try {
      const tempId = items?.temp_id;
      if (tempId) {
        const { Sequelize } = require("sequelize");
        const sequelize = require("../utils/dbInstance").default;
        const [tempAddr] = await sequelize.query(
          `SELECT owner_user_id, current_company_id FROM tbl_merchant_temp_address WHERE temp_address_id = :tempId`,
          { replacements: { tempId }, type: Sequelize.QueryTypes.SELECT }
        );
        if (tempAddr) {
          customerData = { adm_id: tempAddr.owner_user_id, company_id: tempAddr.current_company_id };
        }
      }
    } catch (dbErr) {
      webhookLogs.error("[WebhookProcessor] Error fetching customerData from DB:", dbErr);
    }
  }

  // Merge webhook info
  if (customerData) {
    if (!customerData.webhook_url && items?.webhook_url) customerData.webhook_url = items.webhook_url;
    if (!customerData.callback_url && items?.callback_url) customerData.callback_url = items.callback_url;
    if (!customerData.webhook_secret && items?.webhook_secret) customerData.webhook_secret = items.webhook_secret;
    if (!customerData.company_id && items?.company_id) customerData.company_id = items.company_id;
    if (!customerData.link_id && items?.link_id) customerData.link_id = items.link_id;
  }

  // Send pending notification
  if (customerData && customerData.adm_id) {
    try {
      await sendPendingPaymentNotification(address, payload.txId, incomingAmount, items?.currency || payload.asset, customerData);

      const linkIdPending = customerData?.link_id || null;
      const paymentTypePending = linkIdPending ? "payment_link" : "direct_api";
      await callMerchantWebhook(customerData, {
        event: "payment.pending",
        payment_type: paymentTypePending,
        address, txId: payload.txId,
        amount: incomingAmount,
        currency: items?.currency || payload.asset,
        payment_id: items?.payment_id || items?.unique_tx_id,
        status: "pending",
        base_amount: customerData?.base_amount || items?.base_amount_usd || null,
        base_currency: customerData?.base_currency || "USD",
        customer_name: customerData?.customer_name || null,
        customer_email: customerData?.email || null,
        description: customerData?.description || null,
        link_id: linkIdPending,
        fee_payer: customerData?.fee_payer || items?.fee_payer || "company",
        timestamp: new Date().toISOString(),
      });
    } catch (notifError) {
      webhookLogs.error("[WebhookProcessor] Error sending pending notification:", notifError);
    }
  }

  // ── Underpayment logic ──────────────────────────────────────────────────────
  let expectedAmount = parseFloat(items?.amount || "0");
  let totalReceivedAmount = incomingAmount;

  if (isCompletionPayment) {
    const previousAmount = parseFloat(items?.previousAmount || "0");
    totalReceivedAmount = previousAmount + incomingAmount;
    expectedAmount = parseFloat(items?.originalExpectedAmount || "0") || (expectedAmount + previousAmount);
  }

  const isUnderpayment = totalReceivedAmount < expectedAmount && expectedAmount > 0;

  // Fetch merchant underpayment threshold
  let underpaymentThresholdUsd = 1;
  let underpaymentAmountUsd = 0;
  let merchantGracePeriodMinutes = 30;

  if (isUnderpayment) {
    const shortfallCrypto = expectedAmount - totalReceivedAmount;
    const baseAmountUsd = parseFloat(items?.base_amount || customerData?.base_amount || "0");
    if (baseAmountUsd > 0 && expectedAmount > 0) {
      underpaymentAmountUsd = (shortfallCrypto / expectedAmount) * baseAmountUsd;
    }

    if (customerData?.company_id) {
      try {
        const { companyModel } = await import("../models");
        const company = await companyModel.findOne({ where: { company_id: customerData.company_id } });
        if (company?.dataValues?.underpayment_threshold_usd !== undefined && company?.dataValues?.underpayment_threshold_usd !== null) {
          underpaymentThresholdUsd = parseFloat(company.dataValues.underpayment_threshold_usd);
        }
        if (company?.dataValues?.grace_period_minutes !== undefined && company?.dataValues?.grace_period_minutes !== null) {
          merchantGracePeriodMinutes = Math.min(parseInt(String(company.dataValues.grace_period_minutes)), 30);
        }
      } catch (_e) { /* use defaults */ }
    }
  }

  const linkIdForThreshold = customerData?.link_id || items?.link_id || null;
  const isMinorUnderpayment = isUnderpayment && !!linkIdForThreshold && underpaymentAmountUsd <= underpaymentThresholdUsd;

  // Handle underpayment for payment links (wait for remaining)
  if (isUnderpayment && !isMinorUnderpayment) {
    const linkIdUnderpaid = customerData?.link_id || items?.link_id || null;
    const isDirectApi = !linkIdUnderpaid;

    if (isDirectApi) {
      // Direct API: process immediately with received amount
      await setRedisItem(redisKey, {
        ...items, status: "processing", txId: payload.txId,
        receivedAmount: totalReceivedAmount, originalExpectedAmount: expectedAmount,
        lastAttempt: new Date().toISOString(),
      });

      if (customerData && customerData.company_id) {
        await callMerchantWebhook(customerData, {
          event: "payment.underpaid", payment_type: "direct_api",
          address, txId: payload.txId,
          amount_received: totalReceivedAmount, amount_expected: expectedAmount,
          amount_remaining: expectedAmount - totalReceivedAmount,
          currency: items?.currency || payload.asset,
          payment_id: items?.payment_id || items?.unique_tx_id,
          status: "underpaid",
          note: "Direct API: processing with actual received amount",
          timestamp: new Date().toISOString(),
        });
      }
      // Fall through to cryptoVerification below
    } else {
      // Payment Link: wait for remaining payment
      const remainingAmount = expectedAmount - totalReceivedAmount;
      await setRedisItem(redisKey, {
        ...items, status: "underpaid", incomplete: "true",
        txId: payload.txId, receivedAmount: totalReceivedAmount,
        previousAmount: totalReceivedAmount, previousTxId: payload.txId,
        amount: remainingAmount, originalExpectedAmount: expectedAmount,
        partialPaymentTimestamp: items?.partialPaymentTimestamp || new Date().toISOString(),
        lastAttempt: new Date().toISOString(),
      });
      await setRedisTTL(redisKey, merchantGracePeriodMinutes * 60);

      if (customerData && customerData.company_id) {
        await callMerchantWebhook(customerData, {
          event: "payment.underpaid", payment_type: "payment_link",
          address, txId: payload.txId,
          amount_received: totalReceivedAmount, amount_expected: expectedAmount,
          amount_remaining: remainingAmount,
          currency: items?.currency || payload.asset,
          payment_id: items?.payment_id || items?.unique_tx_id,
          status: "underpaid",
          grace_period_minutes: merchantGracePeriodMinutes,
          timestamp: new Date().toISOString(),
        });
      }
      return; // Wait for remaining payment
    }
  }

  if (isMinorUnderpayment) {
    webhookLogs.info(`[WebhookProcessor] Minor underpayment ($${underpaymentAmountUsd.toFixed(2)}) within threshold - accepting`);
  }

  // ── CryptoVerification with retries ─────────────────────────────────────────
  const isDirectApiUnderpayment = isUnderpayment && !isMinorUnderpayment && !(customerData?.link_id || items?.link_id);
  const finalReceivedAmount = (isCompletionPayment || isDirectApiUnderpayment) ? totalReceivedAmount : incomingAmount;

  try {
    await setRedisItem(redisKey, {
      ...items, status: "processing",
      receivedAmount: finalReceivedAmount, txId: payload.txId,
      originalExpectedAmount: expectedAmount,
      incomplete: isCompletionPayment ? "false" : items.incomplete,
      retryCount: "0", lastAttempt: new Date().toISOString(),
    });

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const verifyResult = await paymentController.cryptoVerification(address, true, redisKey);
        if (verifyResult && verifyResult.status && verifyResult.status >= 400) {
          throw new Error(`cryptoVerification error ${verifyResult.status}: ${verifyResult.message || "Settlement failed"}`);
        }
        webhookLogs.info("[WebhookProcessor] cryptoVerification completed successfully");
        lastError = null;
        break;
      } catch (retryError: unknown) {
        const err = retryError as { message?: string };
        lastError = new Error(err.message || "Unknown error");

        if (!isRetryable(lastError)) {
          webhookLogs.error(`[WebhookProcessor] Non-retryable error: ${err.message}`);
          break;
        }

        if (attempt < maxRetries) {
          const waitTime = 2000 * Math.pow(2, attempt - 1);
          webhookLogs.warn(`[WebhookProcessor] Retry ${attempt}/${maxRetries}: ${err.message}, waiting ${waitTime}ms`);
          await setRedisItem(redisKey, {
            ...items, status: "retrying", receivedAmount: incomingAmount,
            txId: payload.txId, retryCount: String(attempt),
            lastAttempt: new Date().toISOString(), lastError: err.message,
          });
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    if (lastError) throw lastError;

    // Success: update Redis
    await setRedisItem(redisKey, {
      ...items, status: "successful", txId: payload.txId,
      receivedAmount: finalReceivedAmount, originalExpectedAmount: expectedAmount,
      incomplete: "false", completedAt: new Date().toISOString(),
    });
    await setRedisTTL(redisKey, 1800);

    if (items?.ref) {
      const custData = await getRedisItem(items.ref);
      if (custData && Object.keys(custData).length > 0) {
        await setRedisItem(items.ref, {
          ...custData, status: "successful", txId: payload.txId,
          receivedAmount: finalReceivedAmount, completedAt: new Date().toISOString(),
        });
        await setRedisTTL(items.ref, 1800);
      }
    }

    await setRedisItem(`processed-tx-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: finalReceivedAmount, processed_at: new Date().toISOString(),
    });
    await setRedisTTL(`processed-tx-${payload.txId}`, 172800);

  } catch (verifyError: unknown) {
    const err = verifyError as { message?: string };
    webhookLogs.error("[WebhookProcessor] cryptoVerification failed after retries:", verifyError);

    await setRedisItem(redisKey, {
      ...items, status: "failed", receivedAmount: incomingAmount,
      txId: payload.txId, failedAt: new Date().toISOString(),
      lastError: err.message,
    });

    await setRedisItem(`failed-payment-${payload.txId}`, {
      address, payment_id: items.payment_id || items.ref,
      amount: incomingAmount, txId: payload.txId,
      error: err.message, failed_at: new Date().toISOString(),
    });

    throw verifyError; // Let BullMQ retry the entire job
  }
}
