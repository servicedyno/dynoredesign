# Payment Processing Analysis Report
## Anomalies and Scenario Handling

---

## 1. ✅ Payment Link Update Handling

**Status: WORKING CORRECTLY**

When a payment link is updated (e.g., amount, fee_payer, apply_tax):
- Database is updated via `updatePaymentLink`
- Redis is also updated with new values (lines 4390-4430)
- All critical fields are synced: `base_amount`, `fee_payer`, `apply_tax`, `expires_at`, etc.

```typescript
// Redis update includes:
const updatedRedisPayload = {
  ...existingRedisData,
  base_amount: linkData.base_amount,
  fee_payer: linkData.fee_payer,
  apply_tax: linkData.apply_tax,
  // ... other fields
};
```

**Verified:** Changes to link 220 (fee_payer: customer→company, apply_tax: true→false) are properly synced.

---

## 2. ⚠️ POTENTIAL ISSUE: Crypto Switching After Partial Payment

**Status: POTENTIAL VULNERABILITY**

**Scenario:** 
1. Customer selects BTC, generates address, pays 50% of amount
2. System marks payment as "incomplete" with 30-minute grace period
3. Customer switches to ETH (calls createCryptoPayment with different currency)
4. New ETH address is generated, OLD BTC payment is orphaned

**Current Behavior:**
- `createCryptoPayment` does NOT check for existing partial payments
- Line 1170-1172: Simply clears existing Redis data for new address
- No validation: "You have an incomplete payment on address X, please complete it first"

**Impact:**
- Partial payment on original address may be lost/orphaned
- Customer confusion about which address to pay
- Potential for abuse (multiple partial payments never completed)

**Recommended Fix:**
```typescript
// In createCryptoPayment, before generating new address:
// Check if there's an existing incomplete payment for this payment link
const existingPayments = await userTempAddressModel.findAll({
  where: {
    unique_tx_id: data.uniqueRef,  // Or similar linking field
    status: 'partial'
  }
});

if (existingPayments.length > 0) {
  return errorResponseHelper(
    res,
    400,
    "You have an incomplete payment. Please complete the existing payment or wait for it to expire before switching currencies."
  );
}
```

---

## 3. ✅ Fee Payer Modes in Payment Distribution

**Status: WORKING CORRECTLY**

### Customer Pays Fees Mode (lines 3052-3074):
```typescript
if (fee_payer === 'customer' && merchant_amount) {
  userAmountToSend = Number(merchant_amount);  // Full base amount to merchant
  adminAmountToSend = Number(totalAmountReceived) - Number(merchant_amount);  // Fees to admin
}
```

### Company Pays Fees Mode (lines 3075-3120):
```typescript
else {
  // Calculate fees from received amount
  const { totalDeduction, minForwarding } = await calculateTransactionFees(...);
  adminAmountToSend = totalAmountReceived * feePercentage;
  userAmountToSend = totalAmountReceived - adminAmountToSend;
}
```

**Both modes handle:**
- Normal payments ✅
- Under-threshold payments (all to admin) ✅
- Edge cases (negative amounts prevented) ✅

---

## 4. ✅ Underpayment Handling

**Status: WORKING CORRECTLY**

**Flow:**
1. Payment received < expected amount
2. System calculates pending amount (line 2968)
3. Records partial payment in Redis with `incomplete: "true"` flag
4. Sets 30-minute grace period for completion
5. On completion, correctly uses cumulative total (line 3034)

**Grace Period Logic (lines 2537-2539):**
```typescript
if (String(tempData?.incomplete) === "true" && tempData?.partialPaymentTimestamp) {
  const partialTimestamp = new Date(tempData.partialPaymentTimestamp);
  const graceExpiresAt = new Date(partialTimestamp.getTime() + gracePeriodMinutes * 60 * 1000);
}
```

**Cleanup (line 5053):**
- `processIncompletePayments` runs to handle expired partial payments

---

## 5. ✅ Multi-Chain Support

**Status: WORKING CORRECTLY**

**Supported chains identified in code:**
- UTXO chains: BTC, LTC, DOGE, BCH (line 3144)
- Account-based: ETH, and ERC-20 tokens (USDT, USDC, etc.)
- Others: TRON (TRX), XRP, SOL

**Chain-specific handling:**
```typescript
const isUTXOChain = ["BTC", "LTC", "DOGE", "BCH"].includes(tempCurrency);
const adminFeeStatus = isUTXOChain ? "successful" : "pending_sweep";
```

- UTXO chains: Admin fee sent in same transaction
- Account-based: Admin fee retained for batch sweep

---

## 6. ⚠️ POTENTIAL ISSUE: Race Condition on Concurrent Requests

**Status: LOW RISK BUT NOTABLE**

**Scenario:**
1. Customer opens checkout on two tabs
2. Both tabs call `createCryptoPayment` simultaneously
3. Both might generate different addresses for same payment link

**Current Mitigation:**
- Redis key is based on address (`crypto-{address}`)
- Each address has its own payment tracking
- Final payment status is based on first successful transaction

**Recommendation:** Consider adding idempotency check based on `uniqueRef + currency` combination.

---

## 7. ✅ Tax Calculation Integration

**Status: WORKING CORRECTLY**

- Tax is calculated based on customer's geo-location (IP/timezone)
- Tax amount stored in Redis for payment verification
- Tax is properly included in merchant amount when `fee_payer === 'customer'`

---

## Summary Table

| Scenario | Status | Notes |
|----------|--------|-------|
| Payment link update → Redis sync | ✅ Working | Properly updates Redis |
| Customer pays fees distribution | ✅ Working | Merchant gets base, admin gets fees |
| Company pays fees distribution | ✅ Working | Fees deducted from received |
| Underpayment detection | ✅ Working | 30-min grace period |
| Underpayment completion | ✅ Working | Cumulative total used |
| Multi-chain (UTXO vs Account) | ✅ Working | Different sweep handling |
| Tax calculation | ✅ Working | Geo-based, properly tracked |
| **Crypto switching after partial** | ⚠️ Issue | No validation, could orphan payments |
| **Concurrent address generation** | ⚠️ Low Risk | Multiple addresses possible |

---

## Recommended Actions

### High Priority:
1. **Add validation in `createCryptoPayment`** to prevent crypto switching when partial payment exists

### Medium Priority:
2. **Add idempotency** for address generation (same uniqueRef + currency = same address)
3. **Add monitoring** for orphaned partial payments

### Low Priority:
4. Consider adding "cancel payment" endpoint to explicitly abandon partial payments
