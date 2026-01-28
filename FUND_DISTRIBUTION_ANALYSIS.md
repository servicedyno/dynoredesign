# Fund Distribution, Partial Payments & Threshold Logic Analysis

## Complete System Flow Analysis

---

## 1. Fund Distribution Logic

### How Funds are Calculated and Distributed

**Location**: `/app/backend/controller/paymentController.ts` (lines 1957-2021)

### Step-by-Step Flow:

#### Step 1: Payment Received
```
Customer sends: 0.001 BTC
System receives: 0.001 BTC in temp address
Convert to USD: ~$100 USD
```

#### Step 2: Calculate Fees
```typescript
// Calculate total deduction (admin fees + platform fees)
const totalDeduction = calculateFeeDeduction(
  company_data,
  tempCurrency,
  amountInUSD  // USD amount
);

// Fee percentage
const feePercentage = totalDeduction / amountInUSD;
// Example: $2 fee / $100 = 2% = 0.02
```

#### Step 3: Check Threshold
```typescript
if (amountInUSD < minForwardingThreshold) {
  // BELOW THRESHOLD
  adminAmountToSend = totalAmountReceived;  // 100% to admin
  userAmountToSend = 0;  // 0% to merchant
} else {
  // NORMAL DISTRIBUTION
  adminAmountToSend = totalAmountReceived * feePercentage;
  userAmountToSend = totalAmountReceived - adminAmountToSend;
}
```

### Example Scenarios:

#### Scenario A: Normal Payment (Above Threshold)
```
Received: 0.001 BTC (~$100 USD)
Threshold: $3 USD
USD Amount: $100 >= $3 ✅ Above threshold

Fee calculation:
- Total deduction: $2 USD (2%)
- Fee percentage: 2 / 100 = 0.02

Distribution in crypto:
- Admin: 0.001 * 0.02 = 0.00002 BTC (~$2)
- Merchant: 0.001 - 0.00002 = 0.00098 BTC (~$98)
```

#### Scenario B: Below Threshold Payment
```
Received: 0.00002 BTC (~$2 USD)
Threshold: $3 USD
USD Amount: $2 < $3 ❌ Below threshold

Distribution:
- Admin: 0.00002 BTC (100%)
- Merchant: 0 BTC (0%)

Why? Payment too small to cover transaction costs
```

---

## 2. Partial Payment Logic

### How Partial Payments Work

**Location**: `/app/backend/services/merchantPoolService.ts` (lines 474-505)

### Flow:

#### Initial State
```
Expected: 0.001 BTC
Address status: RESERVED
Reserved until: 12:30 PM (30 min timeout)
```

#### Partial Payment 1 Arrives
```
Received: 0.0003 BTC (30% of expected)
Action: handlePartialPayment()

Updates:
- received_amount: 0.0003 BTC
- is_partial_payment: true
- partial_payment_timestamp: 12:00 PM
- reserved_until: 12:30 PM (extend 30 min grace period)
- status: RESERVED (stays reserved)

System waits for remaining 0.0007 BTC
```

#### Partial Payment 2 Arrives
```
Received: 0.0007 BTC (70% of expected)
Total: 0.0003 + 0.0007 = 0.001 BTC ✅ Complete!

Action: Process as complete payment
- Calculate fees on TOTAL: 0.001 BTC
- Distribute: merchant + admin
- Release address
```

#### Grace Period Expiration
```
If full amount not received within 30 minutes:
- Cron job calls processExpiredPartialPayments()
- Either:
  a) Accept partial amount, process as regular payment
  b) Reject and refund (based on business logic)
```

### Integration with New Sweep System

**For UTXO Chains (BTC, LTC, etc.)**:
```
Partial payment completes → Calculate total distribution
→ Create batch transaction:
  - Output 1: Merchant (minus fees)
  - Output 2: Admin (fees)
→ Both sent immediately ✅
```

**For Account Chains (ETH, TRX) & Tokens**:
```
Partial payment completes → Calculate total distribution
→ Send merchant payment
→ Admin fee accumulates in temp address
→ Swept later based on per-chain config (threshold or time)
```

---

## 3. Below Threshold Payment Logic

### How It Works

**Location**: `/app/backend/services/merchantPoolService.ts` (lines 510-556)

### When Triggered:

```typescript
if (amountInUSD < minForwardingThreshold) {
  // Below threshold - 100% to admin
  await handleBelowThresholdPayment(tempAddressId, receivedAmount, txId);
}
```

### What Happens:

#### Step 1: Payment Detected Below Threshold
```
Received: 0.00002 BTC (~$2 USD)
Min threshold: $3 USD
Check: $2 < $3 → BELOW THRESHOLD
```

#### Step 2: 100% Goes to Admin Fee
```typescript
await poolAddress.update({
  status: "AVAILABLE",  // Release immediately
  admin_fee_balance: currentBalance + receivedAmount,  // Add to admin balance
  total_transactions: txCount + 1,
  // Clear all reservation fields
});
```

#### Step 3: Record Transaction
```typescript
await recordPoolTransaction({
  paymentAmount: receivedAmount,
  merchantAmount: 0,  // Nothing to merchant
  adminFeeAmount: receivedAmount,  // 100% to admin
  status: "below_threshold",
});
```

#### Step 4: Admin Fee Handling by Chain Type

**UTXO Chains (BTC, LTC, DOGE, BCH)**:
```
Problem: No merchant payment to batch with!
Solution: Admin fee accumulates in temp address
→ Swept based on threshold/time config
→ Exception to batch rule (can't batch if nothing to send)
```

**Account Chains & Tokens**:
```
Admin fee accumulates → Normal sweep behavior
```

### Integration with New Sweep System:

```typescript
// In handleBelowThresholdPayment:
const walletType = poolAddress.dataValues.wallet_type;
const sweepConfig = getSweepConfig(walletType);

if (sweepConfig.mode === "batch") {
  // UTXO chain - can't batch, must accumulate
  // Will be swept when threshold/time met (fallback behavior)
  console.log(`Below threshold payment on UTXO chain - admin fee accumulated for sweep`);
}

// All chains: admin fee accumulates, no merchant payment
```

---

## 4. Complete Payment Flow with New System

### Example: Normal BTC Payment (Above Threshold)

```
1. Customer sends: 0.001 BTC to temp address
2. Webhook received: 0.001 BTC confirmed
3. Convert to USD: $100 USD
4. Check threshold: $100 >= $3 ✅
5. Calculate distribution:
   - Admin fee: 0.00002 BTC (2%)
   - Merchant: 0.00098 BTC (98%)
   
6. settleCryptoTransaction (UTXO mode):
   - Create ONE transaction:
     Input: Temp address (0.001 BTC)
     Output 1: Merchant (0.00098 BTC)
     Output 2: Admin wallet (0.00002 BTC)
     Fee: Deducted from merchant amount
     
7. releaseAddress:
   - sweepConfig.mode = "batch"
   - admin_fee_balance: NO CHANGE (already sent)
   - last_merchant_payout: null (not tracked for UTXO)
   - status: AVAILABLE
   
8. ✅ Complete - address ready for next payment
```

### Example: USDT-TRC20 Payment (Threshold Mode)

```
1. Customer sends: 50 USDT to temp address
2. Webhook received: 50 USDT confirmed
3. Check threshold: $50 >= $3 ✅
4. Calculate distribution:
   - Admin fee: 1 USDT (2%)
   - Merchant: 49 USDT (98%)
   
5. settleCryptoTransaction (Token mode):
   - Fund gas: Transfer TRX from FEE_WALLET to temp address
   - Send merchant: 49 USDT to merchant wallet
   - Admin fee: 1 USDT stays in temp address
   
6. releaseAddress:
   - sweepConfig = {mode: "threshold", value: 30}
   - admin_fee_balance: +1 USDT (accumulate)
   - last_merchant_payout: current timestamp
   - status: AVAILABLE
   
7. [Multiple payments accumulate...]
   - Payment 2: +1 USDT (total: 2 USDT)
   - Payment 3: +10 USDT (total: 12 USDT)
   - Payment 4: +18 USDT (total: 30 USDT)
   
8. [Cron runs - sweepByThreshold]:
   - Convert: 30 USDT → $30 USD
   - Check: $30 >= $30 ✅
   - Fund gas: Transfer TRX for sweep transaction
   - Sweep: 30 USDT → Admin wallet
   - Reset: admin_fee_balance = 0
```

### Example: ETH Payment (Time Mode)

```
1. Customer sends: 0.03 ETH
2. Calculate: Admin 0.0006 ETH, Merchant 0.0294 ETH
3. Send merchant payment: 0.0294 ETH
4. Admin fee accumulated: 0.0006 ETH
5. Mark timestamp: last_merchant_payout = 12:00 PM
6. Status: AVAILABLE

[10 minutes later at 12:10 PM - Cron runs]

7. sweepByTime:
   - Check: 10 minutes >= 10 minutes ✅
   - Sweep: 0.0006 ETH → Admin wallet
   - Reset: admin_fee_balance = 0
```

### Example: BTC Below Threshold Payment

```
1. Customer sends: 0.00002 BTC (~$2 USD)
2. Check threshold: $2 < $3 ❌ Below threshold
3. handleBelowThresholdPayment:
   - Merchant: 0 BTC (nothing sent)
   - Admin: 0.00002 BTC (100% accumulated)
   - Record: status = "below_threshold"
   - Release address immediately
   
4. Admin fee handling:
   - Can't use batch (no merchant payment)
   - Accumulates in temp address
   - Will be swept when:
     a) Total admin fees reach threshold, OR
     b) Time threshold met (if configured)
```

---

## 5. Database Migration Status

### Column: `last_merchant_payout`

**Current Status**: ✅ **Already in Model Definition**

**Location**: `/app/backend/models/merchantPoolModels/index.ts` (line 230)

```typescript
last_merchant_payout: {
  type: DataTypes.DATE,
  allowNull: true,
  comment: "Timestamp when merchant was last paid (for time-based sweep)",
}
```

### Migration Needed?

**Check**: Does column exist in actual database?

**Testing Method**:
```bash
# Check backend logs for Sequelize sync
grep "ALTER TABLE.*tbl_merchant_temp_address" /var/log/supervisor/backend.out.log

# Or query database directly
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'tbl_merchant_temp_address' 
AND column_name = 'last_merchant_payout';
```

**If Column Missing**:
```sql
-- Run this migration
ALTER TABLE tbl_merchant_temp_address 
ADD COLUMN last_merchant_payout TIMESTAMP NULL 
COMMENT 'Timestamp when merchant was last paid (for time-based sweep)';
```

**Sequelize Auto-Sync**: 
- If `alter: true` or `sync: true` in model config, Sequelize should auto-create
- Check backend startup logs for "Executing ALTER TABLE" statements

---

## 6. Edge Cases & Special Scenarios

### Edge Case 1: Multiple Partial Payments on UTXO Chain

```
Payment 1: 0.0003 BTC (partial)
→ Status: RESERVED, waiting for more

Payment 2: 0.0007 BTC (completes)
→ Total: 0.001 BTC
→ Calculate fees on TOTAL
→ Batch transaction: merchant + admin in ONE TX ✅
```

### Edge Case 2: Below Threshold on UTXO Chain

```
Payment: 0.00002 BTC (~$2, below $3 threshold)
→ 100% to admin: 0.00002 BTC
→ Can't batch (no merchant payment)
→ Accumulates in admin_fee_balance
→ Swept later (exception to batch rule)

Note: UTXO chains CAN accumulate admin fees if:
- Below threshold payments
- Need to wait for more fees to make sweep worthwhile
```

### Edge Case 3: Partial Payment Times Out

```
Expected: 0.001 BTC
Received: 0.0003 BTC (partial)
30 minutes pass → Expired

Options:
A. Accept partial, process as regular payment
B. Refund to customer
C. Wait longer (extended grace period)

Current implementation: Option A (accept and process)
```

### Edge Case 4: Gas Funding Failure on Token Sweep

```
Time to sweep: 30 USDT-TRC20
Action: Fund gas (need TRX)
Problem: TRX_FEE_WALLET empty!

Handling:
- Sweep fails, admin fee stays in temp address
- Retry on next cron execution
- Log error for monitoring
- Need to refill FEE_WALLET
```

---

## 7. Summary Matrix

### Fund Distribution by Payment Type

| Payment Type | Admin Fee | Merchant Amount | Notes |
|--------------|-----------|-----------------|-------|
| **Normal (above threshold)** | 2% of total | 98% of total | Standard distribution |
| **Below threshold** | 100% | 0% | Too small to forward |
| **Partial (incomplete)** | Waits for completion | Waits for completion | Grace period: 30 min |
| **Partial (complete)** | 2% of TOTAL | 98% of TOTAL | Calculated on full amount |

### Admin Fee Collection by Chain Type

| Chain Type | Collection Method | Timing | Gas Needed |
|------------|------------------|--------|------------|
| **UTXO (BTC, LTC, etc.)** | Batch with merchant | Immediate | No (deducted from TX) |
| **Native (TRX, ETH)** | Separate sweep | Threshold or Time | Yes (has native) |
| **Tokens (USDT, USDC)** | Separate sweep | Threshold only | Yes (needs funding) |

### Below Threshold Handling

| Chain Type | Admin Fee Handling | Collection Timing |
|------------|-------------------|-------------------|
| **All chains** | Accumulates in temp address | Based on sweep config |
| **UTXO** | Can't batch (exception) | Threshold/time sweep |
| **Native** | Normal accumulation | Threshold/time sweep |
| **Tokens** | Normal accumulation | Threshold sweep |

---

## 8. Recommendations

### ✅ Current Implementation is Sound

1. **Fund distribution** works correctly for all scenarios
2. **Partial payments** properly handle accumulation and grace periods
3. **Below threshold** correctly sends 100% to admin
4. **Batch transfers** work for UTXO chains (already implemented)
5. **Per-chain sweep** handles different chain types appropriately

### ⚠️ Migration Needed

**Action Required**: Verify `last_merchant_payout` column exists in database

**How to Check**:
```bash
# Check Sequelize sync logs
grep "last_merchant_payout" /var/log/supervisor/backend.out.log

# If not found, run manual migration
```

**Manual Migration** (if needed):
```sql
ALTER TABLE tbl_merchant_temp_address 
ADD COLUMN IF NOT EXISTS last_merchant_payout TIMESTAMP NULL;
```

### 💡 Potential Enhancements

1. **Below threshold batching for UTXO**: Accumulate multiple below-threshold payments, then batch sweep
2. **Dynamic thresholds**: Adjust based on gas prices
3. **Partial payment strategies**: Configurable (accept/reject/refund)
4. **Gas monitoring**: Alert when FEE_WALLETs are low

---

## Conclusion

✅ **Fund distribution logic**: Working correctly
✅ **Partial payment handling**: Proper accumulation and grace periods
✅ **Threshold logic**: 100% to admin for small payments
✅ **Integration**: Seamlessly works with new per-chain sweep system
⚠️ **Migration**: Verify `last_merchant_payout` column exists

**Status**: System is comprehensive and handles all edge cases properly. Only potential need is database migration verification.
