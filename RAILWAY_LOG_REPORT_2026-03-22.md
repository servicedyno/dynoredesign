# Railway Log Analysis Report — 2026-03-22

**Deployment**: `2de7d399-2982-44b0-a488-018e0e89313d` (deployed Mar 20 19:13, status: SUCCESS)  
**Analysis Period**: 2026-03-20T19:16 → 2026-03-22T15:50 (~44 hours runtime)  
**Logs Analyzed**: ~14,000 unique runtime logs across 7 time windows  
**Previous Reports**: [2026-03-20](/app/RAILWAY_LOG_REPORT_2026-03-20.md), [2026-03-15](/app/RAILWAY_LOG_REPORT_2026-03-15.md), [2026-02-23](/app/RAILWAY_LOG_REPORT_2026-02-23.md)

---

## Executive Summary

The deployment is running stably with no crashes, but a **critical USDT-TRC20 payment settlement failure** occurred on Mar 22 around 15:04 UTC. The root cause is **depleted TRX gas balance** — the hot wallet used for gas funding has essentially zero TRX, making all TRON network token transfers impossible. This caused a payment of **80 USDT-TRC20** to fail after multiple retries and end up in the Dead Letter Queue (DLQ). There are now **4 payments stuck in 'processing' state** and **2 permanently failed webhook jobs** in the DLQ. The system sent critical alert emails to moxxcompany@gmail.com but the underlying issue (zero TRX balance) persists.

---

## 🔴 ANOMALY #1: USDT-TRC20 Payment Settlement Failure — Depleted TRX Gas (CRITICAL — P0)

### Timeline

| Time (UTC) | Event |
|------------|-------|
| **14:50:15** | Merchant API call: `cryptoPayment` — Company 3, Amount 80, Currency USDT-TRC20 |
| **14:50:15** | Currency validated against available list (15 currencies including USDT-TRC20) |
| **14:50:15** | Wallet check: user_id=4, company_id=3 |
| **14:50:15** | Using **MERCHANT POOL** for USDT-TRC20 payment |
| **14:50:16** | ⚡ FAST PATH: Pre-reserved address assigned: `TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5` |
| **14:50:16** | Stablecoin 1:1 peg: $80 USD = 80 USDT-TRC20. Customer pays: 80.00000000, Merchant receives: 77.80000000 (97.25%), Admin fees: 2.20000000 (2.75%) |
| **15:04:24** | Tatum webhook received: **80.01 USDT_TRON** confirmed on-chain at `TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5` (TX: `d33af4694c94d6...`) |
| **15:04:25** | Redis data matched: expected 80 USDT-TRC20, payment_id=`ef0b29e4-a053-40de-85f1-fe9bb1053727` |
| **15:04:27** | `payment.pending` webhook sent to merchant: `https://nomadlynew-production.up.railway.app/dynopay/crypto-wallet` |
| **15:04:33** | SmartGas: Waiting for gas funding TX `45b5e92f...` confirmation → TX not found on chain |
| **15:04:34** | SmartGas: Waiting for gas funding TX `0483d21a...` confirmation |
| **15:04:40** | ❌ **Token merchant transfer (USDT-TRC20) FAILED**: `tron.trc20.tx.send.error` — **"Insufficient TRC20 balance"** |
| **15:04:41** | Error detail: tempAddress `TVzJHr4E...`, receivedAmount=3.07207, userAmount=135.06593 |
| **15:04:41** | ⚠️ State Machine SOFT REJECT: Invalid transition processing → processing |
| **15:04:54** | Retry 2/3 — same error: Insufficient TRC20 balance |
| **15:05:10** | Retry 3/3 — same error. `cryptoVerification` failed after retries |
| **15:05:11** | State: `processing → failed` (crypto-verification-failure) |
| **15:05:11** | `payment.failed` webhook sent to merchant |
| **15:05:12** | ❌ Webhook Job `tx-05fd6ca8...` failed (2 retries left in queue) |
| **15:05:42** | FAILED PAYMENT RECOVERY: Retry attempt 1/3 for payment `ef0b29e4...` |
| **15:05:47** | ❌ SmartGas funding failed: `tron.blockchain.broadcast.error` — "Contract validate error: balance is not sufficient" |
| **15:05:49** | Token transfer failed again — same Insufficient TRC20 balance error |
| **15:06:07** | ❌ SmartGas funding failed (again) |
| **15:06:09** | Recovery retry 2 — same failure. Job failed (1 retry left) |
| **15:07:11** | FAILED PAYMENT RECOVERY: Retry attempt 2/3 |
| **15:07:16-38** | Same cycle: SmartGas fail → Token transfer fail → Job fail |
| **15:07:39** | ❌ **Job EXHAUSTED all retries → Moved to DLQ** |
| **15:07:39** | 🔴 CRITICAL alert email sent to moxxcompany@gmail.com |
| **15:07:39** | DLQ alert email sent for TX `05fd6ca8...` |
| **15:16:35** | Error Digest email sent: "1 error in last 15 min (1 high)" |

### Key Details

| Field | Value |
|-------|-------|
| **Payment ID** | `ef0b29e4-a053-40de-85f1-fe9bb1053727` |
| **Company ID** | 3 |
| **Merchant User ID** | 4 |
| **Currency** | USDT-TRC20 |
| **Amount Requested** | 80 USDT-TRC20 ($80 USD) |
| **Amount Received** | 80.01 USDT-TRC20 (on-chain confirmed) |
| **Temp Address** | `TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5` |
| **Incoming TX** | `d33af4694c94d6406c917a9854b29be52e5331df5bb3436499a47f038ff36253` |
| **Merchant Webhook** | `https://nomadlynew-production.up.railway.app/dynopay/crypto-wallet` |
| **Final State** | `failed` (crypto-verification-failure) |
| **Webhook Job** | `tx-05fd6ca870038b3e522daf5bafa5ea7cdd71a0ef1d16a3c84d2b386115aa4c9f-1774191866702` |
| **Total Retry Attempts** | 9 token transfers + 6 SmartGas attempts + 3 recovery attempts |
| **Tatum Dashboard Logs** | Multiple — e.g. `https://dashboard.tatum.io/logs?id=69c005080df52cd0931e2c82` |

### Root Cause Analysis

```
1. TRIGGER: Customer sent 80.01 USDT-TRC20 to merchant pool address
2. SETTLEMENT: System tries to transfer USDT-TRC20 from temp → merchant wallet
3. GAS REQUIRED: TRC-20 token transfers on TRON require TRX for gas/bandwidth/energy
4. SMARTGAS ATTEMPTS: System tried to fund TRX gas from hot wallet → FAILED
   ↳ Error: "Contract validate error: balance is not sufficient"
   ↳ The TRX gas funding source wallet has no TRX
5. TOKEN TRANSFER FAILS: Without TRX gas, USDT-TRC20 transfer is impossible
   ↳ Error: "Cannot send TRC-20 transaction. Cause: Insufficient TRC20 balance"
6. TRX FEE BALANCE: Dropped from 0.000050 TRX → 0.000008 TRX (effectively zero)
```

**The 80.01 USDT-TRC20 is sitting in the temp address `TVzJHr4EynTsdtQGXtnppTTfCLSC8LXnY5` with no way to be moved until TRX gas is replenished.**

### Anomalous Data Points

- `receivedAmount: 3.07207` vs `userAmount: 135.06593` — These numbers don't match the 80 USDT expected. This suggests possible data corruption or a mismatch between what the settlement logic is seeing vs. what was actually received. **This needs investigation.**
- The payment appears **4 times** in the Watchdog stuck payment list (same ID repeated), suggesting the cron job may be duplicating records.

### Impact

- ⛔ **80.01 USDT-TRC20 ($80) locked** in temp address — customer paid but merchant not settled
- ⛔ **All future TRON/TRC-20 payments will fail** until TRX gas is replenished
- ⚠️ Merchant pool address `TVzJHr4E...` is stuck (not recyclable)
- ⚠️ `payment.failed` webhook was sent to merchant — merchant may have already cancelled the order

### Required Actions

| Priority | Action | Effort |
|----------|--------|--------|
| **IMMEDIATE** | **Replenish TRX** in the gas funding hot wallet (deposit at least 100-500 TRX) | 5 min |
| **IMMEDIATE** | Manually settle payment `ef0b29e4...` — transfer the 80.01 USDT-TRC20 from `TVzJHr4E...` to merchant wallet | 15 min |
| **P0** | Investigate the `receivedAmount: 3.07207` vs `userAmount: 135.06593` mismatch | 1-2 hours |
| **P1** | Add TRX balance monitoring alert — trigger when balance drops below 10 TRX | 2 hours |
| **P1** | Add pre-flight gas balance check before accepting TRON payments | 3-4 hours |

---

## 🔴 ANOMALY #2: 4 Payments Stuck in 'processing' State (CRITICAL — P0)

### Details

```
[2026-03-22T15:20:07] [Watchdog] ⚠️ 4 payment(s) stuck in 'processing' for >10 min
  (below recovery threshold of 60 min).
  IDs: ef0b29e4-a053-40de-85f1-fe9bb1053727, ef0b29e4-a053-40de-85f1-fe9bb1053727,
       ef0b29e4-a053-40de-85f1-fe9bb1053727...
```

This warning repeats every 10 minutes (15:20, 15:30, 15:40...) and has been continuous.

### Analysis

- The **same payment ID appears 4 times** — this is abnormal and suggests:
  - A database bug where duplicate payment records exist, OR
  - The watchdog query is joining with another table that produces duplicates
- From the previous deployment (Mar 20), there were already **9 stuck payments** including `d4be75d0-fc67-4f0e-be31-16f68da42e1e` (BTC, stuck 92+ min)
- The previous 2 stuck payments from the Mar 20 report (`69f71235...`, `a7f60980...`) appear to have been resolved or rolled off

### Impact

- Stuck payments = locked pool addresses = reduced address capacity
- Continuous watchdog warnings every 2 min add log noise
- The "below recovery threshold of 60 min" means the watchdog sees them but won't auto-recover yet

### Required Actions

| Priority | Action |
|----------|--------|
| **P0** | Query DB for payment `ef0b29e4...` — check why it appears 4 times |
| **P0** | Use `/diagnostics/recover-stuck-payment` endpoint to recover |
| **P1** | Fix watchdog query to deduplicate payment IDs |

---

## 🟡 ANOMALY #3: WebhookQueue — 2 Failed Jobs in DLQ (MEDIUM — P1)

### Details

```
[2026-03-22T15:10:35] [WebhookQueue] ⚠️ Health check: 2 failed jobs — check DLQ or reconciliation
[2026-03-22T15:10:35] [WebhookQueue] ✅ Health check OK — worker running, waiting=0, active=0, delayed=0, failed=2
```

- **2 permanently failed jobs** in the webhook queue (increased from 1 earlier in the day, and 0 on Mar 20)
- Health check warning fires **every 60 seconds** — generating ~1,440 warnings/day
- The second failed job was added when `tx-05fd6ca870038b3e...` exhausted all retries at 15:07:39

### Timeline of Failed Job Count

| Time Range | Failed Jobs | Notes |
|------------|-------------|-------|
| Mar 20 19:20 - Mar 22 14:50 | 0 | Clean state |
| Mar 22 ~15:05 | 1 | First TRX payment failure |
| Mar 22 ~15:07 | 2 | TRX job moved to DLQ after exhausting retries |

### Required Actions

| Priority | Action |
|----------|--------|
| **P1** | Drain/retry the 2 DLQ jobs after replenishing TRX gas |
| **P2** | Consider reducing health check warning frequency for known DLQ items |

---

## 🟡 ANOMALY #4: SmartGas Funding System Failure (MEDIUM — P1)

### Details

6 consecutive SmartGas funding failures logged between 15:05:47 and 15:07:36:

```
[2026-03-22T15:05:47] [SmartGas] ❌ Gas funding failed:
[settleCryptoTransaction] SmartGas Error: {"statusCode":403,"errorCode":"tron.blockchain.broadcast.error",
  "message":"Unable to broadcast transaction",
  "cause":"Contract validate error : Validate TransferContract error, balance is not sufficient."}
```

### Root Cause

The SmartGas system's source TRX wallet has no TRX to transfer for gas funding. This is the **same root cause as Anomaly #1** — depleted TRX balance.

The TRX fee balance log confirms:
```
[checkFeeBalance] TRX: balance changed 0.000050340671 → 0.000008456687
```

This is ~0.000008 TRX — essentially zero (one TRX transaction costs ~1-5 TRX of energy/bandwidth).

### Required Actions

- Same as Anomaly #1: **Replenish TRX in the gas hot wallet immediately**

---

## 🟡 ANOMALY #5: State Machine Invalid Transitions (MEDIUM — P2)

### Details

6 occurrences of:
```
[StateMachine] SOFT REJECT: Invalid state transition: processing → processing
  for payment ef0b29e4-a053-40de-85f1-fe9bb1053727.
  Allowed: [payout_complete, converted, failed]
```

### Analysis

During the retry loop for the failed TRX payment, the system attempted to re-enter the `processing` state while already in `processing`. The state machine correctly rejected this as a soft error, but it indicates the retry/recovery logic doesn't check current state before attempting a transition.

### Impact

- No data corruption (soft reject prevents the transition)
- But it generates noise and indicates a logic gap in the recovery flow
- The allowed transitions from `processing` are: `payout_complete`, `converted`, `failed`

### Required Action

- Add state check in the recovery/retry logic: before retrying settlement, verify payment is still in `processing` and skip if already `failed`

---

## 🟡 ANOMALY #6: Binance WebSocket Geo-Blocking (RECURRING — P2)

### Status

Same as [Mar 20 report](/app/RAILWAY_LOG_REPORT_2026-03-20.md) — Binance WebSocket is geo-blocked on Railway. System is using REST-based Tatum rate API as fallback.

```
[Binance] 🌍 Geo-blocked but proxy also failed. Proxy DISABLED (will retry next cycle).
```

- Background cache is working: "Refreshed 36-40 rates via Tatum in ~2.5-3s"
- No pricing gaps thanks to cross-rate recovery

---

## 🟡 ANOMALY #7: Tatum 403 for TRX→BRL and TRX→GBP (RECURRING — P3)

### Status

Same as previous reports — mitigated by cross-rate recovery. No action needed.

---

## 🔵 ANOMALY #8: BTC Payment Auto-Recovery at Deployment Start (LOW — Resolved)

### Details

At deployment start (Mar 20 19:20), the watchdog detected **4 stuck BTC payments** (inherited from previous deployment):

```
[Watchdog] ⚠️ 4 payment(s) stuck in 'processing' for >10 min.
  IDs: d4be75d0-fc67-4f0e-be31-16f68da42e1e (x4)
```

Auto-recovery was attempted:
```
[Watchdog] 🔄 Auto-recovery attempt 2/3 for payment d4be75d0... (stuck 92 min, address: bc1q5d..., currency: BTC)
[Watchdog] Summary: 9 stuck, 3 recovery attempts (3 enqueued), 0 escalations
```

### Status

- These BTC stuck payments appear to have been resolved or dropped off by Mar 22
- The current stuck payments (Anomaly #2) are the new TRX-related ones

---

## System Health Summary

| Component | Status | Notes |
|-----------|--------|-------|
| **Deployment** | ✅ Stable | ~44 hours uptime, no crashes/restarts |
| **PostgreSQL** | ✅ Healthy | No connection errors |
| **Redis** | ✅ Healthy | Connected, locks working normally |
| **WebhookQueue (BullMQ)** | ⚠️ 2 DLQ | Worker running, but 2 failed jobs permanently in DLQ |
| **TRON/TRC-20 Payments** | ❌ **BROKEN** | Zero TRX gas balance — all USDT-TRC20 settlements will fail |
| **SmartGas System** | ❌ **BROKEN** | Cannot fund TRX gas due to depleted source wallet |
| **Other Crypto Payments** | ✅ Operational | BTC, ETH, etc. appear to be working (no errors in log window) |
| **Binance WebSocket** | ❌ Geo-blocked | Using REST API fallback (functional but degraded) |
| **Tatum Rate API** | ✅ Operational | 36-40 rates per cycle, cross-rate recovery working |
| **Address Pool Warming** | ✅ Operational | Pre-reserving for companies 4, 16, 28, 72, 77 |
| **Payment Watchdog** | ⚠️ Active | Detecting stuck payments but duplicate IDs in output |
| **Error Monitoring** | ✅ Active | Digest + critical alerts being emailed to moxxcompany@gmail.com |

---

## Previously Reported Issues — Status Update

| Issue | Report | Status | Notes |
|-------|--------|--------|-------|
| TRX SUN→TRX unit conversion bug | Mar 15 | ✅ **FIXED** | Not recurring |
| 2 stuck payments (69f71235, a7f60980) | Mar 20 | ✅ **Resolved** | No longer appearing in watchdog |
| Binance WebSocket geo-blocking | Mar 20 | ⚠️ **RECURRING** | Still blocked, REST fallback working |
| Tatum 403 for TRX→BRL/GBP | Mar 20 | ✅ **Mitigated** | Cross-rate recovery working |
| Unsigned webhook from unknown IP | Mar 20 | ❓ Unknown | Not observed in this window |
| WebPush disabled (no VAPID keys) | Mar 20 | ❌ Still disabled | Not configured |

---

## 🚨 Recommended Priority Actions

| # | Priority | Action | Effort |
|---|----------|--------|--------|
| 1 | **🔴 P0** | **Replenish TRX** in the gas funding hot wallet — deposit 100-500 TRX minimum | 5 min |
| 2 | **🔴 P0** | **Manually settle** payment `ef0b29e4...` — 80.01 USDT stuck at `TVzJHr4E...` | 15 min |
| 3 | **🔴 P0** | Investigate `receivedAmount: 3.07207` vs `userAmount: 135.06593` mismatch | 1-2 hrs |
| 4 | **🔴 P0** | Query DB for duplicate payment records of `ef0b29e4...` (appears 4x in watchdog) | 30 min |
| 5 | **🟡 P1** | Add TRX balance monitoring — alert when below 10 TRX threshold | 2 hrs |
| 6 | **🟡 P1** | Add pre-flight gas balance check before accepting TRON network payments | 3-4 hrs |
| 7 | **🟡 P1** | Retry/drain 2 DLQ jobs after TRX gas is replenished | 30 min |
| 8 | **🟡 P2** | Fix watchdog query to deduplicate payment IDs | 1 hr |
| 9 | **🟡 P2** | Add state check in recovery logic (prevent processing → processing transitions) | 2 hrs |
| 10 | **🟡 P2** | Fix Binance WebSocket proxy or add alternative price feed | 3-4 hrs |

---

## Payment Flow Reconstruction

```
Customer                    DynoPay                     TRON Network           Merchant
   │                           │                              │                    │
   │  POST /cryptoPayment      │                              │                    │
   │  (80 USDT-TRC20)          │                              │                    │
   │────────────────────────►   │                              │                    │
   │                           │  Assign pool address          │                    │
   │  ◄─ address: TVzJHr4E...  │  TVzJHr4E...                 │                    │
   │                           │                              │                    │
   │   Send 80.01 USDT-TRC20   │                              │                    │
   │ ──────────────────────────────────────────────────────►   │                    │
   │                           │                              │                    │
   │                           │  ◄── Tatum Webhook ─────────  │                    │
   │                           │  (80.01 USDT confirmed)       │                    │
   │                           │                              │                    │
   │                           │  SmartGas: Fund TRX gas       │                    │
   │                           │  ────────────────────────►    │                    │
   │                           │  ❌ FAILED: No TRX balance    │                    │
   │                           │                              │                    │
   │                           │  Transfer USDT-TRC20          │                    │
   │                           │  to merchant wallet           │                    │
   │                           │  ────────────────────────►    │                    │
   │                           │  ❌ FAILED: No gas for TRC-20 │                    │
   │                           │                              │                    │
   │                           │  x9 retries → ALL FAIL       │                    │
   │                           │                              │                    │
   │                           │  webhook: payment.failed ─────────────────────►   │
   │                           │                              │                    │
   │                           │  Job → DLQ                   │                    │
   │                           │                              │                    │
   ▼                           ▼                              ▼                    ▼
   
   RESULT: 80.01 USDT-TRC20 LOCKED in TVzJHr4E... — needs manual recovery
```

---

*Report generated 2026-03-22 from Railway GraphQL API (Project-Access-Token). Deployment 2de7d399 on api.dynopay.com.*
