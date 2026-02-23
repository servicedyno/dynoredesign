/**
 * Startup Reconciliation Service
 * 
 * Runs on application startup to catch payments that were missed during downtime.
 * 
 * Three reconciliation strategies:
 * 1. Redis Scan: Find payments stuck in "processing" or "retrying" state in Redis
 * 2. Failed Payments: Re-queue failed payments from Redis (failed-payment-* keys)
 * 3. Tatum Failed Webhooks: Query Tatum API for webhook delivery failures and replay them
 */

import { webhookLogs } from "../utils/loggers";
import { redis as redisClient, getRedisItem, setRedisItemWithTTL } from "../utils/redisInstance";
import { enqueueWebhook, WebhookJobData } from "./webhookQueue";
import { captureError } from "./errorMonitoringService";
import { parseState, PaymentState } from "./paymentStateMachine";
import axios from "axios";

/**
 * Run all reconciliation strategies on startup.
 * Safe to call multiple times — uses Redis locks internally.
 */
export async function runStartupReconciliation(): Promise<{
  stuckPayments: number;
  failedPayments: number;
  failedStatePayments: number;
  tatumMissed: number;
  errors: string[];
}> {
  const stats = { stuckPayments: 0, failedPayments: 0, failedStatePayments: 0, tatumMissed: 0, errors: [] as string[] };

  webhookLogs.info("[Reconciliation] Starting startup reconciliation...");

  // ── Strategy 1: Redis stuck payments ────────────────────────────────────────
  try {
    stats.stuckPayments = await reconcileStuckPayments();
    webhookLogs.info(`[Reconciliation] Stuck payments re-queued: ${stats.stuckPayments}`);
  } catch (err) {
    const msg = `Stuck payment reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  // ── Strategy 2: Redis failed payments (failed-payment-* keys) ───────────────
  try {
    stats.failedPayments = await reconcileFailedPayments();
    webhookLogs.info(`[Reconciliation] Failed payments re-queued: ${stats.failedPayments}`);
  } catch (err) {
    const msg = `Failed payment reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  // ── Strategy 3: Tatum failed webhooks ───────────────────────────────────────
  try {
    stats.tatumMissed = await reconcileTatumFailedWebhooks();
    webhookLogs.info(`[Reconciliation] Tatum missed webhooks re-queued: ${stats.tatumMissed}`);
  } catch (err) {
    const msg = `Tatum reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  // ── Strategy 4: Direct crypto-* key scan for "failed" status ────────────────
  // Fallback for when failed-payment-* keys were consumed but the re-queued job
  // didn't actually fix the payment (e.g., duplicate check blocked recovery).
  // This scans the source-of-truth crypto-* keys directly.
  try {
    stats.failedStatePayments = await reconcileFailedStatePayments();
    webhookLogs.info(`[Reconciliation] Failed-state payments re-queued: ${stats.failedStatePayments}`);
  } catch (err) {
    const msg = `Failed-state reconciliation failed: ${(err as Error).message}`;
    stats.errors.push(msg);
    webhookLogs.error(`[Reconciliation] ${msg}`);
  }

  const total = stats.stuckPayments + stats.failedPayments + stats.failedStatePayments + stats.tatumMissed;
  webhookLogs.info(`[Reconciliation] Complete. Total re-queued: ${total}, Errors: ${stats.errors.length}`);

  if (total > 0) {
    captureError(
      new Error(`Reconciliation found ${total} items to process`),
      "system",
      {
        severity: total > 5 ? "high" : "low",
        extraContext: JSON.stringify(stats),
      }
    );
  }

  return stats;
}

/**
 * Strategy 1: Scan Redis for payments stuck in "processing" or "retrying" state.
 * These are payments where the server crashed mid-processing.
 */
async function reconcileStuckPayments(): Promise<number> {
  let count = 0;
  const staleThresholdMs = 60000; // 1 minute — if "processing" for >1min, it's stale

  // Scan Redis for crypto-* keys (these are payment state keys)
  let cursor = 0;
  do {
    const result = await redisClient.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;

    for (const key of result.keys) {
      try {
        const rawData = await redisClient.get(key);
        if (!rawData) continue;

        const data = JSON.parse(rawData);
        const parsedStatus = parseState(data.status);
        const isStuck = (parsedStatus === PaymentState.PROCESSING)
          && data.txId
          && data.lastAttempt
          && (Date.now() - new Date(data.lastAttempt).getTime()) > staleThresholdMs;

        if (isStuck) {
          webhookLogs.info(`[Reconciliation] Found stuck payment: ${key}, status=${data.status}, txId=${data.txId}`);

          await enqueueWebhook({
            payload: {
              address: key.replace("crypto-", "").replace(":json", ""),
              amount: data.receivedAmount || data.amount || "0",
              txId: data.txId,
              asset: data.currency,
            },
            queryParams: {
              company_id: data.company_id ? Number(data.company_id) : undefined,
            },
            receivedAt: new Date().toISOString(),
            source: "reconciliation",
          });
          count++;
        }
      } catch (parseErr) {
        // Skip malformed keys
      }
    }
  } while (cursor !== 0);

  return count;
}

/**
 * Strategy 2: Scan Redis for failed-payment-* keys.
 * These are payments that failed all in-line retries and were stored for later recovery.
 */
async function reconcileFailedPayments(): Promise<number> {
  let count = 0;
  const maxAgeMs = 24 * 60 * 60 * 1000; // Only reconcile failures from last 24h

  let cursor = 0;
  do {
    const result = await redisClient.scan(cursor, { MATCH: "failed-payment-*:json", COUNT: 100 });
    cursor = result.cursor;

    for (const key of result.keys) {
      try {
        const rawData = await redisClient.get(key);
        if (!rawData) continue;

        const data = JSON.parse(rawData);
        const failedAt = data.failed_at ? new Date(data.failed_at).getTime() : 0;

        if (failedAt > 0 && (Date.now() - failedAt) < maxAgeMs && data.txId) {
          // Skip known unrecoverable errors (balance=0, funds already moved)
          const lastError = data.error || "";
          if (/balance \[0\]|token balance \[0\]|Insufficient.*balance/i.test(lastError)) {
            webhookLogs.info(`[Reconciliation] Skipping permanently unrecoverable: ${key}`);
            await redisClient.del(key);
            await redisClient.del(key.replace(":json", ""));
            continue;
          }

          webhookLogs.info(`[Reconciliation] Found failed payment: ${key}, txId=${data.txId}`);

          await enqueueWebhook({
            payload: {
              address: data.address,
              amount: data.amount || "0",
              txId: data.txId,
              asset: data.currency,
            },
            queryParams: {
              company_id: data.company_id ? Number(data.company_id) : undefined,
            },
            receivedAt: new Date().toISOString(),
            source: "reconciliation",
          });

          // Remove from failed set to avoid re-reconciling
          await redisClient.del(key);
          await redisClient.del(key.replace(":json", ""));
          count++;
        }
      } catch (parseErr) {
        // Skip malformed keys
      }
    }
  } while (cursor !== 0);

  return count;
}

/**
 * Strategy 4: Direct scan of crypto-* Redis keys for "failed" status.
 * 
 * This is the ultimate fallback for payments that:
 * - Had their failed-payment-* key consumed by a previous reconciliation
 * - Were re-queued but the job hit the old duplicate check and did nothing
 * - Have no remaining failed-payment-* key, but the crypto-* source-of-truth still shows "failed"
 * 
 * Scans the actual payment state keys and re-queues any with status "failed" that have a txId.
 */
async function reconcileFailedStatePayments(): Promise<number> {
  let count = 0;
  let skippedPermanent = 0;
  let skippedRetryLimit = 0;
  let skippedRecent = 0;
  const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // Recover failures up to 7 days old
  const MIN_AGE_MS = 5 * 60 * 1000; // Skip failures < 5 min old (likely being processed already)
  const MAX_RETRY_COUNT = 3; // Don't re-queue if already retried this many times

  let cursor = 0;
  do {
    const result = await redisClient.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;

    for (const key of result.keys) {
      try {
        const rawData = await redisClient.get(key);
        if (!rawData) continue;

        const data = JSON.parse(rawData);
        const parsedStatus = parseState(data.status);

        // Only target payments in FAILED state that have a txId (were partially processed)
        // Skip permanently_failed payments (they've exhausted all recovery options)
        if (!data.txId) continue;
        if (parsedStatus !== PaymentState.FAILED) continue;
        if (data.status === "permanently_failed") { skippedPermanent++; continue; }

        // Skip if already retried too many times
        const retryCount = parseInt(data.retryCount || "0") || 0;
        if (retryCount >= MAX_RETRY_COUNT) {
          skippedRetryLimit++;
          continue;
        }

        // Skip known unrecoverable errors (balance=0, funds already moved)
        const lastError = data.lastError || "";
        if (/balance \[0\]|token balance \[0\]|Insufficient.*balance/i.test(lastError)) {
          skippedPermanent++;
          continue;
        }

        // Check age — failedAt or lastAttempt timestamp
        const failedAt = data.failedAt ? new Date(data.failedAt).getTime()
          : data.lastAttempt ? new Date(data.lastAttempt).getTime()
          : 0;
        if (failedAt > 0 && (Date.now() - failedAt) > maxAgeMs) continue;

        // Skip recently failed payments — they're likely still being retried by BullMQ or other strategies
        if (failedAt > 0 && (Date.now() - failedAt) < MIN_AGE_MS) {
          skippedRecent++;
          continue;
        }

        const address = key.replace("crypto-", "").replace(":json", "");
        webhookLogs.info(`[Reconciliation] Strategy 4: Found failed-state payment: ${address}, txId=${data.txId}, retryCount=${retryCount}, failedAt=${data.failedAt || "unknown"}, error=${(data.lastError || "unknown").slice(0, 100)}`);

        await enqueueWebhook({
          payload: {
            address,
            amount: data.receivedAmount || data.amount || "0",
            txId: data.txId,
            asset: data.currency,
          },
          queryParams: {
            company_id: data.company_id ? Number(data.company_id) : undefined,
          },
          receivedAt: new Date().toISOString(),
          source: "reconciliation",
        });
        count++;
      } catch (parseErr) {
        // Skip malformed keys
      }
    }
  } while (cursor !== 0);

  if (skippedPermanent > 0 || skippedRetryLimit > 0 || skippedRecent > 0) {
    webhookLogs.info(`[Reconciliation] Strategy 4: Skipped ${skippedPermanent} permanent, ${skippedRetryLimit} retry-limit, ${skippedRecent} recent`);
  }

  return count;
}



/**
 * Strategy 3: Query Tatum for failed webhook deliveries.
 * Tatum stores failed webhook attempts and exposes them via API.
 */
async function reconcileTatumFailedWebhooks(): Promise<number> {
  let count = 0;
  const MAX_AGE_DAYS = 7;
  const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - maxAgeMs;

  const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
  if (!tatumKey) {
    webhookLogs.info("[Reconciliation] No Tatum API key available, skipping Tatum reconciliation");
    return 0;
  }

  try {
    // Get failed webhooks from Tatum (most recent first so we can stop early)
    const headers = { "x-api-key": tatumKey };
    
    const { data: failedWebhooks } = await axios.get(
      "https://api.tatum.io/v4/subscription/webhook?pageSize=50&direction=desc",
      { headers, timeout: 15000 }
    );

    if (!failedWebhooks || !Array.isArray(failedWebhooks) || failedWebhooks.length === 0) {
      webhookLogs.info("[Reconciliation] No failed Tatum webhooks found");
      return 0;
    }

    // Filter to only recent webhooks (last 7 days)
    let skippedStale = 0;
    let skippedProcessed = 0;

    for (const webhook of failedWebhooks) {
      try {
        // Check webhook timestamp — skip anything older than MAX_AGE_DAYS
        const webhookTimestamp = webhook.timestamp || webhook.created || webhook.nextTime;
        if (webhookTimestamp) {
          const webhookTime = new Date(webhookTimestamp).getTime();
          if (!isNaN(webhookTime) && webhookTime < cutoffTime) {
            skippedStale++;
            continue; // Too old, skip
          }
        }

        const webhookData = typeof webhook.data === "string" ? JSON.parse(webhook.data) : webhook.data;
        if (!webhookData?.txId) continue;

        // Check if we already processed OR already reconciled this transaction
        const processedKey = `processed-tx-${webhookData.txId}`;
        const reconciledKey = `reconciled-tx-${webhookData.txId}`;
        const alreadyProcessed = await getRedisItem(processedKey);
        if (alreadyProcessed && Object.keys(alreadyProcessed).length > 0) {
          skippedProcessed++;
          continue;
        }
        const alreadyReconciled = await getRedisItem(reconciledKey);
        if (alreadyReconciled && Object.keys(alreadyReconciled).length > 0) {
          skippedProcessed++;
          continue;
        }

        // BUG-5 FIX: Also skip outgoing transactions (settlement/sweep TXs)
        const outgoingTxKey = `outgoing-tx-${webhookData.txId}`;
        const isOutgoing = await getRedisItem(outgoingTxKey);
        if (isOutgoing && Object.keys(isOutgoing).length > 0) {
          skippedProcessed++;
          continue;
        }

        webhookLogs.info(`[Reconciliation] Re-queuing Tatum failed webhook: txId=${webhookData.txId}`);

        await enqueueWebhook({
          payload: {
            address: webhookData.address || "",
            counterAddress: webhookData.counterAddress,
            amount: webhookData.amount || "0",
            txId: webhookData.txId,
            asset: webhookData.asset || webhookData.currency,
          },
          queryParams: {},
          receivedAt: new Date().toISOString(),
          source: "reconciliation",
        });

        // Mark as reconciled with 30-day TTL to prevent re-queuing on future restarts
        await setRedisItemWithTTL(reconciledKey, { reconciledAt: new Date().toISOString(), source: "tatum-failed-webhook" }, 30 * 24 * 60 * 60);
        count++;
      } catch (parseErr) {
        webhookLogs.error(`[Reconciliation] Failed to parse Tatum webhook:`, parseErr);
      }
    }

    webhookLogs.info(
      `[Reconciliation] Tatum webhooks: ${count} re-queued, ${skippedStale} skipped (older than ${MAX_AGE_DAYS}d), ${skippedProcessed} skipped (already processed)`
    );
  } catch (apiErr) {
    const msg = (apiErr as Error).message;
    // Non-critical: Tatum API might not support this endpoint on all plans
    if (msg.includes("403") || msg.includes("401")) {
      webhookLogs.info("[Reconciliation] Tatum failed webhooks API not available on current plan");
    } else {
      throw apiErr;
    }
  }

  return count;
}


/**
 * Clear stale Tatum failed webhooks by marking them all as "reconciled" in Redis.
 * This prevents them from being re-queued on every server restart.
 * Call this once to stop the recurring HIGH severity reconciliation alerts.
 */
export async function clearStaleTatumWebhooks(): Promise<{
  total: number;
  cleared: number;
  alreadyCleared: number;
  errors: string[];
}> {
  const stats = { total: 0, cleared: 0, alreadyCleared: 0, errors: [] as string[] };

  const tatumKey = process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY;
  if (!tatumKey) {
    stats.errors.push("No Tatum API key available");
    return stats;
  }

  try {
    const headers = { "x-api-key": tatumKey };
    const { data: failedWebhooks } = await axios.get(
      "https://api.tatum.io/v4/subscription/webhook?pageSize=50&direction=desc",
      { headers, timeout: 15000 }
    );

    if (!failedWebhooks || !Array.isArray(failedWebhooks) || failedWebhooks.length === 0) {
      webhookLogs.info("[ClearStale] No failed Tatum webhooks found");
      return stats;
    }

    stats.total = failedWebhooks.length;

    for (const webhook of failedWebhooks) {
      try {
        const webhookData = typeof webhook.data === "string" ? JSON.parse(webhook.data) : webhook.data;
        if (!webhookData?.txId) continue;

        const reconciledKey = `reconciled-tx-${webhookData.txId}`;
        const processedKey = `processed-tx-${webhookData.txId}`;

        // Check if already marked
        const alreadyReconciled = await getRedisItem(reconciledKey);
        const alreadyProcessed = await getRedisItem(processedKey);
        if ((alreadyReconciled && Object.keys(alreadyReconciled).length > 0) ||
            (alreadyProcessed && Object.keys(alreadyProcessed).length > 0)) {
          stats.alreadyCleared++;
          continue;
        }

        // Mark as reconciled with 30-day TTL
        await setRedisItemWithTTL(reconciledKey, {
          reconciledAt: new Date().toISOString(),
          source: "manual-clear-stale",
          txId: webhookData.txId,
          address: webhookData.address || "unknown",
        }, 30 * 24 * 60 * 60);

        webhookLogs.info(`[ClearStale] Marked as reconciled: txId=${webhookData.txId}`);
        stats.cleared++;
      } catch (parseErr) {
        stats.errors.push(`Failed to parse webhook: ${(parseErr as Error).message}`);
      }
    }

    webhookLogs.info(
      `[ClearStale] Complete: ${stats.cleared} cleared, ${stats.alreadyCleared} already cleared, ${stats.errors.length} errors out of ${stats.total} total`
    );
  } catch (apiErr) {
    stats.errors.push(`Tatum API error: ${(apiErr as Error).message}`);
  }

  return stats;
}
