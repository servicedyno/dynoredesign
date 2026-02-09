# DynoPay Deep Edge Case Analysis Report v2
**Generated: July 2025**

---

## METHODOLOGY
Systematic cross-referencing of every currency/chain across ALL config maps, switch/if-else blocks, SQL queries, and handler functions in the codebase. Source of truth: model definitions in `models/merchantPoolModels/index.ts`.

---

## MASTER CURRENCY CROSS-REFERENCE TABLE

### Source of Truth (from `models/merchantPoolModels/index.ts`):
- **UTXO_CHAINS:** BTC, LTC, DOGE, BCH
- **ACCOUNT_CHAINS:** ETH, TRX, SOL, XRP, POLYGON
- **TOKEN_CHAINS:** USDT-TRC20, USDT-ERC20, USDC-ERC20, RLUSD, USDT-POLYGON, RLUSD-ERC20
- **GAS_TOKEN_MAPPING:** USDT-TRC20→TRX, USDT-ERC20→ETH, USDC-ERC20→ETH, RLUSD→XRP, USDT-POLYGON→POLYGON, RLUSD-ERC20→ETH
- **CHAIN_XPUB_MAPPING:** ✅ Complete (all 15 currencies mapped)

### Cross-Reference Results:

| Config/Function | USDT-TRC20 | USDT-ERC20 | USDC-ERC20 | RLUSD | USDT-POLYGON | RLUSD-ERC20 |
|---|---|---|---|---|---|---|
| TOKEN_CHAINS (model) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| TOKEN_CHAINS (config fallback) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| TOKEN_CONTRACTS | ✅ | ✅ | ✅ | N/A* | ✅ | **❌ MISSING** |
| ADMIN_WALLETS | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FEE_WALLETS (gas) | TRX ✅ | ETH ✅ | ETH ✅ | XRP ✅ | POLYGON ✅ | ETH ✅ |
| GAS_TOKEN_MAPPING | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| CHAIN_XPUB_MAPPING | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DUST_THRESHOLDS (checkMissed) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| DUST_THRESHOLDS (orphan) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| getAddressBalance | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| assetToOtherAddress (single) | ✅ | ✅ | ✅ | ✅ | ✅ | **❌ UNREACHABLE** |
| assetBatchToOtherAddress | ✅ | ✅ | ❌** | N/A | N/A | ✅ |
| feeEstimation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| createSubscription | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| createSubscriptionWithUrl | ✅ | ✅ | ✅ | ✅ | ✅ | **❌ MISSING** |
| getIncomingTransactions | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| waitForTxConfirmation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| getTransactionGasCost | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| normalizeCurrency | ✅ | ✅ | ✅ | ✅ | ✅ | **❌ WRONG** |
| Sweep contractAddress lookup | ✅ | ✅ | ✅ | N/A | ✅ | **❌ MISSING** |
| sendingLeftover (gas recovery) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| MERCHANT_POOL_CRYPTO_TYPES | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| settleCryptoTransaction | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| blockchainFeeService chains | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| trustLine setup on creation | N/A | N/A | N/A | ✅ | N/A | ❌*** |

\* RLUSD on XRP uses XRP Ledger tokens, not ERC20 contracts
\** USDC-ERC20 not in `assetBatchToOtherAddress` conditions (only ETH, USDT-ERC20, RLUSD-ERC20)
\*** RLUSD-ERC20 doesn't need trust line (it's on Ethereum), but does it need ERC20 approval? (Probably not for receiving)

---

## 🔴 CRITICAL BUGS

### BUG 1: `assetToOtherAddress` — RLUSD-ERC20 Transfer Silently Fails
**File:** `apis/tatumApi.ts` line 1368
**Severity:** 🔴 CRITICAL — Payments break
```typescript
// Line 1368 — RLUSD-ERC20 is NOT in the outer condition:
} else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20") {
    // Lines 1377-1390 handle RLUSD-ERC20 inside here, but this block is UNREACHABLE
    if (currency === "RLUSD-ERC20") { ... }  // DEAD CODE
}
```
**Impact:** When a merchant settlement is triggered for RLUSD-ERC20, the `assetToOtherAddress` function falls through all if-else branches. `transaction` remains `undefined`. The function returns `undefined` instead of a txId. The settlement fails silently.
**Fix:** Add `|| currency === "RLUSD-ERC20"` to the outer condition on line 1368.

---

### BUG 2: `TOKEN_CONTRACTS` Missing RLUSD-ERC20 Contract Address
**File:** `services/merchantPool/merchantPoolConfig.ts` lines 82-87
```typescript
export const TOKEN_CONTRACTS: Record<string, string> = {
  "USDT-TRC20": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  "USDT-ERC20": "0xdac17f958d2ee523a2206206994597c13d831ec7",
  "USDC-ERC20": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "USDT-POLYGON": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  // ❌ MISSING: "RLUSD-ERC20": process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD"
};
```
**Impact:** Any code that looks up `TOKEN_CONTRACTS["RLUSD-ERC20"]` gets `undefined`. Currently `TOKEN_CONTRACTS` isn't directly used at runtime with bracket access (contract addresses are resolved via inline if-else), but this is a latent bug that will break if any code uses this map for RLUSD-ERC20.

---

### BUG 3: Sweep Fee Estimation Missing RLUSD-ERC20 Contract Address
**File:** `services/merchantPool/merchantPoolSweep.ts` lines 121-130
```typescript
if (walletType === 'USDT-ERC20') {
  contractAddress = process.env.ETH_CONTRACT;
} else if (walletType === 'USDC-ERC20') {
  contractAddress = process.env.USDC_CONTRACT;
} else if (walletType === 'USDT-TRC20') {
  contractAddress = process.env.TRX_CONTRACT;
} else if (walletType === 'USDT-POLYGON') {
  contractAddress = process.env.USDT_POLYGON_CONTRACT || "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
}
// ❌ MISSING: } else if (walletType === 'RLUSD-ERC20') {
//     contractAddress = process.env.RLUSD_ERC20_CONTRACT || "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD";
// }
```
**Impact:** When sweeping RLUSD-ERC20 admin fees, gas estimation is called without a contract address. This may cause incorrect gas estimation or failed fee estimation for ERC20 token transfers.

---

### BUG 4: `normalizeCurrency` Doesn't Handle RLUSD-ERC20
**File:** `helper/currencyConvert.ts` line 432-441
```typescript
const normalizeCurrency = (currency: string): string => {
  const upper = currency.toUpperCase();
  if (upper.includes("USDT")) return "USDT";
  if (upper.includes("USDC")) return "USDC";
  if (upper === "RLUSD") return "RLUSD";  // ← Only matches exact "RLUSD"
  // ❌ "RLUSD-ERC20" falls through to: return upper → returns "RLUSD-ERC20"
  return upper;
};
```
**Impact:** RLUSD-ERC20 doesn't get normalized to "RLUSD", so:
1. It's NOT treated as a stablecoin (not in `['USDT', 'USDC', 'RLUSD']` check)
2. No 1:1 USD shortcut applied
3. CoinGecko lookup for "RLUSD-ERC20" will fail (not in `COINGECKO_IDS` map)
4. Fee calculations involving USD conversion for RLUSD-ERC20 payments will error or use fallback rates

**Fix:** Change `if (upper === "RLUSD")` to `if (upper === "RLUSD" || upper === "RLUSD-ERC20")`

---

### BUG 5: `createSubscriptionWithUrl` Missing RLUSD-ERC20
**File:** `apis/tatumApi.ts` line 783
```typescript
const chain =
  currency === "USDT-ERC20" || currency === "USDC-ERC20"  // ❌ Missing RLUSD-ERC20
    ? "ETH"
    : currency === "USDT-TRC20" ? "TRON"
    : ...
```
**Impact:** If `createSubscriptionWithUrl` is called for RLUSD-ERC20, the chain resolves to "RLUSD-ERC20" (not a valid Tatum chain). Tatum subscription creation fails → no webhook notifications for RLUSD-ERC20 payments on company-specific pools.
**Note:** `createSubscription` (line 709) correctly includes RLUSD-ERC20.

---

## 🟡 MEDIUM SEVERITY GAPS

### GAP 6: `sendingLeftover` Only Handles USDT-ERC20 and USDT-TRC20
**File:** `controller/paymentController.ts` line 6021
```sql
WHERE ut.wallet_type in ('USDT-ERC20','USDT-TRC20')
```
**Impact:** Leftover gas (ETH/TRX/POLYGON) from USDC-ERC20, RLUSD-ERC20, RLUSD, and USDT-POLYGON transfers is never swept back. Gas funds remain stranded in temp addresses indefinitely.
**Fix:** Extend to `('USDT-ERC20','USDT-TRC20','USDC-ERC20','RLUSD-ERC20','USDT-POLYGON')`. Also fix the gas token mapping at line 6033 which only handles TRX vs ETH (needs POLYGON for USDT-POLYGON).

---

### GAP 7: `sendingLeftover` Gas Token Mapping Incomplete
**File:** `controller/paymentController.ts` line 6032-6033
```typescript
const wallet_type = currentAddress?.wallet_type === "USDT-TRC20" ? "TRX" : "ETH";
```
**Impact:** If USDT-POLYGON is added to the SQL query, its gas token would be incorrectly resolved as "ETH" instead of "POLYGON". The function would check ETH balance instead of POL balance, and attempt to transfer ETH instead of POL.

---

### GAP 8: `blockchainFeeService` Missing Newer Chains
**File:** `services/blockchainFeeService.ts` lines 65-74, 396
```typescript
const chainMap = { 'BTC', 'ETH', 'LTC', 'DOGE', 'USDT_ERC20', 'USDT_TRC20', 'TRX', 'BCH' };
const chains = ['BTC', 'ETH', 'LTC', 'DOGE', 'TRX', 'USDT_ERC20', 'USDT_TRC20'];
```
**Impact:** Missing SOL, XRP, POLYGON, USDT-POLYGON, RLUSD, RLUSD-ERC20, USDC-ERC20. The `/api/blockchain-fees` endpoint returns incomplete data. Any UI or logic that depends on this service for fee display won't have data for newer chains.

---

### GAP 9: Orphan Detection DUST_THRESHOLDS Missing Token Currencies
**File:** `services/merchantPool/merchantPoolMonitoring.ts` lines 813-816
```typescript
const DUST_THRESHOLDS: Record<string, number> = {
  BTC: 0.00005, ETH: 0.002, TRX: 20, LTC: 0.05,
  DOGE: 25, BCH: 0.01, BSC: 0.008,
  // ❌ Missing: SOL, XRP, POLYGON, USDT-TRC20, USDT-ERC20, USDC-ERC20, RLUSD, USDT-POLYGON, RLUSD-ERC20
};
```
**Impact:** For token chains, the fallback `dustThreshold = 0` means the `!TOKEN_CHAINS.includes(walletType) && balance < dustThreshold` check is bypassed (correct behavior—tokens use admin fee balance check instead). But for SOL, XRP, POLYGON (native currencies NOT in TOKEN_CHAINS), dustThreshold = 0 means ANY balance (even 0.000001) triggers orphan detection. This creates noise in orphan detection for small native chain residuals.

---

### GAP 10: `getTransactionGasCost` Missing RLUSD, USDT-POLYGON, POLYGON, XRP, SOL
**File:** `apis/tatumApi.ts` lines 2750-2782
Only handles ETH-family (ETH, USDT-ERC20, USDC-ERC20, RLUSD-ERC20) and TRX-family (TRX, USDT-TRC20).
**Impact:** Sweep operations for POLYGON, USDT-POLYGON, RLUSD, XRP, SOL will log "Unsupported currency" and use `gasCostNative: 0`. The sweep audit records will have inaccurate gas cost data.

---

### GAP 11: Webhook Source Authentication (unchanged from v1)
**File:** `routes/index.ts` lines 89-90
**Impact:** Public endpoints `/api/tatum-webhook` and `/api/tatum-crypto-webhook` have no Tatum signature verification.

---

### GAP 12: Cron Job Concurrency Guards Missing (unchanged from v1)
**File:** `server.ts` lines 155-256
**Impact:** Overlapping cron runs could double-process payments.

---

### GAP 13: UTXO Output Index Hardcoded to 0 (unchanged from v1)
**File:** `controller/paymentController.ts` line 3052

---

### GAP 14: Orphan Detection `receivedAmount` Uses Raw Balance (unchanged from v1)
**File:** `merchantPoolMonitoring.ts` line 914 — should use `balance - existingAdminBalance`.

---

### GAP 15: Lock Release Without Owner Verification (unchanged from v1)
**File:** `utils/redisInstance.ts` lines 188-192

---

## 🟢 LOW SEVERITY GAPS

### GAP 16: `TOKEN_CHAINS` Fallback in Config Is Incomplete
**File:** `services/merchantPool/merchantPoolConfig.ts` line 54
```typescript
export const TOKEN_CHAINS = MODEL_TOKEN_CHAINS || ["USDT-TRC20", "USDT-ERC20", "USDC-ERC20"];
```
**Impact:** If `MODEL_TOKEN_CHAINS` import fails (unlikely), the fallback misses RLUSD, USDT-POLYGON, RLUSD-ERC20. All sweep/gas logic for these tokens would be treated as native currencies.

---

### GAP 17: Energy Optimization Only for USDT-TRC20
**File:** `services/merchantPool/merchantPoolSweep.ts` line 85
```typescript
if (gasToken === "TRX" && (walletType === 'USDT-TRC20')) {
```
**Impact:** RLUSD uses XRP (not TRX), so this is correct—but if any future TRC20 token is added, it won't get Energy optimization. Minor, since USDT-TRC20 is currently the only TRC20 token.

---

### GAP 18: `assetBatchAddressesToOtherAddress` Missing USDC-ERC20
**File:** `apis/tatumApi.ts` line 1617
```typescript
} else if (currency === "ETH" || currency === "USDT-ERC20" || currency === "RLUSD-ERC20") {
// ❌ Missing USDC-ERC20
```
**Impact:** If batch sweep is ever triggered for USDC-ERC20 pool addresses, the transfer function won't match any branch. However, USDC-ERC20 batch sweeps may not currently be triggered (would need to trace full sweep orchestration to confirm).

---

### GAP 19: `debug/check_all_wallets.ts` Has Hardcoded Subset of Chains
**File:** `scripts/debug/check_all_wallets.ts` line 13
```typescript
wallet_type: ['BTC', 'ETH', 'TRX', 'LTC', 'DOGE', 'USDT-TRC20', 'USDT-ERC20']
```
**Impact:** Debug script won't check SOL, XRP, POLYGON, USDT-POLYGON, RLUSD, RLUSD-ERC20, USDC-ERC20, BCH. Minor (debug tool only).

---

## CONSOLIDATED ISSUE LIST (ALL 19 ISSUES)

---

### 🔴 CRITICAL (2 issues — payments break silently)

**ISSUE #1: `assetToOtherAddress` — RLUSD-ERC20 Transfer Silently Fails (DEAD CODE)**
- **File:** `apis/tatumApi.ts` line 1368
- **Bug:** Outer `else if` condition is `currency === "ETH" || currency === "USDT-ERC20" || currency === "USDC-ERC20"` — does NOT include `"RLUSD-ERC20"`. The RLUSD-ERC20 handling at line 1377 inside this block is unreachable dead code.
- **Impact:** Merchant settlements for RLUSD-ERC20 return `undefined`. Funds sit in pool address unsettled.
- **Fix:** Add `|| currency === "RLUSD-ERC20"` to line 1368.

**ISSUE #2: `normalizeCurrency` Doesn't Map RLUSD-ERC20 → RLUSD**
- **File:** `helper/currencyConvert.ts` line 437
- **Bug:** `if (upper === "RLUSD")` only matches exact "RLUSD". "RLUSD-ERC20" falls through → returns "RLUSD-ERC20" → not treated as stablecoin → CoinGecko lookup fails → USD conversion fails → fee calculation breaks.
- **Impact:** All fee calculations and currency conversions for RLUSD-ERC20 payments fail or produce wrong results.
- **Fix:** Change to `if (upper === "RLUSD" || upper === "RLUSD-ERC20") return "RLUSD";`

---

### 🔴 HIGH (1 issue — sweep operations break)

**ISSUE #3: Sweep Fee Estimation Missing RLUSD-ERC20 Contract Address**
- **File:** `services/merchantPool/merchantPoolSweep.ts` lines 121-130
- **Bug:** The if-else chain maps USDT-ERC20, USDC-ERC20, USDT-TRC20, USDT-POLYGON to their contract addresses but has no branch for RLUSD-ERC20.
- **Impact:** Gas estimation for RLUSD-ERC20 sweeps runs without a contract address → incorrect fee estimation → sweep may fail or be flagged as unprofitable.
- **Fix:** Add `else if (walletType === 'RLUSD-ERC20') { contractAddress = process.env.RLUSD_ERC20_CONTRACT; }`

---

### 🟡 MEDIUM (11 issues — partial failures, data gaps, security)

**ISSUE #4: `TOKEN_CONTRACTS` Config Map Missing RLUSD-ERC20**
- **File:** `services/merchantPool/merchantPoolConfig.ts` lines 82-87
- **Bug:** Map has USDT-TRC20, USDT-ERC20, USDC-ERC20, USDT-POLYGON but no RLUSD-ERC20 entry.
- **Impact:** Any code that uses `TOKEN_CONTRACTS["RLUSD-ERC20"]` gets `undefined`. Latent bug.
- **Fix:** Add `"RLUSD-ERC20": process.env.RLUSD_ERC20_CONTRACT || ""` to the map.

**ISSUE #5: `createSubscriptionWithUrl` Missing RLUSD-ERC20**
- **File:** `apis/tatumApi.ts` line 783
- **Bug:** Chain resolution condition `currency === "USDT-ERC20" || currency === "USDC-ERC20"` doesn't include RLUSD-ERC20. Chain resolves to "RLUSD-ERC20" (invalid Tatum chain) → subscription creation fails.
- **Impact:** No webhook notifications for RLUSD-ERC20 payments on company-specific pools.
- **Fix:** Add `|| currency === "RLUSD-ERC20"` to the ETH chain condition.

**ISSUE #6: `sendingLeftover` SQL Only Queries USDT-ERC20/USDT-TRC20**
- **File:** `controller/paymentController.ts` line 6021
- **Bug:** SQL `WHERE wallet_type in ('USDT-ERC20','USDT-TRC20')` misses USDC-ERC20, RLUSD-ERC20, USDT-POLYGON.
- **Impact:** Leftover gas (ETH/POLYGON) from those token transfers is never swept back — funds stranded indefinitely.
- **Fix:** Extend SQL to include all token types.

**ISSUE #7: `sendingLeftover` Gas Token Mapping Incomplete**
- **File:** `controller/paymentController.ts` line 6032-6033
- **Bug:** `wallet_type === "USDT-TRC20" ? "TRX" : "ETH"` — if USDT-POLYGON is added to the query, its gas token resolves as "ETH" instead of "POLYGON".
- **Impact:** Would check wrong native balance and attempt wrong chain transfer.
- **Fix:** Use `GAS_TOKEN_MAPPING[wallet_type]` lookup instead of binary TRX/ETH.

**ISSUE #8: `blockchainFeeService` Missing Newer Chains**
- **File:** `services/blockchainFeeService.ts` lines 65-74
- **Bug:** Only covers BTC, ETH, LTC, DOGE, TRX, USDT_ERC20, USDT_TRC20. Missing SOL, XRP, POLYGON, USDT-POLYGON, RLUSD, RLUSD-ERC20, USDC-ERC20, BCH.
- **Impact:** `/api/blockchain-fees` endpoint returns incomplete data for newer chains.

**ISSUE #9: Orphan Detection DUST_THRESHOLDS Missing Native Chains**
- **File:** `services/merchantPool/merchantPoolMonitoring.ts` lines 813-816
- **Bug:** Thresholds only defined for BTC, ETH, TRX, LTC, DOGE, BCH, BSC. Missing SOL, XRP, POLYGON.
- **Impact:** For SOL/XRP/POLYGON, `dustThreshold = 0` → any residual balance (even 0.000001) triggers orphan detection → noise and unnecessary processing.

**ISSUE #10: UTXO Output Index Hardcoded to 0**
- **File:** `controller/paymentController.ts` line 3052
- **Bug:** `fromUTXO: [{ txHash: transactionId, index: 0 }]` assumes payment is always at output index 0.
- **Impact:** If funding TX has multiple outputs (change output first), index 0 references wrong output → "insufficient funds" errors for BTC, LTC, DOGE, BCH settlements.
- **Fix:** Query UTXO set via Tatum API to find the correct output index for the address.

**ISSUE #11: Cron Jobs Have No Concurrency Guards**
- **File:** `server.ts` lines 155-256
- **Bug:** `processIncompletePayments` (15 min), `detectOrphanPayments` (10 min), `sweepAllAddresses` (1 min), `checkMissedPayments` have no mutex. If one run exceeds the interval, next cron fires while previous is still running.
- **Impact:** Duplicate processing of same payments → doubled settlements, double webhook deliveries.
- **Fix:** Add Redis-based `isRunning` lock at cron entry:
```typescript
const acquired = await acquireLock('cron:processIncomplete', 900);
if (!acquired) return;
try { /* body */ } finally { await releaseLock('cron:processIncomplete'); }
```

**ISSUE #12: Webhook Source Authentication Missing**
- **File:** `routes/index.ts` lines 89-90
- **Bug:** `/api/tatum-webhook` and `/api/tatum-crypto-webhook` endpoints are publicly accessible — no Tatum HMAC signature verification or IP allowlisting.
- **Impact:** Attacker can craft fake webhook payloads. Processing lock and on-chain balance checks provide secondary protection, but initial Redis writes still consume resources.
- **Fix:** Add Tatum `x-payload-hash` HMAC verification middleware.

---

### 🟢 LOW (5 issues — minor correctness, debug tooling)

**ISSUE #13: `getTransactionGasCost` Incomplete Chain Coverage**
- **File:** `apis/tatumApi.ts` lines 2750-2782
- **Bug:** Only handles ETH-family and TRX-family. POLYGON, USDT-POLYGON, RLUSD, XRP, SOL log "Unsupported" and return `gasCostNative: 0`.
- **Impact:** Inaccurate gas cost audit data for sweep operations on those chains.

**ISSUE #14: Orphan Detection `receivedAmount` Uses Raw Balance**
- **File:** `services/merchantPool/merchantPoolMonitoring.ts` line 914
- **Bug:** `receivedAmount: balance` should be `receivedAmount: balance - existingAdminBalance`.
- **Impact:** Recovered orphan payments may overpay merchant by the admin fee residual amount.

**ISSUE #15: Lock Release Without Owner Verification**
- **File:** `utils/redisInstance.ts` lines 188-192
- **Bug:** `releaseLock()` deletes key without verifying current process is the owner. If lock TTL expires and another process acquires it, the first process's `releaseLock()` deletes the second process's lock.
- **Impact:** Very low under normal conditions (operations complete within TTL). Fix: atomic compare-and-delete via Lua script.

**ISSUE #16: `assetBatchAddressesToOtherAddress` Missing USDC-ERC20**
- **File:** `apis/tatumApi.ts` line 1617
- **Bug:** Batch transfer condition `currency === "ETH" || currency === "USDT-ERC20" || currency === "RLUSD-ERC20"` doesn't include USDC-ERC20.
- **Impact:** If batch sweep is triggered for USDC-ERC20 pool addresses, transfer won't match any branch.

**ISSUE #17: `TOKEN_CHAINS` Config Fallback Incomplete**
- **File:** `services/merchantPool/merchantPoolConfig.ts` line 54
- **Bug:** Fallback `["USDT-TRC20", "USDT-ERC20", "USDC-ERC20"]` misses RLUSD, USDT-POLYGON, RLUSD-ERC20. Only triggers if model import fails.
- **Impact:** Unlikely but catastrophic if import fails — all sweep/gas logic for newer tokens breaks.

**ISSUE #18: `debug/check_all_wallets.ts` Hardcoded Subset**
- **File:** `scripts/debug/check_all_wallets.ts` line 13
- **Bug:** Only checks BTC, ETH, TRX, LTC, DOGE, USDT-TRC20, USDT-ERC20. Missing 8 chains.
- **Impact:** Debug tool only — won't catch issues on newer chains.

**ISSUE #19: Energy Optimization Scoped Only to USDT-TRC20**
- **File:** `services/merchantPool/merchantPoolSweep.ts` line 85
- **Bug:** Energy check gated to `walletType === 'USDT-TRC20'` only.
- **Impact:** Correct today (only TRC20 token), but won't auto-extend if future TRC20 tokens are added.

---

## PRIORITY FIX ORDER

| # | Issue | Severity | Fix Effort | Affected |
|---|-------|----------|------------|----------|
| 1 | #1 `assetToOtherAddress` unreachable RLUSD-ERC20 | 🔴 CRITICAL | 1 line | RLUSD-ERC20 |
| 2 | #2 `normalizeCurrency` wrong for RLUSD-ERC20 | 🔴 CRITICAL | 1 line | RLUSD-ERC20 |
| 3 | #3 Sweep fee estimation missing RLUSD-ERC20 | 🔴 HIGH | 3 lines | RLUSD-ERC20 |
| 4 | #4 TOKEN_CONTRACTS missing RLUSD-ERC20 | 🟡 MEDIUM | 1 line | RLUSD-ERC20 |
| 5 | #5 `createSubscriptionWithUrl` missing RLUSD-ERC20 | 🟡 MEDIUM | 1 line | RLUSD-ERC20 |
| 6 | #11 Cron job concurrency guards | 🟡 MEDIUM | ~20 lines | All chains |
| 7 | #10 UTXO index hardcoded to 0 | 🟡 MEDIUM | ~10 lines | BTC, LTC, DOGE, BCH |
| 8 | #12 Webhook source authentication | 🟡 MEDIUM | ~30 lines | All chains |
| 9 | #6 `sendingLeftover` incomplete SQL | 🟡 MEDIUM | 2 lines | USDC, RLUSD-ERC20, POLYGON |
| 10 | #7 `sendingLeftover` gas token mapping | 🟡 MEDIUM | 5 lines | USDT-POLYGON |
| 11 | #8 blockchainFeeService chains | 🟡 MEDIUM | 15 lines | SOL, XRP, POLYGON, etc. |
| 12 | #9 Orphan DUST_THRESHOLDS | 🟡 MEDIUM | 5 lines | SOL, XRP, POLYGON |
| 13 | #14 Orphan receivedAmount raw balance | 🟢 LOW | 1 line | Token chains |
| 14 | #15 Lock owner verification | 🟢 LOW | 5 lines | All chains |
| 15 | #13 `getTransactionGasCost` incomplete | 🟢 LOW | 10 lines | POLYGON, XRP, SOL |
| 16 | #16 Batch USDC-ERC20 missing | 🟢 LOW | 1 line | USDC-ERC20 |
| 17 | #17 TOKEN_CHAINS fallback | 🟢 LOW | 1 line | Newer tokens |
| 18 | #18 Debug script hardcoded chains | 🟢 LOW | 1 line | Debug only |
| 19 | #19 Energy optimization scope | 🟢 LOW | N/A | Future TRC20 |
