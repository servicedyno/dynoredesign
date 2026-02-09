# On-Chain Fee Optimization Analysis
## BCH, SOL, XRP, POLYGON, RLUSD, USDT-POLYGON, RLUSD-ERC20
**Generated: July 2025**

---

## CHAIN-BY-CHAIN ANALYSIS

---

### 1. BCH (Bitcoin Cash)

**Fee Estimation (`feeEstimation`):** ✅ Uses live `estimatefee` RPC via Tatum node
```
bytes = (inputs * 148 + 2 * 34 + 10) / 1000
fee = bytes × estimatefee_result
```
**Transfer (`assetToOtherAddress`):** ✅ Uses `bchTransferBlockchain`
**Settlement:** ✅ UTXO path — single TX with merchant + admin outputs  
**Sweep:** ✅ UTXO chain — no gas funding needed, direct sweep
**UTXO Index:** ✅ Now uses `findUtxoOutputIndex` (fixed in edge case review)

**🔴 ISSUE: Fee calculation uses `bchInputs` default of 1**
- `bchInputs` parameter defaults to 1 in both `feeEstimation` and `batchFeeEstimation`
- If BCH UTXO is split across multiple inputs (e.g., received in 2 TXs), byte count is underestimated
- `(1 * 148 + 2 * 34 + 10) / 1000 = 0.226 KB` vs `(2 * 148 + 2 * 34 + 10) / 1000 = 0.374 KB` — **65% underestimate**
- **Impact:** Transaction may be stuck in mempool with insufficient fee
- **Fix:** Query UTXO count for the address before fee estimation

**🟡 ISSUE: BCH `changeAddress` logic for settlement**
- Settlement uses `toUTXO` path (merchant + admin split) → `changeAddress: fromAddress`
- But if the full UTXO value matches merchant + admin + fee exactly, no change needed
- If there's any rounding mismatch, a tiny change output is created → **dust output waste**
- **Impact:** Minor (extra bytes, marginally higher fee)

**OPTIMIZATION POTENTIAL:** Low — BCH fees are already negligible (~$0.001/tx)

---

### 2. SOL (Solana)

**Fee Estimation (`feeEstimation`):** ⚠️ **HARDCODED**
```typescript
fees = { fast: 0.00001, medium: 0.000005, slow: 0.000005 };
```
- Solana base fee is 5000 lamports (0.000005 SOL) per signature
- The "fast" tier at 0.00001 SOL (10k lamports) provides a 2x buffer
- **This is fine for regular transfers** — Solana doesn't have a gas price market like EVM

**Transfer (`assetToOtherAddress`):** ✅ Uses `solanaBlockchainTransfer`
**Settlement:** ✅ Account chain path — merchant gets full amount, gas from admin portion
**SmartGas:** ❌ **NO GAS FUNDING FOR SOL**
- `GAS_TOKEN_MAPPING` maps no token to SOL (SOL is only a native chain, no tokens)
- `FEE_WALLETS` has no SOL entry
- `fundGasIfNeeded` returns `{ funded: false, reason: 'No gas token mapping' }`
- **This is correct** — SOL is native, gas comes from the balance itself
- But if SOL admin fee balance is too small to cover gas, sweep will fail

**Sweep:** ✅ Account chain path — deducts gas from balance
**Profitability check:** ✅ `convertToUSD` handles SOL

**🔴 ISSUE: No SOL admin fee wallet in `tbl_admin_fee_wallet`**
- `FEE_WALLETS` config reads from env vars, but there's no SOL fee wallet in DB
- SmartGas won't fail (returns early — SOL is native), but if SOL token transfers are ever added, this becomes critical
- **Impact:** None currently (SOL has no token derivatives in the system)

**🟡 ISSUE: SOL `feeEstimation` doesn't account for priority fees**
- During network congestion, Solana uses priority fees (compute unit price)
- Hardcoded 0.00001 SOL doesn't adapt to congestion
- Solana priority fees can spike to 0.001+ SOL during high-demand periods (NFT mints, etc.)
- **Impact:** Medium — transactions could be delayed during congestion
- **Fix:** Use Solana `getRecentPrioritizationFees` RPC to get dynamic priority fee

**OPTIMIZATION POTENTIAL:** Medium — dynamic priority fees could save during low activity, prevent delays during high activity

---

### 3. XRP (XRP Ledger)

**Fee Estimation (`feeEstimation`):** ⚠️ **HARDCODED**
```typescript
fees = { fast: 0.00005, medium: 0.000012, slow: 0.000012 };
```
- XRP base fee is 10-12 drops (0.00001-0.000012 XRP)
- "Fast" at 50 drops (0.00005 XRP) provides ~4x buffer
- **This is reasonable** — XRP fees are extremely stable

**Transfer (`assetToOtherAddress`):** ✅ Uses `xrpTransferBlockchain`
**Settlement:** ✅ Account chain path
**SmartGas:** N/A (native chain, gas from balance)
**Sweep:** ✅ Account chain path — deducts gas from balance

**🔴 ISSUE: XRP 10 XRP Reserve Not Accounted For**
- New XRP addresses require a 10 XRP reserve (activated on first funded transaction)
- If a pool address receives exactly the expected payment amount, and the admin fee sweep tries to empty the account, it will fail because the 10 XRP reserve can't be withdrawn
- `sweepPoolAddress` deducts gas fee but NOT the reserve: `amountToSend = actualBalance - gasFee`
- The Tatum API will reject the transfer with "insufficient balance" 
- **Impact:** HIGH — admin fee sweep will always fail for XRP unless balance > 10 XRP + fee
- **Fix:** For XRP sweeps, account for the 10 XRP reserve:
```typescript
if (walletType === 'XRP') {
  const XRP_RESERVE = 10;
  amountToSend = actualBalance - gasFee - XRP_RESERVE;
}
```
- Alternatively, use the `deleteAccountTransaction` feature to recover the reserve when fully closing the address

**🟡 ISSUE: XRP fee estimation ignores queue-based fees**
- During ledger congestion, XRP fees can increase (open ledger fee escalation)
- The hardcoded 50 drops may be insufficient during severe congestion
- **Impact:** Low — XRP congestion is very rare
- **Fix:** Use `server_state` RPC to get current open ledger fee

**OPTIMIZATION POTENTIAL:** High for reserve handling — currently blocking all XRP sweeps under 10 XRP

---

### 4. POLYGON (Native POL)

**Fee Estimation (`feeEstimation`):** ✅ **DYNAMIC** via Tatum
```typescript
gasFees = await tatumSdk.fee.estimateFeeBlockchain({ chain: "MATIC", type: "TRANSFER_ERC20", ... });
gasPrice = Math.max(1, Math.min(100, Math.ceil(gasFees?.gasPrice || 30)));
gas_fee_for_amount = Math.ceil(gasPrice * 1.15 + 0.5);
```
- Uses same EVM pattern as ETH with 15% buffer + 0.5 Gwei tip
- Gas price capped at 100 Gwei (vs ETH's 30 Gwei cap)
- Fallback: `{ fast: 0.001, gasPrice: 30, gasLimit: 21000 }`

**Transfer (`assetToOtherAddress`):** ✅ Uses `polygonBlockchainTransfer`
**Settlement:** ✅ Account chain path
**SmartGas:** N/A (native chain, gas from balance)
**Sweep:** ✅ Account chain path

**🟡 ISSUE: Polygon uses `type: "TRANSFER_ERC20"` even for native POL transfers**
- In `feeEstimation`, when `currency === "POLYGON"` (native), the fee estimation uses `TRANSFER_ERC20` type
- For native POL transfers, should use `"TRANSFER_NFT"` (which is what ETH uses for native transfers)
- `TRANSFER_ERC20` will estimate higher gas limit (65k vs 21k) → **3x overestimate for native transfers**
- The `gasLimit` is corrected later (`isToken ? gasFees.gasLimit : Math.floor((gasFees?.gasLimit * 25) / 100)`), but the gas price estimation context is wrong
- **Impact:** Medium — customers pay ~3x higher blockchain fee than necessary for native POL payments
- **Fix:** Use `type: isToken ? "TRANSFER_ERC20" : "TRANSFER_NFT"` in the Polygon fee estimation block

**🟡 ISSUE: Polygon gas price floor of 30 Gwei in fallback is too high**
- Polygon gas is typically 25-50 Gwei, but can drop to 1-5 Gwei during low activity
- The fallback hardcodes 30 Gwei which is already in the mid-range
- **Impact:** Low (fallback only used when Tatum API fails)

**OPTIMIZATION POTENTIAL:** Medium — fixing native vs token fee type saves ~66% on native POL transfers

---

### 5. RLUSD (XRP Ledger Token)

**Fee Estimation (`feeEstimation`):** ⚠️ **HARDCODED**
```typescript
fees = { fast: 0.00005 }; // Only 'fast' tier
```
- RLUSD transfers on XRP Ledger cost same as XRP transfers (~12 drops)
- Missing `medium` and `slow` tiers (only `fast`)
- **Impact:** Settlement uses `fees?.fast` which exists, so this works. But sweep uses `fees?.slow || fees?.fast` — falls through to `fast` anyway.

**Transfer (`assetToOtherAddress`):** ✅ Uses `xrpTransferBlockchain` with `issuerAccount` and `token`
**Settlement:** ✅ Token path — SmartGas funds XRP for gas, then token transfer
**SmartGas:** ✅ XRP funded from `FEE_WALLETS.XRP` → `tbl_admin_fee_wallet` (XRP entry exists)

**🔴 ISSUE: Same XRP 10 XRP Reserve Problem**
- RLUSD pool addresses need XRP for gas (funded by SmartGas)
- SmartGas funds the XRP gas amount, but the recipient address needs 10 XRP reserve first
- If the pool address has never received XRP before, SmartGas needs to fund AT LEAST 10 XRP + gas
- Current code: `fundAmount = Math.max(deficit, requiredGas, XRP_MIN_DEFICIT)` where `XRP_MIN_DEFICIT = 1`
- **1 XRP is far below the 10 XRP reserve requirement!**
- The gas funding transfer itself will fail because the address doesn't have 10 XRP reserve
- **Impact:** CRITICAL — ALL RLUSD payments will fail on the gas funding step for new pool addresses
- **Fix:** Set `XRP_MIN_DEFICIT` to at least 11 (10 reserve + 1 for operations), and add reserve awareness:
```typescript
if (gasToken === "XRP" && currentBalance < 10) {
  fundAmount = Math.max(fundAmount, 11); // Cover 10 XRP reserve + gas
}
```

**🟡 ISSUE: RLUSD Trust Line Required Before Receiving**
- RLUSD tokens on XRP Ledger require a trust line to the issuer before the address can receive tokens
- `setupXrpTrustLine` function exists in `tatumApi.ts` — but is it called during pool address creation?
- If trust line isn't set up, the RLUSD payment will bounce at the blockchain level
- Need to verify trust line setup in the wallet creation flow

**OPTIMIZATION POTENTIAL:** Critical — must fix reserve and trust line issues before RLUSD can work

---

### 6. USDT-POLYGON (ERC-20 on Polygon)

**Fee Estimation (`feeEstimation`):** ✅ **DYNAMIC** via Tatum
```typescript
gasFees = await tatumSdk.fee.estimateFeeBlockchain({ chain: "MATIC", type: "TRANSFER_ERC20", ... });
```
- Correctly uses `TRANSFER_ERC20` type with USDT Polygon contract address
- 15% buffer + 0.5 Gwei priority tip (same as ETH)
- Fallback: `{ fast: 0.01, gasPrice: 30, gasLimit: 65000 }`

**Transfer (`assetToOtherAddress`):** ✅ Uses `polygonBlockchainSmartContractInvocation` with manual ABI encoding
**Settlement:** ✅ Token path — SmartGas funds POL, then USDT-POLYGON transfer
**SmartGas:** ✅ POLYGON funded from `FEE_WALLETS.POLYGON` → `tbl_admin_fee_wallet` (POLYGON entry exists)

**🟡 ISSUE: `polygonBlockchainSmartContractInvocation` is expensive**
- Using raw smart contract invocation (`transfer(address,uint256)`) instead of a dedicated token transfer method
- This requires more gas than a standard ERC-20 transfer function
- Tatum v3 may have a dedicated Polygon ERC-20 transfer method (like `polygonBlockchainTransferErc20`)
- **Impact:** Medium — ~10-20% higher gas than necessary
- **Fix:** Investigate if Tatum SDK has `polygonBlockchainTransferErc20` or `erc20Transfer` with `chain: "MATIC"`

**🟡 ISSUE: Fallback gas price 30 Gwei on Polygon is mid-range**
- Same issue as native POLYGON

**OPTIMIZATION POTENTIAL:** Medium — dedicated ERC-20 transfer method could save 10-20% gas

---

### 7. RLUSD-ERC20 (ERC-20 on Ethereum)

**Fee Estimation (`feeEstimation`):** ✅ **DYNAMIC** via Tatum
```typescript
gasFees = await tatumSdk.fee.estimateFeeBlockchain({ chain: "ETH", type: "TRANSFER_ERC20", ... });
```
- Uses RLUSD-ERC20 contract address from env
- Same ETH EVM pattern: 15% buffer + 0.5 Gwei, capped at 30 Gwei
- Correctly identified as ERC20 token (6 decimals)

**Transfer (`assetToOtherAddress`):** ✅ Uses `erc20Transfer` (generic ERC-20, not Tatum predefined)
- This is correct since RLUSD isn't in Tatum's predefined token list
- Uses `digits: 6` for 6 decimal places

**Settlement:** ✅ Token path — SmartGas funds ETH, then ERC-20 transfer
**SmartGas:** ✅ ETH funded from `FEE_WALLETS.ETH` → `tbl_admin_fee_wallet` (ETH entry exists)
**Sweep:** ✅ Token path with gas funding + contract address

**🟡 ISSUE: `erc20Transfer` may have different gas profile than `ethBlockchainTransfer`**
- USDT-ERC20 and USDC-ERC20 use `ethBlockchainTransfer` with `currency: "USDT"/"USDC"` (Tatum predefined)
- RLUSD-ERC20 uses `fungibleToken.erc20Transfer` (generic path)
- The generic path may use a different gas estimation model internally
- Fee estimation uses `TRANSFER_ERC20` type which is calibrated for Tatum predefined tokens
- If the generic transfer uses more gas (e.g., additional proxy contract calls), the estimated gas could be insufficient
- **Impact:** Low-Medium — depends on RLUSD contract implementation
- **Fix:** After first live transaction, compare estimated vs actual gas and add buffer if needed

**✅ GOOD: Shares ETH gas infrastructure**
- Uses the existing ETH fee wallet for gas funding
- Uses the same EVM gas estimation pipeline
- No additional infrastructure needed

**OPTIMIZATION POTENTIAL:** Low — already optimized via ETH EVM pipeline

---

## CROSS-CUTTING ISSUES

### ISSUE A: No Dynamic Fee Caching
**Affects:** All 7 chains
- Every payment triggers a fresh Tatum API call for fee estimation
- For high-volume scenarios, this creates latency and Tatum API quota usage
- **Fix:** Cache fee estimates in Redis with chain-specific TTLs:
  - UTXO (BCH): 60s (block time ~10 min)
  - EVM (POLYGON, RLUSD-ERC20): 12s (block time)
  - SOL: 0.4s (too fast for caching, skip)
  - XRP/RLUSD: Not needed (hardcoded)

### ISSUE B: No Fee Payer Optimization for Token Chains  
**Affects:** USDT-POLYGON, RLUSD-ERC20, RLUSD
- Token chains have gas funding overhead (SmartGas sends native currency first)
- But the gas funding amount isn't optimized for the actual transfer
- SmartGas funds `requiredGas × 1.3 (safety buffer)` — the residual gas is never recovered
- Over time, pool addresses accumulate small native currency balances
- **Fix:** After token sweep completes, add a native currency sweep step to recover residual gas

### ISSUE C: Sweep Profitability Threshold Too Aggressive for Cheap Chains
**Affects:** SOL, XRP, POLYGON
- Profitability threshold is 50% (`feeUSD < balanceUSD * 0.5`)
- For SOL ($0.001 fee) and XRP ($0.0001 fee), even $0.01 admin fees are profitable
- But the same threshold means a $0.50 admin fee on BCH ($0.001 fee) is also swept immediately
- **Not really an issue** — cheap fees mean everything is profitable
- **Could optimize:** For negligible-fee chains, sweep immediately without profitability check

---

## SUMMARY: PRIORITY FIXES

| # | Issue | Chain | Severity | Impact | Fix Effort |
|---|-------|-------|----------|--------|------------|
| 1 | **XRP 10 XRP reserve not accounted in sweep** | XRP | 🔴 CRITICAL | Sweep always fails <10 XRP | Low |
| 2 | **RLUSD SmartGas: XRP reserve already funded (13 XRP at creation)** | RLUSD | ✅ COVERED | Trust line + reserve handled in wallet creation | N/A |
| 3 | **RLUSD trust line setup** | RLUSD | ✅ COVERED | Set up during wallet creation (`merchantPoolWallet.ts:230`) | N/A |
| 4 | **POLYGON native uses TRANSFER_ERC20 (3x gas overestimate)** | POLYGON | 🟡 MEDIUM | Customers overpay ~66% on native POL | Low |
| 5 | **BCH `bchInputs` defaults to 1 (underestimates multi-UTXO)** | BCH | 🟡 MEDIUM | TX stuck in mempool | Medium |
| 6 | **SOL no dynamic priority fees** | SOL | 🟡 MEDIUM | Delayed during congestion | Medium |
| 7 | **USDT-POLYGON uses raw contract invocation** | USDT-POLYGON | 🟢 LOW | ~10-20% extra gas | Medium |
| 8 | **Fee caching for high-volume** | All | 🟢 LOW | Latency + API quota | Medium |
| 9 | **Residual gas recovery after token sweep** | Token chains | 🟢 LOW | Small amounts stranded | Low |
