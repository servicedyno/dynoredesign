#!/usr/bin/env ts-node --transpile-only
/**
 * ═══════════════════════════════════════════════════════════════════════
 *  DynoPay — End-to-End Payment Pipeline Diagnostic Script
 * ═══════════════════════════════════════════════════════════════════════
 *
 *  Run:  cd /app/backend && npx ts-node --transpile-only scripts/e2e-payment-diagnostic.ts
 *
 *  Sections:
 *   1. Backend Health (server, DB, Redis, Tatum, Binance)
 *   2. Database Integrity (tables, foreign keys, orphans)
 *   3. Redis State (stuck payments, stale locks, keys)
 *   4. Webhook Pipeline (queue health, DLQ, worker)
 *   5. Payment State Audit (orphan states, stuck transitions)
 *   6. Merchant Pool Health (address availability, stuck IN_USE)
 *   7. On-Chain Balance Verification (unswept funds in temp wallets)
 *   8. Sweep Pipeline (failed sweeps, pending sweeps, feeLimit issues)
 *   9. Fee Wallet & Admin Wallet Health (gas balances)
 *  10. Tatum Subscription Verification
 *  11. Stablecoin Conversion Pipeline
 *  12. Reconciliation Dry Run
 * ═══════════════════════════════════════════════════════════════════════
 */

import dotenv from "dotenv";
dotenv.config();

import { Sequelize, QueryTypes } from "sequelize";
import { createClient, RedisClientType } from "redis";
import axios from "axios";

// ── Types & Globals ────────────────────────────────────────────────────────────

interface Issue {
  section: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  details?: string;
}

const issues: Issue[] = [];
const sectionResults: Record<string, { passed: number; failed: number; warnings: number }> = {};
let currentSection = "";
let seq: Sequelize;
let redis: RedisClientType;

const ADMIN_WALLETS: Record<string, string> = {
  BTC: process.env.BTC || "",
  ETH: process.env.ETH || "",
  LTC: process.env.LTC || "",
  DOGE: process.env.DOGE || "",
  BCH: process.env.BCH || "",
  SOL: process.env.SOL || "",
  XRP: process.env.XRP || "",
  TRX: process.env.TRX || "",
  "USDT-TRC20": process.env.USDT_TRC20 || "",
  "USDT-ERC20": process.env.ETH || "",
  "USDC-ERC20": process.env.USDC_ERC20 || "",
  RLUSD: process.env.RLUSD_ADMIN_WALLET || "",
  POLYGON: process.env.POLYGON || "",
  "USDT-POLYGON": process.env.POLYGON || "",
  "RLUSD-ERC20": process.env.RLUSD_ERC20 || "",
};

const FEE_WALLET_ENV: Record<string, string> = {
  TRX: process.env.TRX_FEE_WALLET || "",
  ETH: process.env.ETH_FEE_WALLET || "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function startSection(name: string) {
  currentSection = name;
  sectionResults[name] = { passed: 0, failed: 0, warnings: 0 };
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${name}`);
  console.log(`${"═".repeat(70)}`);
}

function pass(msg: string) {
  sectionResults[currentSection].passed++;
  console.log(`  ✅ ${msg}`);
}

function fail(msg: string, details?: string, severity: "CRITICAL" | "WARNING" = "CRITICAL") {
  if (severity === "CRITICAL") {
    sectionResults[currentSection].failed++;
  } else {
    sectionResults[currentSection].warnings++;
  }
  console.log(`  ${severity === "CRITICAL" ? "❌" : "⚠️ "} [${severity}] ${msg}`);
  if (details) console.log(`     └─ ${details}`);
  issues.push({ section: currentSection, severity, message: msg, details });
}

function info(msg: string) {
  console.log(`  ℹ️  ${msg}`);
}

function warn(msg: string, details?: string) {
  fail(msg, details, "WARNING");
}

async function query<T = any>(sql: string): Promise<T[]> {
  const [results] = await seq.query(sql);
  return results as T[];
}

// ── Section 1: Backend Health ──────────────────────────────────────────────────

async function checkBackendHealth() {
  startSection("1. Backend Health");

  // 1a. Database
  try {
    await seq.authenticate();
    const [dbTime]: any = await seq.query("SELECT NOW() as now, version() as version");
    pass(`PostgreSQL connected — ${dbTime[0].version?.split(" ")[0]} ${dbTime[0].version?.split(" ")[1]}`);
  } catch (e: any) {
    fail("PostgreSQL connection FAILED", e.message);
  }

  // 1b. Redis
  try {
    await redis.ping();
    const redisInfo = await redis.info("server");
    const version = redisInfo.match(/redis_version:(\S+)/)?.[1] || "unknown";
    pass(`Redis connected — v${version}`);
  } catch (e: any) {
    fail("Redis connection FAILED", e.message);
  }

  // 1c. Tatum API
  try {
    const tatumRes = await axios.get("https://api.tatum.io/v4/blockchain/estimate", {
      headers: { "x-api-key": process.env.TATUM_KEY || "" },
      timeout: 10000,
      validateStatus: () => true,
    });
    // Tatum returns 400 for GET on this endpoint but proves it's reachable
    if (tatumRes.status < 500) {
      pass(`Tatum API reachable (status: ${tatumRes.status})`);
    } else {
      fail("Tatum API returned server error", `Status: ${tatumRes.status}`);
    }
  } catch (e: any) {
    fail("Tatum API unreachable", e.message);
  }

  // 1d. Check Tatum credit balance
  try {
    const creditRes = await axios.get("https://api.tatum.io/v4/billing/usage", {
      headers: { "x-api-key": process.env.TATUM_KEY || "" },
      timeout: 10000,
      validateStatus: () => true,
    });
    if (creditRes.status === 200) {
      pass(`Tatum billing endpoint accessible`);
    } else {
      info(`Tatum billing check returned status: ${creditRes.status}`);
    }
  } catch (e: any) {
    warn("Could not check Tatum billing", e.message);
  }

  // 1e. Binance API (for price feeds)
  try {
    const binRes = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { timeout: 10000 });
    if (binRes.data?.price) {
      pass(`Binance API reachable (BTC price: $${parseFloat(binRes.data.price).toFixed(2)})`);
    }
  } catch (e: any) {
    warn("Binance API unreachable — price feeds may fail", e.message);
  }
}

// ── Section 2: Database Integrity ──────────────────────────────────────────────

async function checkDatabaseIntegrity() {
  startSection("2. Database Integrity");

  // 2a. Core tables exist
  const requiredTables = [
    "tbl_customer_transaction", "tbl_user", "tbl_user_wallet", "tbl_user_wallet_address",
    "tbl_user_temp_address", "tbl_admin_wallet", "tbl_admin_fee_wallet",
    "tbl_merchant_temp_address", "tbl_merchant_pool_transaction", "tbl_merchant_pool_sweep",
    "tbl_stablecoin_conversion", "tbl_payment_link", "tbl_invoice",
    "tbl_admin_fee_transaction", "tbl_admin_fee_transfer",
    "tbl_user_exchange", "tbl_fees", "tbl_company",
  ];

  const existingTables = await query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const tableNames = new Set(existingTables.map(t => t.tablename));

  let missingCount = 0;
  for (const table of requiredTables) {
    if (!tableNames.has(table)) {
      fail(`Missing table: ${table}`);
      missingCount++;
    }
  }
  if (missingCount === 0) {
    pass(`All ${requiredTables.length} core tables present`);
  }

  // 2b. Check for transactions with NULL status
  const nullStatus = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM tbl_customer_transaction WHERE status IS NULL`
  );
  if (parseInt(nullStatus[0].count) > 0) {
    fail(`${nullStatus[0].count} transactions with NULL status`, "These payments have no state — may be orphaned");
  } else {
    pass("No transactions with NULL status");
  }

  // 2c. Check for duplicate payment_id
  const dupePayments = await query<{ payment_id: string; cnt: string }>(
    `SELECT payment_id, COUNT(*) as cnt FROM tbl_customer_transaction 
     WHERE payment_id IS NOT NULL GROUP BY payment_id HAVING COUNT(*) > 1 LIMIT 5`
  );
  if (dupePayments.length > 0) {
    fail(`${dupePayments.length} duplicate payment_ids found`, 
      dupePayments.map(d => `${d.payment_id} (×${d.cnt})`).join(", "));
  } else {
    pass("No duplicate payment_ids");
  }

  // 2d. Check for orphaned merchant pool addresses (IN_USE but no matching pending payment)
  const orphanedAddresses = await query<{ temp_address_id: number; wallet_address: string; wallet_type: string; reserved_at: string }>(
    `SELECT mta.temp_address_id, mta.wallet_address, mta.wallet_type, mta.reserved_at
     FROM tbl_merchant_temp_address mta
     WHERE mta.status = 'IN_USE'
     AND mta.reserved_at < NOW() - INTERVAL '3 hours'
     ORDER BY mta.reserved_at ASC LIMIT 10`
  );
  if (orphanedAddresses.length > 0) {
    warn(`${orphanedAddresses.length} merchant pool addresses IN_USE for >3 hours`,
      orphanedAddresses.map(a => `#${a.temp_address_id} ${a.wallet_type} ${a.wallet_address.substring(0, 12)}… (since ${a.reserved_at})`).join("\n     "));
  } else {
    pass("No stale IN_USE merchant pool addresses (>3h)");
  }

  // 2e. Transaction count summary by status
  const statusCounts = await query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) as cnt FROM tbl_customer_transaction GROUP BY status ORDER BY cnt DESC`
  );
  info("Transaction status distribution:");
  for (const s of statusCounts) {
    console.log(`     ${s.status}: ${s.cnt}`);
  }

  // 2f. Check for transactions stuck in "processing" for >10 minutes in DB
  const stuckProcessing = await query<{ id: string; transaction_id: string; "updatedAt": string }>(
    `SELECT id, transaction_id, "updatedAt" FROM tbl_customer_transaction 
     WHERE status = 'processing' AND "updatedAt" < NOW() - INTERVAL '10 minutes' LIMIT 10`
  );
  if (stuckProcessing.length > 0) {
    fail(`${stuckProcessing.length} transactions stuck in "processing" for >10 min`,
      stuckProcessing.map(t => `${t.transaction_id} (updated: ${t.updatedAt})`).join(", "));
  } else {
    pass('No transactions stuck in "processing" state');
  }

  // 2g. Check for recent failed transactions (last 24h)
  const recentFailed = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_customer_transaction 
     WHERE status = 'failed' AND "updatedAt" > NOW() - INTERVAL '24 hours'`
  );
  const failedCount = parseInt(recentFailed[0].count || recentFailed[0].cnt);
  if (failedCount > 0) {
    warn(`${failedCount} failed transactions in last 24 hours`);
  } else {
    pass("No failed transactions in last 24 hours");
  }
}

// ── Section 3: Redis State ─────────────────────────────────────────────────────

async function checkRedisState() {
  startSection("3. Redis State");

  // 3a. Active crypto payments (crypto-* keys)
  let activeCryptoPayments = 0;
  let stalePayments: { key: string; data: any }[] = [];
  let cursor = 0;

  do {
    const result = await redis.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;
    for (const key of result.keys) {
      activeCryptoPayments++;
      try {
        const raw = await redis.get(key);
        if (raw) {
          const data = JSON.parse(raw);
          const age = Date.now() - new Date(data.created_at || data.createdAt || 0).getTime();
          // If payment is older than 3 hours and still pending/processing
          if (age > 3 * 60 * 60 * 1000 && (data.status === "pending" || data.status === "processing")) {
            stalePayments.push({ key, data });
          }
        }
      } catch {}
    }
  } while (cursor !== 0);

  info(`Active crypto payment sessions in Redis: ${activeCryptoPayments}`);

  if (stalePayments.length > 0) {
    warn(`${stalePayments.length} stale crypto payment(s) in Redis (>3h, still pending/processing)`,
      stalePayments.slice(0, 5).map(s => 
        `${s.key} — status: ${s.data.status}, amount: ${s.data.amount} ${s.data.currency}`
      ).join("\n     "));
  } else {
    pass("No stale pending/processing payments in Redis");
  }

  // 3b. Check for failed-payment keys
  let failedPaymentKeys = 0;
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "failed-payment-*:json", COUNT: 100 });
    cursor = result.cursor;
    failedPaymentKeys += result.keys.length;
  } while (cursor !== 0);

  if (failedPaymentKeys > 0) {
    warn(`${failedPaymentKeys} failed-payment records in Redis — may need reconciliation`);
  } else {
    pass("No failed-payment records in Redis");
  }

  // 3c. Check for processed-tx duplicates marker count
  let processedTxCount = 0;
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "processed-tx-*:json", COUNT: 100 });
    cursor = result.cursor;
    processedTxCount += result.keys.length;
  } while (cursor !== 0);
  info(`Processed transaction markers: ${processedTxCount}`);

  // 3d. Check for stale locks
  let staleLocks = 0;
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "lock:*", COUNT: 100 });
    cursor = result.cursor;
    for (const key of result.keys) {
      const ttl = await redis.ttl(key);
      if (ttl === -1) { // No TTL = permanent lock (bug)
        staleLocks++;
      }
    }
  } while (cursor !== 0);

  if (staleLocks > 0) {
    fail(`${staleLocks} permanent lock(s) in Redis (no TTL set)`, "These may block payment processing");
  } else {
    pass("No permanent locks detected");
  }

  // 3e. Check outgoing-tx markers (sweep in progress)
  let outgoingTxCount = 0;
  cursor = 0;
  do {
    const result = await redis.scan(cursor, { MATCH: "outgoing-tx-*", COUNT: 100 });
    cursor = result.cursor;
    outgoingTxCount += result.keys.length;
  } while (cursor !== 0);
  info(`Active outgoing-tx markers (sweep-in-progress): ${outgoingTxCount}`);
}

// ── Section 4: Webhook Pipeline ────────────────────────────────────────────────

async function checkWebhookPipeline() {
  startSection("4. Webhook Pipeline (BullMQ)");

  // Check BullMQ queue state via Redis keys
  const queueKeys = ["bull:tatum-webhooks:waiting", "bull:tatum-webhooks:active",
    "bull:tatum-webhooks:completed", "bull:tatum-webhooks:failed"];

  for (const key of queueKeys) {
    try {
      const type = await redis.type(key);
      let count: number;
      if (type === "list") {
        count = await redis.lLen(key);
      } else if (type === "zset") {
        count = await redis.zCard(key);
      } else if (type === "set") {
        count = await redis.sCard(key);
      } else {
        count = 0;
      }
      const name = key.split(":").pop()!;
      if (name === "failed" && count > 0) {
        warn(`Webhook queue has ${count} FAILED jobs`, "Check dead-letter queue for details");
      } else if (name === "active" && count > 5) {
        warn(`Webhook queue has ${count} ACTIVE jobs — possible processing bottleneck`);
      } else {
        info(`Webhook queue [${name}]: ${count}`);
      }
    } catch (e: any) {
      info(`Webhook queue [${key.split(":").pop()}]: N/A (${e.message?.substring(0, 50)})`);
    }
  }

  // Check DLQ
  const dlqKeys = ["bull:tatum-webhooks-dlq:waiting", "bull:tatum-webhooks-dlq:failed"];
  let dlqTotal = 0;
  for (const key of dlqKeys) {
    try {
      const type = await redis.type(key);
      let count = 0;
      if (type === "list") count = await redis.lLen(key);
      else if (type === "zset") count = await redis.zCard(key);
      else if (type === "set") count = await redis.sCard(key);
      dlqTotal += count;
    } catch {}
  }

  if (dlqTotal > 0) {
    fail(`Dead Letter Queue has ${dlqTotal} item(s)`, "These webhooks exhausted retries and need manual review");
  } else {
    pass("Dead Letter Queue is empty");
  }

  // Check delayed jobs (retrying)
  try {
    const delayedCount = await redis.zCard("bull:tatum-webhooks:delayed");
    if (delayedCount > 0) {
      warn(`${delayedCount} delayed/retrying webhook job(s)`);
    } else {
      pass("No delayed/retrying webhook jobs");
    }
  } catch {
    info("Could not check delayed jobs");
  }
}

// ── Section 5: Payment State Audit ─────────────────────────────────────────────

async function checkPaymentStates() {
  startSection("5. Payment State Machine Audit");

  // Valid states
  const validStates = [
    "pending", "detected", "confirming", "confirmed", "underpaid",
    "processing", "converted", "payout_complete", "failed", "expired", "refunded",
    "successful", // legacy status
  ];

  const allStatuses = await query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) as cnt FROM tbl_customer_transaction GROUP BY status`
  );

  const invalidStates = allStatuses.filter(s => s.status && !validStates.includes(s.status));
  if (invalidStates.length > 0) {
    warn(`Unknown payment states found in DB`,
      invalidStates.map(s => `"${s.status}" (×${s.cnt})`).join(", "));
  } else {
    pass("All payment states are valid");
  }

  // Check for payments stuck in non-terminal states for >2 hours
  const nonTerminal = ["pending", "detected", "confirming", "confirmed", "underpaid", "processing"];
  for (const state of nonTerminal) {
    const stuck = await query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM tbl_customer_transaction 
       WHERE status = '${state}' AND "updatedAt" < NOW() - INTERVAL '2 hours'`
    );
    const count = parseInt(stuck[0].cnt);
    if (count > 0 && state === "pending") {
      // Pending can be old expired links — only warn if very recent
      info(`${count} transactions in "${state}" for >2h (may include expired payment sessions)`);
    } else if (count > 0) {
      fail(`${count} transaction(s) stuck in "${state}" for >2 hours`,
        `These payments may need manual intervention`, state === "processing" ? "CRITICAL" : "WARNING");
    }
  }

  pass("Payment state audit complete");
}

// ── Section 6: Merchant Pool Health ────────────────────────────────────────────

async function checkMerchantPool() {
  startSection("6. Merchant Pool Health");

  // 6a. Address count by status and type
  const poolStatus = await query<{ wallet_type: string; status: string; cnt: string }>(
    `SELECT wallet_type, status, COUNT(*) as cnt 
     FROM tbl_merchant_temp_address 
     GROUP BY wallet_type, status 
     ORDER BY wallet_type, status`
  );

  const byType: Record<string, Record<string, number>> = {};
  for (const row of poolStatus) {
    if (!byType[row.wallet_type]) byType[row.wallet_type] = {};
    byType[row.wallet_type][row.status] = parseInt(row.cnt);
  }

  info("Merchant pool address distribution:");
  for (const [type, statuses] of Object.entries(byType)) {
    const parts = Object.entries(statuses).map(([s, c]) => `${s}: ${c}`);
    console.log(`     ${type}: ${parts.join(", ")}`);

    // Warn if no AVAILABLE addresses
    if (!statuses.AVAILABLE || statuses.AVAILABLE === 0) {
      warn(`No AVAILABLE addresses for ${type}`, "New payments for this chain will fail!");
    }
  }

  // 6b. Check for addresses stuck in RESERVED for >2 hours
  const stuckReserved = await query<{ temp_address_id: number; wallet_type: string; wallet_address: string; reserved_at: string }>(
    `SELECT temp_address_id, wallet_type, wallet_address, reserved_at 
     FROM tbl_merchant_temp_address 
     WHERE status = 'RESERVED' AND reserved_at < NOW() - INTERVAL '2 hours'
     LIMIT 10`
  );
  if (stuckReserved.length > 0) {
    warn(`${stuckReserved.length} address(es) stuck in RESERVED for >2h`,
      stuckReserved.map(a => `#${a.temp_address_id} ${a.wallet_type} ${a.wallet_address.substring(0, 16)}…`).join("\n     "));
  } else {
    pass("No addresses stuck in RESERVED state");
  }

  // 6c. Check for addresses with non-zero admin_fee_balance and AVAILABLE status
  const unsweptAvailable = await query<{ temp_address_id: number; wallet_type: string; admin_fee_balance: string; wallet_address: string }>(
    `SELECT temp_address_id, wallet_type, admin_fee_balance, wallet_address
     FROM tbl_merchant_temp_address 
     WHERE status = 'AVAILABLE' AND CAST(admin_fee_balance AS DECIMAL) > 0
     LIMIT 10`
  );
  if (unsweptAvailable.length > 0) {
    fail(`${unsweptAvailable.length} AVAILABLE address(es) with non-zero admin_fee_balance (unswept funds!)`,
      unsweptAvailable.map(a => 
        `#${a.temp_address_id} ${a.wallet_type} — balance: ${a.admin_fee_balance} — ${a.wallet_address.substring(0, 16)}…`
      ).join("\n     "));
  } else {
    pass("No AVAILABLE addresses with unswept balances");
  }

  // 6d. Check for IN_USE addresses with zero balance (already swept but not released)
  const emptyInUse = await query<{ temp_address_id: number; wallet_type: string; wallet_address: string; last_payment_at: string }>(
    `SELECT temp_address_id, wallet_type, wallet_address, last_payment_at
     FROM tbl_merchant_temp_address 
     WHERE status = 'IN_USE' AND CAST(admin_fee_balance AS DECIMAL) = 0
     AND last_payment_at < NOW() - INTERVAL '1 hour'
     LIMIT 10`
  );
  if (emptyInUse.length > 0) {
    warn(`${emptyInUse.length} IN_USE address(es) with zero balance & no recent payment`,
      emptyInUse.map(a => `#${a.temp_address_id} ${a.wallet_type} ${a.wallet_address.substring(0, 16)}…`).join("\n     "));
  } else {
    pass("No stuck empty IN_USE addresses");
  }
}

// ── Section 7: On-Chain Balance Verification ───────────────────────────────────

async function checkOnChainBalances() {
  startSection("7. On-Chain Balance Verification (IN_USE addresses)");

  // Only check IN_USE addresses with reported balances
  const inUseAddresses = await query<{
    temp_address_id: number; wallet_type: string; wallet_address: string;
    admin_fee_balance: string; gas_balance: string;
  }>(
    `SELECT temp_address_id, wallet_type, wallet_address, admin_fee_balance, gas_balance
     FROM tbl_merchant_temp_address 
     WHERE status = 'IN_USE' AND CAST(admin_fee_balance AS DECIMAL) > 0
     ORDER BY CAST(admin_fee_balance AS DECIMAL) DESC
     LIMIT 15`
  );

  if (inUseAddresses.length === 0) {
    info("No IN_USE addresses with reported balances to verify");
    return;
  }

  info(`Checking on-chain balances for ${inUseAddresses.length} active address(es)...`);

  let tatumHeaders = { "x-api-key": process.env.TATUM_KEY || "" };
  let mismatchCount = 0;

  for (const addr of inUseAddresses) {
    try {
      let onChainBalance: number | null = null;

      // Use Tatum balance endpoint based on chain
      const wt = addr.wallet_type;
      let balanceUrl = "";
      
      if (wt === "USDT-TRC20") {
        balanceUrl = `https://api.tatum.io/v4/tron/account/${addr.wallet_address}`;
      } else if (wt === "BTC" || wt === "LTC" || wt === "DOGE" || wt === "BCH") {
        balanceUrl = `https://api.tatum.io/v4/bitcoin/address/balance/${addr.wallet_address}`;
        if (wt === "LTC") balanceUrl = `https://api.tatum.io/v4/litecoin/address/balance/${addr.wallet_address}`;
        if (wt === "DOGE") balanceUrl = `https://api.tatum.io/v4/dogecoin/address/balance/${addr.wallet_address}`;
        if (wt === "BCH") balanceUrl = `https://api.tatum.io/v4/bcash/address/balance/${addr.wallet_address}`;
      } else if (wt === "ETH" || wt === "USDT-ERC20" || wt === "USDC-ERC20" || wt === "RLUSD-ERC20") {
        balanceUrl = `https://api.tatum.io/v4/ethereum/account/balance/${addr.wallet_address}`;
      } else if (wt === "SOL") {
        balanceUrl = `https://api.tatum.io/v4/solana/account/balance/${addr.wallet_address}`;
      } else if (wt === "TRX") {
        balanceUrl = `https://api.tatum.io/v4/tron/account/${addr.wallet_address}`;
      }

      if (balanceUrl) {
        try {
          const res = await axios.get(balanceUrl, {
            headers: tatumHeaders,
            timeout: 10000,
            validateStatus: () => true,
          });

          if (res.status === 200 && res.data) {
            if (wt === "USDT-TRC20" || wt === "TRX") {
              // Tron account - need to parse TRC20 tokens
              if (wt === "USDT-TRC20") {
                const trc20 = res.data.trc20 || [];
                const usdt = trc20.find((t: any) => t[process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"]);
                onChainBalance = usdt ? parseFloat(usdt[process.env.TRX_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"]) / 1e6 : 0;
              } else {
                onChainBalance = (res.data.balance || 0) / 1e6;
              }
            } else if (wt === "SOL") {
              onChainBalance = parseFloat(res.data.balance || "0") / 1e9;
            } else if (["BTC", "LTC", "DOGE", "BCH"].includes(wt)) {
              onChainBalance = parseFloat(res.data.incoming || "0") - parseFloat(res.data.outgoing || "0");
            } else {
              onChainBalance = parseFloat(res.data.balance || "0");
            }
          }
        } catch (apiErr: any) {
          info(`  Could not check ${wt} ${addr.wallet_address.substring(0, 12)}…: ${apiErr.message}`);
          continue;
        }
      }

      const dbBalance = parseFloat(addr.admin_fee_balance);
      
      if (onChainBalance !== null) {
        if (Math.abs(onChainBalance - dbBalance) > 0.01) {
          warn(`Balance mismatch for #${addr.temp_address_id} (${wt})`,
            `DB: ${dbBalance}, On-chain: ${onChainBalance} — ${addr.wallet_address}`);
          mismatchCount++;
        } else {
          pass(`#${addr.temp_address_id} ${wt}: DB=${dbBalance}, Chain=${onChainBalance} ✓`);
        }
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 300));
    } catch (e: any) {
      info(`  Error checking #${addr.temp_address_id}: ${e.message}`);
    }
  }

  if (mismatchCount === 0 && inUseAddresses.length > 0) {
    pass("All on-chain balances match DB records");
  }
}

// ── Section 8: Sweep Pipeline ──────────────────────────────────────────────────

async function checkSweepPipeline() {
  startSection("8. Sweep Pipeline");

  // 8a. Failed sweeps in last 48 hours
  const failedSweeps = await query<{
    sweep_id: number; temp_address_id: number; wallet_type: string;
    amount: string; status: string; error_message: string; created_at: string;
  }>(
    `SELECT sweep_id, temp_address_id, wallet_type, amount, status, error_message, created_at
     FROM tbl_merchant_pool_sweep
     WHERE status = 'failed' AND created_at > NOW() - INTERVAL '48 hours'
     ORDER BY created_at DESC LIMIT 10`
  );

  if (failedSweeps.length > 0) {
    fail(`${failedSweeps.length} failed sweep(s) in last 48 hours`,
      failedSweeps.map(s =>
        `#${s.sweep_id} ${s.wallet_type} addr#${s.temp_address_id} — ${s.amount} — ${(s.error_message || "").substring(0, 80)}`
      ).join("\n     "));
  } else {
    pass("No failed sweeps in last 48 hours");
  }

  // 8b. Pending/in-progress sweeps
  const pendingSweeps = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_merchant_pool_sweep WHERE status = 'pending' OR status = 'in_progress'`
  );
  const pendingCount = parseInt(pendingSweeps[0].cnt);
  if (pendingCount > 0) {
    warn(`${pendingCount} pending/in-progress sweep(s)`, "May be stuck or in process");
  } else {
    pass("No pending sweeps");
  }

  // 8c. Sweep success rate (last 7 days)
  const sweepStats = await query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) as cnt FROM tbl_merchant_pool_sweep 
     WHERE created_at > NOW() - INTERVAL '7 days' GROUP BY status`
  );
  if (sweepStats.length > 0) {
    info("Sweep stats (last 7 days):");
    let total = 0, completed = 0;
    for (const s of sweepStats) {
      console.log(`     ${s.status}: ${s.cnt}`);
      total += parseInt(s.cnt);
      if (s.status === "completed") completed = parseInt(s.cnt);
    }
    if (total > 0) {
      const rate = ((completed / total) * 100).toFixed(1);
      if (parseFloat(rate) < 90) {
        warn(`Sweep success rate is ${rate}% — below 90% threshold`);
      } else {
        pass(`Sweep success rate: ${rate}%`);
      }
    }
  } else {
    info("No sweeps in last 7 days");
  }

  // 8d. Check for OUT_OF_ENERGY patterns in recent sweep errors
  const energyErrors = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_merchant_pool_sweep 
     WHERE status = 'failed' AND (error_message ILIKE '%OUT_OF_ENERGY%' OR error_message ILIKE '%energy%')
     AND created_at > NOW() - INTERVAL '7 days'`
  );
  const energyErrCount = parseInt(energyErrors[0].cnt);
  if (energyErrCount > 0) {
    fail(`${energyErrCount} sweep(s) failed due to energy issues in last 7 days`,
      "feeLimit may be too low for TRC20 transfers with energy penalty");
  } else {
    pass("No energy-related sweep failures in last 7 days");
  }

  // 8e. Check sweep configuration
  const sweepConfigs = [
    { chain: "USDT-TRC20", envThreshold: process.env.USDT_TRC20_THRESHOLD },
    { chain: "BTC", envThreshold: process.env.BTC_THRESHOLD },
    { chain: "ETH", envThreshold: process.env.ETH_THRESHOLD },
    { chain: "LTC", envThreshold: process.env.LTC_THRESHOLD },
    { chain: "SOL", envThreshold: process.env.SOL_THRESHOLD },
    { chain: "XRP", envThreshold: process.env.XRP_THRESHOLD },
  ];

  for (const config of sweepConfigs) {
    if (config.envThreshold) {
      info(`Sweep threshold ${config.chain}: ${config.envThreshold}`);
    } else {
      warn(`No sweep threshold configured for ${config.chain}`);
    }
  }
}

// ── Section 9: Fee Wallet & Admin Wallet Health ────────────────────────────────

async function checkWalletHealth() {
  startSection("9. Fee Wallet & Admin Wallet Health");

  // 9a. Check fee wallets from DB
  const feeWallets = await query<{ fee_wallet_id: number; wallet_type: string; wallet_address: string }>(
    `SELECT fee_wallet_id, wallet_type, wallet_address FROM tbl_admin_fee_wallet`
  );

  info(`Fee wallets in DB: ${feeWallets.length}`);
  for (const fw of feeWallets) {
    console.log(`     ${fw.wallet_type}: ${fw.wallet_address}`);
  }

  // 9b. Check TRX fee wallet balance (critical for TRC20 sweeps)
  const trxFeeWallet = feeWallets.find(w => w.wallet_type === "TRX");
  if (trxFeeWallet) {
    try {
      const res = await axios.get(`https://api.tatum.io/v4/tron/account/${trxFeeWallet.wallet_address}`, {
        headers: { "x-api-key": process.env.TATUM_KEY || "" },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (res.status === 200 && res.data) {
        const trxBalance = (res.data.balance || 0) / 1e6;
        if (trxBalance < 10) {
          fail(`TRX fee wallet LOW BALANCE: ${trxBalance.toFixed(2)} TRX`,
            `Address: ${trxFeeWallet.wallet_address} — TRC20 sweeps need ~15-30 TRX gas each`);
        } else if (trxBalance < 50) {
          warn(`TRX fee wallet balance: ${trxBalance.toFixed(2)} TRX — getting low`,
            `Address: ${trxFeeWallet.wallet_address}`);
        } else {
          pass(`TRX fee wallet: ${trxBalance.toFixed(2)} TRX ✓`);
        }
      }
    } catch (e: any) {
      warn(`Could not check TRX fee wallet balance: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  // 9c. Check ETH fee wallet balance
  const ethFeeWallet = feeWallets.find(w => w.wallet_type === "ETH");
  if (ethFeeWallet) {
    try {
      const res = await axios.get(`https://api.tatum.io/v4/ethereum/account/balance/${ethFeeWallet.wallet_address}`, {
        headers: { "x-api-key": process.env.TATUM_KEY || "" },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (res.status === 200) {
        const ethBalance = parseFloat(res.data?.balance || "0");
        if (ethBalance < 0.001) {
          fail(`ETH fee wallet LOW BALANCE: ${ethBalance} ETH`,
            `Address: ${ethFeeWallet.wallet_address} — ERC20 sweeps need gas`);
        } else if (ethBalance < 0.01) {
          warn(`ETH fee wallet balance: ${ethBalance} ETH — getting low`);
        } else {
          pass(`ETH fee wallet: ${ethBalance} ETH ✓`);
        }
      }
    } catch (e: any) {
      warn(`Could not check ETH fee wallet balance: ${e.message}`);
    }
  }

  // 9d. Admin wallets configured
  let missingAdminWallets = 0;
  for (const [chain, addr] of Object.entries(ADMIN_WALLETS)) {
    if (!addr) {
      warn(`Admin wallet not configured for ${chain}`);
      missingAdminWallets++;
    }
  }
  if (missingAdminWallets === 0) {
    pass(`All ${Object.keys(ADMIN_WALLETS).length} admin wallet addresses configured`);
  }
}

// ── Section 10: Tatum Subscription Verification ────────────────────────────────

async function checkTatumSubscriptions() {
  startSection("10. Tatum Subscription Health");

  // Check active IN_USE addresses have Tatum subscriptions
  const activeAddresses = await query<{ wallet_address: string; wallet_type: string }>(
    `SELECT wallet_address, wallet_type FROM tbl_merchant_temp_address 
     WHERE status = 'IN_USE' LIMIT 5`
  );

  if (activeAddresses.length === 0) {
    info("No IN_USE addresses to check subscriptions for");
    return;
  }

  let checkedCount = 0;
  let missingSubCount = 0;

  for (const addr of activeAddresses.slice(0, 3)) {
    try {
      const res = await axios.get(
        `https://api.tatum.io/v4/subscription?pageSize=10&address=${addr.wallet_address}`,
        {
          headers: { "x-api-key": process.env.TATUM_KEY || "" },
          timeout: 10000,
          validateStatus: () => true,
        }
      );

      if (res.status === 200) {
        const subs = Array.isArray(res.data) ? res.data : [];
        if (subs.length > 0) {
          const activeSub = subs.find((s: any) => s.attr?.url);
          if (activeSub) {
            pass(`Subscription active for ${addr.wallet_type} ${addr.wallet_address.substring(0, 12)}…`);
          } else {
            warn(`Subscription found but no webhook URL for ${addr.wallet_type} ${addr.wallet_address.substring(0, 12)}…`);
            missingSubCount++;
          }
        } else {
          fail(`NO SUBSCRIPTION for IN_USE address ${addr.wallet_type} ${addr.wallet_address.substring(0, 12)}…`,
            "Payments to this address will NOT trigger webhooks!");
          missingSubCount++;
        }
      }
      checkedCount++;
      await new Promise(r => setTimeout(r, 500));
    } catch (e: any) {
      info(`Could not check subscription for ${addr.wallet_address.substring(0, 12)}…: ${e.message}`);
    }
  }

  if (checkedCount > 0 && missingSubCount === 0) {
    pass(`All ${checkedCount} checked addresses have active subscriptions`);
  }
}

// ── Section 11: Stablecoin Conversion Pipeline ─────────────────────────────────

async function checkStablecoinConversion() {
  startSection("11. Stablecoin Conversion Pipeline");

  // Check for stuck conversions
  const stuckConversions = await query<{ conversion_id: string; status: string; source_currency: string; amount: string; "updatedAt": string }>(
    `SELECT conversion_id, status, source_currency, amount, "updatedAt"
     FROM tbl_stablecoin_conversion 
     WHERE status IN ('pending', 'processing', 'deposit_pending', 'converting')
     AND "updatedAt" < NOW() - INTERVAL '1 hour'
     ORDER BY "updatedAt" ASC LIMIT 10`
  );

  if (stuckConversions.length > 0) {
    fail(`${stuckConversions.length} stablecoin conversion(s) stuck for >1 hour`,
      stuckConversions.map(c =>
        `${c.conversion_id.substring(0, 8)}… ${c.status} — ${c.amount} ${c.source_currency} (updated: ${c.updatedAt})`
      ).join("\n     "));
  } else {
    pass("No stuck stablecoin conversions");
  }

  // Conversion stats last 7 days
  const convStats = await query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*) as cnt FROM tbl_stablecoin_conversion 
     WHERE "createdAt" > NOW() - INTERVAL '7 days' GROUP BY status`
  );
  if (convStats.length > 0) {
    info("Stablecoin conversion stats (last 7 days):");
    for (const s of convStats) {
      console.log(`     ${s.status}: ${s.cnt}`);
    }
  } else {
    info("No stablecoin conversions in last 7 days");
  }

  // Check for failed conversions
  const failedConversions = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_stablecoin_conversion 
     WHERE status = 'failed' AND "createdAt" > NOW() - INTERVAL '48 hours'`
  );
  const failedConvCount = parseInt(failedConversions[0].cnt);
  if (failedConvCount > 0) {
    warn(`${failedConvCount} failed conversion(s) in last 48 hours`);
  } else {
    pass("No failed conversions in last 48 hours");
  }
}

// ── Section 12: Reconciliation Dry Run ─────────────────────────────────────────

async function checkReconciliation() {
  startSection("12. Reconciliation Check");

  // 12a. Cross-check: payments with "processing" status in Redis vs DB
  let redisProcessing = 0;
  let cursor = 0;
  const mismatchedPayments: string[] = [];

  do {
    const result = await redis.scan(cursor, { MATCH: "crypto-*:json", COUNT: 100 });
    cursor = result.cursor;
    for (const key of result.keys) {
      try {
        const raw = await redis.get(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        if (data.status === "processing") {
          redisProcessing++;
          // Check if DB agrees
          if (data.payment_id) {
            const dbTx = await query<{ status: string }>(
              `SELECT status FROM tbl_customer_transaction WHERE payment_id = '${data.payment_id}' LIMIT 1`
            );
            if (dbTx.length > 0 && dbTx[0].status !== "processing" && dbTx[0].status !== data.status) {
              mismatchedPayments.push(`${data.payment_id}: Redis=${data.status}, DB=${dbTx[0].status}`);
            }
          }
        }
      } catch {}
    }
  } while (cursor !== 0);

  if (mismatchedPayments.length > 0) {
    fail(`${mismatchedPayments.length} Redis/DB status mismatch(es)`,
      mismatchedPayments.slice(0, 5).join("\n     "));
  } else {
    pass("Redis and DB payment statuses are consistent");
  }

  info(`Payments currently "processing" in Redis: ${redisProcessing}`);

  // 12b. Check for payments with amount received but still pending (missed webhooks)
  const missedWebhooks = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_customer_transaction 
     WHERE status = 'pending' AND paid_amount > 0`
  );
  const missedCount = parseInt(missedWebhooks[0].cnt);
  if (missedCount > 0) {
    fail(`${missedCount} payment(s) with received amount but still "pending"`,
      "These may have been processed but status not updated — possible missed webhook");
  } else {
    pass('No pending payments with non-zero paid amount');
  }

  // 12c. Check for orphaned pool transactions (no matching customer transaction)
  const orphanedPoolTx = await query<{ cnt: string }>(
    `SELECT COUNT(*) as cnt FROM tbl_merchant_pool_transaction mpt
     WHERE NOT EXISTS (
       SELECT 1 FROM tbl_customer_transaction ct 
       WHERE ct.payment_id = mpt.payment_id
     )
     AND mpt."createdAt" > NOW() - INTERVAL '7 days'`
  );
  const orphanCount = parseInt(orphanedPoolTx[0].cnt);
  if (orphanCount > 0) {
    warn(`${orphanCount} orphaned pool transaction(s) — no matching customer transaction (last 7 days)`);
  } else {
    pass("No orphaned pool transactions");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║              DynoPay E2E Payment Pipeline Diagnostic                ║
║              ${new Date().toISOString()}                ║
╚══════════════════════════════════════════════════════════════════════╝`);

  // Initialize connections
  seq = new Sequelize(
    process.env.DB_NAME!,
    process.env.USER_NAME!,
    process.env.PASSWORD!,
    {
      host: process.env.HOST!,
      port: Number(process.env.DB_PORT),
      dialect: "postgres",
      logging: false,
    }
  );

  redis = createClient({ url: process.env.REDIS_PUBLIC_URL }) as RedisClientType;
  await redis.connect();

  // Run all checks
  await checkBackendHealth();
  await checkDatabaseIntegrity();
  await checkRedisState();
  await checkWebhookPipeline();
  await checkPaymentStates();
  await checkMerchantPool();
  await checkOnChainBalances();
  await checkSweepPipeline();
  await checkWalletHealth();
  await checkTatumSubscriptions();
  await checkStablecoinConversion();
  await checkReconciliation();

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\n\n${"═".repeat(70)}`);
  console.log("  DIAGNOSTIC SUMMARY");
  console.log(`${"═".repeat(70)}`);

  let totalPassed = 0, totalFailed = 0, totalWarnings = 0;

  for (const [section, results] of Object.entries(sectionResults)) {
    const status = results.failed > 0 ? "❌" : results.warnings > 0 ? "⚠️ " : "✅";
    console.log(`  ${status} ${section} — ${results.passed} passed, ${results.failed} failed, ${results.warnings} warnings`);
    totalPassed += results.passed;
    totalFailed += results.failed;
    totalWarnings += results.warnings;
  }

  console.log(`\n  ${"─".repeat(66)}`);
  console.log(`  TOTAL: ${totalPassed} passed, ${totalFailed} critical, ${totalWarnings} warnings`);
  console.log(`  ${"─".repeat(66)}`);

  if (issues.filter(i => i.severity === "CRITICAL").length > 0) {
    console.log(`\n  🔴 CRITICAL ISSUES REQUIRING ATTENTION:`);
    for (const issue of issues.filter(i => i.severity === "CRITICAL")) {
      console.log(`     • [${issue.section}] ${issue.message}`);
      if (issue.details) console.log(`       └─ ${issue.details}`);
    }
  }

  if (issues.filter(i => i.severity === "WARNING").length > 0) {
    console.log(`\n  🟡 WARNINGS:`);
    for (const issue of issues.filter(i => i.severity === "WARNING")) {
      console.log(`     • [${issue.section}] ${issue.message}`);
    }
  }

  if (totalFailed === 0 && totalWarnings === 0) {
    console.log(`\n  🟢 ALL SYSTEMS HEALTHY — No issues detected!`);
  } else if (totalFailed === 0) {
    console.log(`\n  🟡 SYSTEM OPERATIONAL — ${totalWarnings} non-critical warning(s)`);
  } else {
    console.log(`\n  🔴 ISSUES DETECTED — ${totalFailed} critical issue(s) need attention`);
  }

  console.log(`\n${"═".repeat(70)}\n`);

  // Cleanup
  await redis.disconnect();
  await seq.close();
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("\n❌ DIAGNOSTIC SCRIPT FAILED:", e.message);
  console.error(e.stack);
  try { await redis?.disconnect(); } catch {}
  try { await seq?.close(); } catch {}
  process.exit(2);
});
