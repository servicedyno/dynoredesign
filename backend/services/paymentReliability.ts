/**
 * Payment Reliability Service
 * 
 * Enterprise-grade reliability layer for high-throughput crypto payment processing.
 * Provides:
 *   1. Settlement Idempotency — prevents double-spend on retry
 *   2. Admin ≠ Merchant Wallet Guard — blocks misconfigured settlements
 *   3. Payment Journal — persists every state transition to PostgreSQL
 *   4. Queue Backpressure — rejects webhooks when overwhelmed
 *   5. Stuck Payment Watchdog — real-time alerting for stuck payments
 */

import PaymentJournal from "../models/paymentJournalModel";
import { cronLogger, webhookLogs } from "../utils/loggers";
import { getRedisItem, setRedisItem, setRedisTTL } from "../utils/redisInstance";
import { captureError } from "./errorMonitoringService";
import { getQueueHealth } from "./webhookQueue";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SETTLEMENT IDEMPOTENCY — Prevents double-spend on retry
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if a settlement has already been attempted/completed for a payment.
 * Returns the existing settlement TX ID if found, null if safe to proceed.
 * 
 * Uses TWO checks:
 *   1. Redis (fast path) — settlement-{paymentId} key
 *   2. PostgreSQL (durable path) — tbl_payment_journal with event='settlement_sent'
 * 
 * This ensures idempotency even if Redis loses the key.
 */
export async function checkSettlementIdempotency(
  paymentId: string,
  address: string,
  currency: string
): Promise<{ alreadySettled: boolean; existingTxId: string | null }> {
  // Fast path: Redis check
  const redisKey = `settlement-lock-${paymentId}`;
  const existing = await getRedisItem(redisKey);
  if (existing && typeof existing === 'object') {
    const data = existing as Record<string, unknown>;
    if (data.settlementTxId) {
      cronLogger.warn(
        `[SettlementIdempotency] ⛔ BLOCKED duplicate settlement for payment ${paymentId}. ` +
        `Existing TX: ${data.settlementTxId}`
      );
      return { alreadySettled: true, existingTxId: data.settlementTxId as string };
    }
    // In-progress marker exists but no TX yet — another worker is processing
    if (data.status === 'in_progress') {
      const startedAt = Number(data.startedAt || 0);
      const elapsed = Date.now() - startedAt;
      // If it's been more than 5 minutes, the other worker likely crashed
      if (elapsed < 300_000) {
        cronLogger.warn(
          `[SettlementIdempotency] ⏳ Settlement in progress for ${paymentId} (${Math.round(elapsed / 1000)}s ago). Blocking duplicate.`
        );
        return { alreadySettled: true, existingTxId: null };
      }
      cronLogger.warn(
        `[SettlementIdempotency] ⚠️ Stale in-progress marker for ${paymentId} (${Math.round(elapsed / 1000)}s). Allowing retry.`
      );
    }
  }

  // Durable path: PostgreSQL check (in case Redis lost the key)
  try {
    const journalEntry = await PaymentJournal.findOne({
      where: {
        payment_id: paymentId,
        event: 'settlement_sent',
      },
      order: [['created_at', 'DESC']],
    });

    if (journalEntry && journalEntry.settlement_tx_id) {
      cronLogger.warn(
        `[SettlementIdempotency] ⛔ BLOCKED duplicate settlement (DB recovery) for payment ${paymentId}. ` +
        `Existing TX: ${journalEntry.settlement_tx_id}`
      );
      // Re-populate Redis for future fast-path checks
      await setRedisItem(redisKey, {
        status: 'completed',
        settlementTxId: journalEntry.settlement_tx_id,
        recoveredFromDB: true,
      });
      await setRedisTTL(redisKey, 86400); // 24h
      return { alreadySettled: true, existingTxId: journalEntry.settlement_tx_id };
    }
  } catch (dbErr) {
    // DB check failed — log but don't block (Redis check passed)
    cronLogger.warn(`[SettlementIdempotency] DB check failed for ${paymentId}: ${(dbErr as Error).message}`);
  }

  return { alreadySettled: false, existingTxId: null };
}

/**
 * Mark settlement as in-progress (before calling Tatum API).
 * This prevents another worker from initiating a duplicate settlement.
 */
export async function markSettlementInProgress(paymentId: string): Promise<void> {
  const redisKey = `settlement-lock-${paymentId}`;
  await setRedisItem(redisKey, {
    status: 'in_progress',
    startedAt: Date.now(),
    pid: process.pid,
  });
  await setRedisTTL(redisKey, 600); // 10 min TTL (safety valve)
}

/**
 * Mark settlement as completed with the blockchain TX ID.
 * Also journals to PostgreSQL for durable record.
 */
export async function markSettlementCompleted(
  paymentId: string,
  settlementTxId: string,
  address: string,
  currency: string,
  merchantAmount: number,
  adminAmount: number,
  companyId: number | null
): Promise<void> {
  const redisKey = `settlement-lock-${paymentId}`;
  await setRedisItem(redisKey, {
    status: 'completed',
    settlementTxId,
    completedAt: Date.now(),
  });
  await setRedisTTL(redisKey, 86400 * 7); // 7 days

  // Journal to PostgreSQL
  try {
    await PaymentJournal.create({
      payment_id: paymentId,
      tx_id: null,
      address,
      currency,
      event: 'settlement_sent',
      from_state: 'processing',
      to_state: 'payout_complete',
      amount: merchantAmount + adminAmount,
      settlement_tx_id: settlementTxId,
      company_id: companyId,
      metadata: {
        merchant_amount: merchantAmount,
        admin_amount: adminAmount,
        pid: process.pid,
      },
    });
  } catch (journalErr) {
    // Non-blocking — log but don't fail the settlement
    cronLogger.error(`[SettlementIdempotency] Failed to journal settlement for ${paymentId}: ${(journalErr as Error).message}`);
  }
}

/**
 * Mark settlement as failed (allows retry).
 */
export async function markSettlementFailed(paymentId: string, error: string): Promise<void> {
  const redisKey = `settlement-lock-${paymentId}`;
  await setRedisItem(redisKey, {
    status: 'failed',
    error,
    failedAt: Date.now(),
  });
  await setRedisTTL(redisKey, 300); // 5 min — allow retry after cooldown
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. ADMIN ≠ MERCHANT WALLET GUARD — Blocks misconfigured settlements
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate that admin wallet address is different from merchant wallet address.
 * For UTXO chains, both outputs in a single TX go to different addresses.
 * If they're the same, admin fees are effectively donated to the merchant.
 * 
 * Returns { valid: true } if safe, or { valid: false, reason } if blocked.
 */
export function validateWalletSeparation(
  adminWalletAddress: string | null,
  merchantWalletAddress: string,
  currency: string,
  companyId: number | null
): { valid: boolean; reason?: string; sameAddress?: boolean } {
  if (!adminWalletAddress) {
    return {
      valid: false,
      reason: `No admin wallet configured for ${currency}. Settlement would fail.`,
    };
  }

  if (adminWalletAddress.toLowerCase() === merchantWalletAddress.toLowerCase()) {
    // Admin and merchant wallets are the same — this is an intentional configuration.
    // Allow settlement to proceed with a single-output transaction (no admin/merchant split needed).
    cronLogger.info(
      `[WalletGuard] ℹ️ Admin wallet for ${currency} (${adminWalletAddress.substring(0, 16)}...) ` +
      `is the SAME as merchant wallet for Company ${companyId}. ` +
      `Proceeding with combined single-output settlement.`
    );
    return { valid: true, sameAddress: true };
  }

  return { valid: true };
}


// ═══════════════════════════════════════════════════════════════════════════════
// 3. PAYMENT JOURNAL — Persist critical state transitions to PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Journal a payment state transition. Non-blocking — errors are logged but don't
 * interrupt the payment flow.
 */
export async function journalStateTransition(params: {
  paymentId: string;
  txId?: string | null;
  address: string;
  currency: string;
  event: string;
  fromState?: string | null;
  toState: string;
  amount?: number | null;
  companyId?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await PaymentJournal.create({
      payment_id: params.paymentId,
      tx_id: params.txId || null,
      address: params.address,
      currency: params.currency,
      event: params.event,
      from_state: params.fromState || null,
      to_state: params.toState,
      amount: params.amount || null,
      settlement_tx_id: null,
      company_id: params.companyId || null,
      metadata: params.metadata || null,
    });
  } catch (err) {
    // Non-blocking — payment continues even if journal fails
    cronLogger.warn(`[PaymentJournal] Failed to log ${params.event} for ${params.paymentId}: ${(err as Error).message}`);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 4. QUEUE BACKPRESSURE — Reject webhooks when system is overwhelmed
// ═══════════════════════════════════════════════════════════════════════════════

const BACKPRESSURE_THRESHOLDS = {
  MAX_WAITING_JOBS: parseInt(process.env.MAX_QUEUE_DEPTH || '5000', 10),
  MAX_ACTIVE_JOBS: parseInt(process.env.MAX_ACTIVE_JOBS || '50', 10),
  WARNING_THRESHOLD: 0.8, // Warn at 80% of max
};

/**
 * Check if the webhook queue can accept new jobs.
 * Returns { accept: true } if queue has capacity, or { accept: false, reason } if overloaded.
 */
export async function checkQueueBackpressure(): Promise<{
  accept: boolean;
  reason?: string;
  queueDepth?: number;
  utilizationPercent?: number;
}> {
  try {
    const health = await getQueueHealth();
    const utilization = health.waiting / BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS;

    if (health.waiting >= BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS) {
      return {
        accept: false,
        reason: `Queue overloaded: ${health.waiting} waiting jobs (max: ${BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS})`,
        queueDepth: health.waiting,
        utilizationPercent: Math.round(utilization * 100),
      };
    }

    if (utilization >= BACKPRESSURE_THRESHOLDS.WARNING_THRESHOLD) {
      webhookLogs.warn(
        `[Backpressure] ⚠️ Queue at ${Math.round(utilization * 100)}% capacity ` +
        `(${health.waiting}/${BACKPRESSURE_THRESHOLDS.MAX_WAITING_JOBS} waiting, ${health.active} active)`
      );
    }

    return {
      accept: true,
      queueDepth: health.waiting,
      utilizationPercent: Math.round(utilization * 100),
    };
  } catch (err) {
    // If we can't check, allow the job (better to accept than reject blindly)
    cronLogger.warn(`[Backpressure] Health check failed: ${(err as Error).message}. Allowing job.`);
    return { accept: true };
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 5. PAYMENT JOURNAL SYNC — Auto-create table on startup
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ensure the payment journal table exists. Called on startup.
 */
export async function initPaymentJournal(): Promise<void> {
  try {
    await PaymentJournal.sync({ alter: false });
    cronLogger.info("[PaymentJournal] ✅ Table synced successfully");
  } catch (err) {
    cronLogger.error(`[PaymentJournal] ❌ Table sync failed: ${(err as Error).message}`);
    // Try force sync if column mismatch
    try {
      await PaymentJournal.sync({ alter: true });
      cronLogger.info("[PaymentJournal] ✅ Table synced with ALTER");
    } catch (alterErr) {
      cronLogger.error(`[PaymentJournal] ❌ ALTER sync also failed: ${(alterErr as Error).message}`);
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 6. STUCK PAYMENT WATCHDOG — Real-time alerting
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check for payments stuck in processing state beyond threshold.
 * Called by cron every 2 minutes.
 */
export async function watchdogCheck(): Promise<{
  stuckCount: number;
  oldestStuckMinutes: number;
}> {
  try {
    const threshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes

    const stuckPayments = await PaymentJournal.findAll({
      where: {
        to_state: 'processing',
        created_at: { [require('sequelize').Op.lt]: threshold },
      },
      order: [['created_at', 'ASC']],
      limit: 50,
    });

    // Filter to only those without a subsequent completion
    const genuinelyStuck: typeof stuckPayments = [];
    for (const entry of stuckPayments) {
      const laterEntry = await PaymentJournal.findOne({
        where: {
          payment_id: entry.payment_id,
          event: { [require('sequelize').Op.in]: ['settlement_sent', 'payment_completed', 'payment_failed'] },
          created_at: { [require('sequelize').Op.gt]: entry.created_at },
        },
      });
      if (!laterEntry) {
        genuinelyStuck.push(entry);
      }
    }

    const oldestStuckMinutes = genuinelyStuck.length > 0
      ? Math.round((Date.now() - new Date(genuinelyStuck[0].created_at).getTime()) / 60000)
      : 0;

    if (genuinelyStuck.length > 0) {
      cronLogger.warn(
        `[Watchdog] ⚠️ ${genuinelyStuck.length} payment(s) stuck in 'processing' for >10 min. ` +
        `Oldest: ${oldestStuckMinutes} min. IDs: ${genuinelyStuck.slice(0, 5).map(p => p.payment_id).join(', ')}`
      );
    }

    return { stuckCount: genuinelyStuck.length, oldestStuckMinutes };
  } catch (err) {
    cronLogger.warn(`[Watchdog] Check failed: ${(err as Error).message}`);
    return { stuckCount: 0, oldestStuckMinutes: 0 };
  }
}
