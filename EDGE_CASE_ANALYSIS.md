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

## PRIORITY FIX ORDER

| # | Bug/Gap | Severity | Fix Effort | Affected Currency |
|---|---------|----------|------------|-------------------|
| 1 | BUG 1: `assetToOtherAddress` unreachable RLUSD-ERC20 | 🔴 CRITICAL | 1 line | RLUSD-ERC20 |
| 2 | BUG 4: `normalizeCurrency` wrong for RLUSD-ERC20 | 🔴 CRITICAL | 1 line | RLUSD-ERC20 |
| 3 | BUG 3: Sweep fee estimation missing RLUSD-ERC20 | 🔴 HIGH | 3 lines | RLUSD-ERC20 |
| 4 | BUG 2: TOKEN_CONTRACTS missing RLUSD-ERC20 | 🟡 MEDIUM | 1 line | RLUSD-ERC20 |
| 5 | BUG 5: `createSubscriptionWithUrl` missing RLUSD-ERC20 | 🟡 MEDIUM | 1 line | RLUSD-ERC20 |
| 6 | GAP 6: `sendingLeftover` incomplete SQL | 🟡 MEDIUM | 2 lines | USDC, RLUSD-ERC20, POLYGON |
| 7 | GAP 7: `sendingLeftover` gas token mapping | 🟡 MEDIUM | 5 lines | USDT-POLYGON |
| 8 | GAP 8: blockchainFeeService chains | 🟡 MEDIUM | 15 lines | SOL, XRP, POLYGON, etc. |
| 9 | GAP 9: Orphan DUST_THRESHOLDS | 🟡 MEDIUM | 5 lines | SOL, XRP, POLYGON |
| 10 | GAP 10: `getTransactionGasCost` incomplete | 🟢 LOW | 10 lines | POLYGON, XRP, SOL, RLUSD |
| 11 | GAP 11: Webhook auth | 🟡 MEDIUM | ~30 lines | All chains |
| 12 | GAP 12: Cron concurrency | 🟡 MEDIUM | ~20 lines | All chains |
| 13 | GAP 13: UTXO index hardcoded | 🟡 MEDIUM | ~10 lines | BTC, LTC, DOGE, BCH |
| 14 | GAP 14: Orphan receivedAmount | 🟢 LOW | 1 line | Token chains |
| 15 | GAP 18: Batch USDC-ERC20 | 🟢 LOW | 1 line | USDC-ERC20 |
