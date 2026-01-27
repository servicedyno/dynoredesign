# Partial Payment & Threshold Logic - Complete Analysis
## Critical Issue Found: Partial Payments Below Threshold

**Analysis Date:** January 27, 2026  
**Severity:** ⚠️ **CRITICAL - Logic Issue Identified**

---

## 🚨 CRITICAL FINDING

### The Problem

**Scenario:** Customer sends partial payment that's below threshold
- Expected: $10 USD
- Received (1st): $3 USD (< $5 threshold)
- Customer plans to send remaining $7 USD within 30 minutes

**Current Behavior (Lines 3523-3526):**
```typescript
if (Number(tempTx.amount) < Number(minForwarding)) {
  adminAmountToSend = Number(tempTx.amount);
  userAmountToSend = 0;
  console.log(`Amount ${tempTx.amount} below threshold. Sending all to admin.`);
}
```

**What Happens:**
1. Customer sends $3 (partial payment, below $5 threshold)
2. System marks as `status: 'partial'`
3. Waits 30 minutes for remaining payment
4. After 30 minutes: `processIncompletePayments` cron runs
5. **ENTIRE $3 sent to admin** (threshold check applied)
6. **Merchant gets $0**
7. Even if customer sends remaining $7 later, the $3 is already gone!

---

## 📊 Complete Payment Flow Analysis

### Flow 1: Immediate Full Payment (Normal)

#### Case 1A: Full Payment >= Threshold
```
Expected: $10 USD
Received: $10 USD immediately
Threshold: $5 USD

Logic: isFullPayment = true (line 1729)
  ├─ totalAmountReceived = $10
  ├─ amountInUSD = $10
  ├─ Check: $10 >= $5 ✓
  ├─ Calculate fees: $3.30
  ├─ adminAmountToSend = $3.30
  └─ userAmountToSend = $6.70

Result: ✅ CORRECT
  - Admin: $3.30 (fee)
  - Merchant: $6.70
```

#### Case 1B: Full Payment < Threshold
```
Expected: $3 USD
Received: $3 USD immediately
Threshold: $5 USD

Logic: isFullPayment = true (line 1729)
  ├─ totalAmountReceived = $3
  ├─ amountInUSD = $3
  ├─ Check: $3 < $5 ✓
  ├─ adminAmountToSend = $3 (entire amount)
  └─ userAmountToSend = $0

Result: ✅ CORRECT
  - Admin: $3.00 (all - under threshold)
  - Merchant: $0.00
```

---

### Flow 2: Partial Payment → Complete Within 30 Minutes

#### Case 2A: Partial + Complete = >= Threshold
```
Expected: $10 USD
1st Payment: $4 USD (partial, below threshold)
  ├─ isPartialPayment = true (line 1730)
  ├─ status: 'partial'
  ├─ Redis updated: pending $6
  └─ Wait 30 minutes

2nd Payment: $6 USD (within 30 min)
  ├─ tempData.incomplete = true
  ├─ tempData.previousAmount = $4
  ├─ totalAmountReceived = $4 + $6 = $10
  ├─ Check: $10 >= $5 ✓
  ├─ Calculate fees: $3.30
  ├─ adminAmountToSend = $3.30
  └─ userAmountToSend = $6.70

Result: ✅ CORRECT
  - Admin: $3.30 (fee on total)
  - Merchant: $6.70
```

#### Case 2B: Partial + Complete = < Threshold
```
Expected: $4 USD
1st Payment: $2 USD (partial)
  ├─ status: 'partial'
  └─ Wait 30 minutes

2nd Payment: $2 USD (within 30 min)
  ├─ totalAmountReceived = $2 + $2 = $4
  ├─ Check: $4 < $5 ✓
  ├─ adminAmountToSend = $4 (entire amount)
  └─ userAmountToSend = $0

Result: ✅ CORRECT
  - Admin: $4.00 (all - under threshold)
  - Merchant: $0.00
```

---

### Flow 3: Partial Payment → Expired (30 Minutes)

#### Case 3A: Partial Expired >= Threshold
```
Expected: $10 USD
1st Payment: $6 USD (partial, above threshold)
  ├─ status: 'partial'
  └─ Wait 30 minutes (no 2nd payment)

After 30 min: processIncompletePayments runs
  ├─ Check actualBalance: $0 (no more payments)
  ├─ Amount to process: $6
  ├─ Check: $6 >= $5 ✓
  ├─ Calculate fees: ~$3.24
  ├─ adminAmountToSend = $3.24
  └─ userAmountToSend = $2.76

Result: ⚠️ QUESTIONABLE
  - Admin: $3.24 (fee)
  - Merchant: $2.76 (only 27.6% of expected)
  - Customer paid: $6 of $10 (60%)
  - Merchant received: 27.6% value
```

#### Case 3B: Partial Expired < Threshold ❌ PROBLEM
```
Expected: $10 USD
1st Payment: $3 USD (partial, below threshold)
  ├─ status: 'partial'
  └─ Wait 30 minutes (customer planning to send $7 more)

After 30 min: processIncompletePayments runs (line 3523)
  ├─ Check actualBalance: $0 (no more payments YET)
  ├─ Amount to process: $3
  ├─ Check: $3 < $5 ✓ (line 3523)
  ├─ adminAmountToSend = $3 (ENTIRE amount)
  └─ userAmountToSend = $0

Result: ❌ WRONG!
  - Admin: $3.00 (100% - under threshold rule applied)
  - Merchant: $0.00
  - Customer paid: $3 of $10 (30%)
  - Merchant received: 0% value

PROBLEM: If customer sends remaining $7 after this:
  - System creates NEW transaction
  - $7 is >= threshold
  - Calculate fees: ~$3.20
  - Merchant gets: $3.80 (not $6.70)
  
Total outcome:
  - Customer paid: $10 total
  - Admin got: $3 + $3.20 = $6.20 (should be $3.30)
  - Merchant got: $0 + $3.80 = $3.80 (should be $6.70)
  - MERCHANT LOSES $2.90!
```

---

## 🔍 Root Cause Analysis

### The Issue (Lines 3518-3531)

```typescript
// COMPANY PAYS FEES MODE (default)
const { totalDeduction, minForwarding } = await calculateTransactionFees(
  tempTx.wallet_type,
  Number(tempTx.amount)  // ← Uses PARTIAL amount, not EXPECTED amount
);

if (Number(tempTx.amount) < Number(minForwarding)) {  // ← WRONG CHECK
  adminAmountToSend = Number(tempTx.amount);
  userAmountToSend = 0;
  console.log(`Amount ${tempTx.amount} below threshold. Sending all to admin.`);
} else {
  adminAmountToSend = Number(totalDeduction);
  userAmountToSend = Number(tempTx.amount) - Number(totalDeduction);
  console.log(`Splitting partial amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
}
```

### Why It's Wrong

**Threshold check should compare EXPECTED AMOUNT, not RECEIVED AMOUNT**

- `tempTx.amount` = What was actually received (partial)
- `tempTx.expected_amount` = What was supposed to be received (full)

**Current:** Checks if $3 (received) < $5 (threshold) → YES, send all to admin  
**Should:** Check if $10 (expected) < $5 (threshold) → NO, calculate fees

---

## ✅ Recommended Fix

### Option 1: Use Expected Amount for Threshold Check (RECOMMENDED)

```typescript
// COMPANY PAYS FEES MODE (default)
const expectedAmount = Number(tempTx.expected_amount || tempTx.amount);
const actualAmount = Number(tempTx.amount);

const { totalDeduction, minForwarding } = await calculateTransactionFees(
  tempTx.wallet_type,
  expectedAmount  // ← Use EXPECTED, not actual
);

// Threshold check based on EXPECTED amount, not received
if (expectedAmount < minForwarding) {
  // Expected payment is below threshold - send all to admin
  adminAmountToSend = actualAmount;
  userAmountToSend = 0;
  console.log(`Expected amount ${expectedAmount} below threshold ${minForwarding}. Sending all ${actualAmount} to admin.`);
} else {
  // Expected payment is above threshold - calculate proportional fees
  // Fee percentage based on expected amount
  const feePercentage = totalDeduction / expectedAmount;
  adminAmountToSend = actualAmount * feePercentage;
  userAmountToSend = actualAmount - adminAmountToSend;
  console.log(`Splitting partial amount: Admin=${adminAmountToSend}, Merchant=${userAmountToSend} (proportional to expected ${expectedAmount})`);
}
```

### Option 2: Wait Longer for Below-Threshold Partials

```typescript
// Don't process partial payments below threshold immediately
if (Number(tempTx.amount) < Number(minForwarding) && tempTx.status === 'partial') {
  console.log(`Partial payment ${tempTx.amount} below threshold. Waiting longer for completion.`);
  continue; // Skip this transaction, check again next run
}
```

### Option 3: Always Calculate Proportional Fees (SIMPLEST)

```typescript
// Never apply "all to admin" rule for partial payments
// Always split proportionally, regardless of threshold
const expectedAmount = Number(tempTx.expected_amount || tempTx.amount);
const actualAmount = Number(tempTx.amount);

const { totalDeduction, minForwarding } = await calculateTransactionFees(
  tempTx.wallet_type,
  expectedAmount
);

// Always proportional split for partial payments
const feePercentage = totalDeduction / expectedAmount;
adminAmountToSend = actualAmount * feePercentage;
userAmountToSend = actualAmount - adminAmountToSend;

console.log(`Partial payment: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
```

---

## 📊 Impact Analysis

### Affected Scenarios

| Scenario | Current Behavior | Correct Behavior | Impact |
|----------|-----------------|------------------|--------|
| Full $10 payment | ✅ Correct | No change | None |
| Full $3 payment | ✅ Correct | No change | None |
| Partial $4+$6 (complete) | ✅ Correct | No change | None |
| **Partial $3 expired** | ❌ All to admin | Should split | **HIGH** |
| Partial $6 expired | ⚠️ Splits | Should split | Medium |

### Customer Experience Issue

**Scenario:**
1. Customer orders $10 product
2. Sends $3 BTC (low gas fees)
3. Plans to send $7 more shortly
4. 30 minutes pass (slight delay)
5. System processes $3 → all to admin
6. Customer sends $7 → processed as new payment
7. Total: Customer paid $10, merchant got ~$3.80 (should be $6.70)

**Result:** Merchant loses money, customer confused

---

## 🔧 Required Changes

### File: `/app/backend/controller/paymentController.ts`

**Location:** Lines 3516-3532 in `processIncompletePayments` function

**Change 1: Add expected_amount field (if not exists)**
```typescript
// When creating temp address, store expected amount
await userTempAddressModel.create({
  ...otherFields,
  expected_amount: tempData.amount,  // Store original expected amount
});
```

**Change 2: Fix threshold logic**
```typescript
// Use expected amount for threshold check
const expectedAmount = Number(tempTx.expected_amount || tempTx.amount);
const actualAmount = Number(tempTx.amount);

const { totalDeduction, minForwarding } = await calculateTransactionFees(
  tempTx.wallet_type,
  expectedAmount  // ← Changed from actualAmount
);

if (expectedAmount < minForwarding) {  // ← Changed condition
  // Expected amount below threshold
  adminAmountToSend = actualAmount;
  userAmountToSend = 0;
  console.log(`Expected ${expectedAmount} below threshold ${minForwarding}. All ${actualAmount} to admin.`);
} else {
  // Expected amount above threshold - proportional split
  const feePercentage = totalDeduction / expectedAmount;
  adminAmountToSend = actualAmount * feePercentage;
  userAmountToSend = actualAmount - adminAmountToSend;
  console.log(`Proportional split: Admin=${adminAmountToSend}, Merchant=${userAmountToSend}`);
}
```

---

## 🎯 Summary

### Current Implementation Status

| Flow Type | Status | Notes |
|-----------|--------|-------|
| Full payment >= threshold | ✅ CORRECT | Works as expected |
| Full payment < threshold | ✅ CORRECT | Works as expected |
| Partial → Complete >= threshold | ✅ CORRECT | Works as expected |
| Partial → Complete < threshold | ✅ CORRECT | Works as expected |
| Partial expired >= threshold | ⚠️ WORKS | But questionable UX |
| **Partial expired < threshold** | ❌ **BUG** | **Incorrect logic** |

### Recommendation

**Implement Option 1 (Use Expected Amount)**
- Fixes the critical bug
- Maintains consistent fee structure
- Fair to both merchant and customer
- Minimal code changes required

---

**Analysis Complete:** January 27, 2026  
**Issue Severity:** ⚠️ **HIGH**  
**Fix Required:** ✅ **YES**  
**Estimated Fix Time:** 30 minutes
