# DynoPay Edge Case Analysis Report
**Generated: July 2025**

---

## Summary

| Category | Covered | Gaps Found |
|----------|---------|------------|
| Duplicate Transaction Processing | ✅ Fully | 0 |
| Crash Recovery | ✅ Fully | 0 |
| Redis Data Loss / Eviction | ✅ Mostly | 1 minor |
| Underpayment Handling | ✅ Fully | 0 |
| Overpayment Handling | ✅ Fully | 0 |
| Race Conditions & Locking | ✅ Mostly | 2 minor |
| Sweep & Gas Funding | ✅ Mostly | 1 minor |
| Webhook Delivery | ✅ Mostly | 1 medium |
| Payment Link Expiry | ✅ Fully | 0 |
| Orphan / Missed Payment Recovery | ✅ Mostly | 1 minor |
| Fee Calculation Boundaries | ✅ Mostly | 1 minor |
| Multi-Tenant Security | ✅ Fully | 0 |
| UTXO Chain Handling | ⚠️ Partial | 1 medium |
| Cron Job Concurrency | ⚠️ Not Covered | 1 medium |
| Webhook Source Authentication | ⚠️ Not Covered | 1 medium |

**Overall: 16 edge case categories covered, 9 potential gaps identified (3 medium, 6 minor)**

---

## ✅ EDGE CASES FULLY COVERED

### 1. Duplicate Transaction Processing
**Files:** `webhooks/index.ts` (lines 485-498), `controller/paymentController.ts`
- `processed-tx-{txId}` Redis key with 48h TTL prevents same blockchain TX from being processed twice
- `processing-lock-{txId}` Redis key with 5-min TTL prevents race conditions on simultaneous webhooks
- `cryptoVerification` checks `customerTransactionModel` for existing successful/completed records
- Admin fee email dedup via `admin-fee-email-{txId}` key

### 2. Crash Recovery / Stale Processing
**Files:** `webhooks/index.ts` (lines 540-620)
- `isStaleProcessing` check: If payment stuck in "processing" for >1 minute with txId → auto-recovers
- Recovery tries `cryptoVerification` first → if that fails (on-chain already settled) → sends direct webhook
- Marks as "recovered" status to prevent infinite retry loops
- Clears processing lock before retry

### 3. Redis Data Loss Recovery
**Files:** `webhooks/index.ts` (lines 700+), `controller/paymentController.ts` (lines 6910-6968), `merchantPoolMonitoring.ts` (lines 900-935)
- `crypto-{address}` key stores webhook_url, callback_url, webhook_secret directly (not just via customer ref)
- Merge logic: if customerData from `customer-{ref}` is missing webhook fields, merges from `items`
- DB-based reconstruction: `last_payment_context` column stores full payment context before address release
- `processIncompletePayments` cron reconstructs Redis from DB context
- `detectOrphanPayments` cron reconstructs Redis from `last_payment_context`

### 4. Underpayment Handling
**Files:** `webhooks/index.ts` (lines 850-960)
- **Payment Links:** Waits for grace period (merchant-specific, 1-30 min), sets `is_partial_payment` flag
- **Direct API:** Processes immediately with received amount (no waiting)
- **Completion payments:** Tracks cumulative total (`previousAmount + newPayment`)
- `processIncompletePayments` cron handles grace period expiry

### 5. Overpayment Handling
**Files:** `webhooks/index.ts`
- Payment Links: Sets `overPayment` flag when overpayment >$5 in base currency
- Direct API: Never triggers overpayment logic — merchant receives full amount
- `isMinorUnderpayment` threshold accepts small shortfalls for payment links

### 6. Admin Fee Residual / False Positives
**Files:** `merchantPoolMonitoring.ts` (lines 560-580, 820-830)
- `effectiveBalance = balance - adminFeeBalance` calculation prevents false detections
- Dust threshold checks use effective balance, not raw on-chain balance
- Admin fee balance tracked per address in DB
- Token chain check: `balance <= existingAdminBalance * 1.01` → skip (not an orphan)

### 7. Payment Link Expiry
**Files:** `controller/paymentController.ts` (lines 486-516)
- `expires_at` field validated on every `getData` call
- Remaining seconds calculated for checkout UI countdown
- Expired links return proper 410 error with merchant contact message
- Separate crypto invoice expiry (15 min) vs payment link expiry

### 8. Multi-Tenant / Company Isolation
**Files:** `controller/paymentController.ts`, `merchantPoolReservation.ts`
- Company_id required in wallet/address lookups — prevents cross-company routing
- No fallback to remove company_id constraint (fails safely)
- Merchant pool addresses scoped by `owner_user_id`

### 9. Internal Transfer Filtering
**Files:** `webhooks/index.ts`
- `INTERNAL_WALLETS` set filters out sweep/gas funding/admin transactions
- Prevents infinite webhook loops from admin wallet outgoing transactions

### 10. Failed Payment Recovery
**Files:** `merchantPoolMonitoring.ts`
- `checkMissedPayments`: Detects `failed` status and retries with preserved context
- Clears `processed-tx-{txId}` before retry to allow reprocessing
- Logs detailed context for audit

---

## ⚠️ POTENTIAL GAPS IDENTIFIED

### GAP 1: Webhook Source Authentication (Medium)
**Location:** `routes/index.ts` lines 89-90
**Issue:** The `/tatum-webhook` and `/tatum-crypto-webhook` endpoints are publicly accessible without any source verification. There's no:
- IP allowlist for Tatum's webhook IPs
- HMAC signature verification from Tatum
- Secret token validation in headers

**Risk:** An attacker could craft fake webhook payloads to trigger fraudulent settlements.
**Mitigation in place:** Processing lock and `processed-tx` checks prevent duplicate processing, and `cryptoVerification` checks actual on-chain balance. But initial Redis writes and balance checks still consume resources.
**Recommendation:** Add Tatum's `x-payload-hash` signature verification or IP allowlisting.

---

### GAP 2: UTXO Output Index Hardcoded to 0 (Medium)
**Location:** `controller/paymentController.ts` line 3052
```typescript
fromUTXO: [{ txHash: transactionId, index: 0, ... }]
```
**Issue:** Assumes the payment output is always at index 0 in the funding transaction. If the funding TX has multiple outputs (e.g., change output first), index 0 may reference the wrong output.
**Risk:** Could cause "insufficient funds" errors for UTXO chains (BTC, LTC, DOGE, BCH).
**Recommendation:** Query the UTXO set for the address to find the correct output index, or use Tatum's UTXO API to identify the correct index.

---

### GAP 3: Cron Job Concurrency Guard Missing (Medium)
**Location:** `server.ts` lines 155-256, `controller/paymentController.ts` line 6478
**Issue:** `processIncompletePayments` runs every 15 minutes but has no mutex/guard against overlapping execution. If one run takes >15 minutes (e.g., many pool addresses to check), the next cron fires while previous is still running.
**Same applies to:** `detectOrphanPayments`, `checkMissedPayments`, `sweepAllAddresses`
**Risk:** Duplicate processing of the same payments, doubled settlements.
**Recommendation:** Add a Redis-based `isRunning` flag at the start of each cron, checked before execution:
```typescript
const lockKey = 'cron:processIncomplete';
const acquired = await acquireLock(lockKey, 900); // 15min TTL
if (!acquired) return;
try { /* cron body */ } finally { await releaseLock(lockKey); }
```

---

### GAP 4: Lock Release Without Owner Verification (Minor)
**Location:** `utils/redisInstance.ts` lines 188-192
**Issue:** `releaseLock()` deletes the key unconditionally without verifying the current process is the lock owner. If Process A's lock expires (TTL), Process B acquires the lock, then Process A completes and calls `releaseLock()` — it deletes Process B's lock.
**Risk:** Very low under normal conditions (operations complete well within TTL).
**Recommendation:** Store `lockValue` and use a Lua script for atomic compare-and-delete:
```lua
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
```

---

### GAP 5: Orphan Detection Uses Raw Balance Instead of Effective Balance (Minor)
**Location:** `merchantPoolMonitoring.ts` line 914
```typescript
receivedAmount: balance,  // Should be: balance - existingAdminBalance
```
**Issue:** When reconstructing Redis data for orphan payments, `receivedAmount` is set to the raw on-chain balance rather than `balance - adminFeeBalance`. The existing admin fee balance check at line 822 skips addresses where balance ≈ admin fee, but if there's a real orphan payment ON TOP of existing admin fees, the `receivedAmount` would be inflated.
**Risk:** Could result in overpaying the merchant by the admin fee amount on recovered orphan payments.
**Recommendation:** Use `balance - existingAdminBalance` as `receivedAmount` when admin fee balance is known.

---

### GAP 6: Gas Funding Success → Token Transfer Failure (Minor)
**Location:** `controller/paymentController.ts` (SmartGas flow)
**Issue:** If gas (TRX/ETH) is sent to a temp address for token transfer, but the subsequent token transfer fails, the gas remains stranded. No automatic recovery sweeps gas-only residuals from pool addresses.
**Risk:** Small gas amounts ($0.05-$0.50) lost per occurrence.
**Recommendation:** Add a gas recovery step in `sweepPoolAddress` that detects native currency balance in token-only addresses and sweeps it back.

---

### GAP 7: processIncompletePayments Grace Period Hardcoded (Minor)
**Location:** `controller/paymentController.ts` line 6876
```typescript
if (minutesSinceReserved < 60) {
  continue; // Hardcoded 60 min
}
```
**Issue:** Per-company grace period (1-30 min) is respected in the webhook flow but the fallback cron uses a hardcoded 60-minute threshold.
**Risk:** Payments could be delayed for up to 60 minutes even if merchant has a 5-minute grace period.
**Recommendation:** Look up the company's `grace_period_minutes` setting and use `max(gracePeriod + 30, 60)` as the threshold.

---

### GAP 8: Concurrent Payments to Same Pool Address (Minor)
**Location:** `webhooks/index.ts`
**Issue:** If two blockchain transactions arrive near-simultaneously for the same pool address:
- First TX processes normally (sets `txId` in Redis)
- Second TX: `processing-lock` prevents duplicate of same txId, but different txId → could start processing
- If both are completion payments for an underpayment, only the first gets associated properly
**Risk:** Second payment's funds could be stranded until orphan detection recovers them (10+ min delay).
**Recommendation:** Already mitigated by orphan detection. No urgent fix needed.

---

### GAP 9: No Circuit Breaker for Tatum API (Minor)
**Location:** `apis/tatumApi.ts`
**Issue:** No retry logic or circuit breaker for Tatum API calls (getBalance, createSubscription, etc.). If Tatum has an outage, every payment attempt will fail synchronously.
**Risk:** Cascading failures during Tatum downtime.
**Mitigation:** `processIncompletePayments` and `detectOrphanPayments` crons provide eventual recovery.
**Recommendation:** Add exponential backoff retries for critical Tatum calls (balance checks, transfers).

---

## WELL-DESIGNED PATTERNS WORTH NOTING

1. **Three-layer payment recovery:** Webhook → checkMissedPayments → detectOrphanPayments
2. **DB-backed Redis reconstruction:** `last_payment_context` column is a strong safety net
3. **Distributed locking:** Redis SET NX with TTL for address reservation
4. **Admin fee residual filtering:** Prevents false orphan detections from admin fee dust
5. **Cascading webhook URL resolution:** payment data → payment link → company → API key
6. **Profitability-gated sweep:** Won't sweep if costs exceed 50% of balance
7. **Dual underpayment strategy:** Grace period for payment links, immediate processing for direct API

---

## PRIORITY RECOMMENDATIONS

| Priority | Gap | Effort | Impact |
|----------|-----|--------|--------|
| 🔴 HIGH | #1 Webhook source auth | Medium | Security |
| 🟡 MEDIUM | #3 Cron concurrency guard | Low | Data integrity |
| 🟡 MEDIUM | #2 UTXO index hardcoding | Medium | UTXO chain reliability |
| 🟢 LOW | #4 Lock owner verification | Low | Correctness |
| 🟢 LOW | #5 Orphan effective balance | Low | Fee accuracy |
| 🟢 LOW | #6 Gas recovery | Low | Cost savings |
| 🟢 LOW | #7 Grace period per-merchant | Low | UX |
| 🟢 LOW | #9 Tatum circuit breaker | Medium | Resilience |
| ⚪ INFO | #8 Concurrent same-address | N/A | Already mitigated |
