# OVERPAYMENT INDICATION - ANALYSIS & FIX NEEDED

**Date:** January 25, 2025  
**Issue:** Overpayment amount not properly indicated in API key base currency

---

## 🔍 CURRENT SITUATION ANALYSIS

### ✅ What's Working:
1. **Overpayment forwarding** - Total amount (including overpayment) forwarded to merchant
2. **Overpayment detection** - System detects when receivedAmount > expectedAmount
3. **Basic tracking** - Code calculates overpayment amount

### ❌ What's Broken:
1. **Hardcoded USD conversion** - Overpayment always converted to USD (Line 1839-1844)
2. **Should use API key base_currency** - Not using the API key's configured base currency
3. **No indication in response** - Overpayment amount not returned in API responses
4. **Missing in transaction record** - Not stored in database for reporting

---

## 📍 CODE LOCATION

**File:** `/app/backend/controller/paymentController.ts`  
**Lines:** 1835-1862

### Current Implementation (INCORRECT):

```typescript
// Line 1835-1848: Overpayment calculation
let overPayment = false;
let newAmount = [{ amount: 0 }];
const tempAmount = Number(receivedAmount) - Number(tempData?.amount);

if (tempAmount > 0) {
  // ❌ PROBLEM: Hardcoded to USD
  newAmount = await currencyConvert({
    sourceCurrency: tempCurrency,  // e.g., BTC
    currency: ["USD"],             // ❌ Always USD!
    amount: tempAmount,
    fixedDecimal: true,
  });
  
  // ❌ PROBLEM: Threshold also hardcoded to $5 USD
  if (newAmount[0].amount > 5) {
    overPayment = true;
  }
}

// Line 1851-1862: Overpayment response (for createPayment pathType)
if (customerData?.pathType.includes("createPayment") && overPayment) {
  throw {
    status: 200,
    paymentStatus: "overpayment",
    amount: tempAmount,        // ← In crypto, not base currency!
    currency: tempCurrency,    // ← BTC/ETH, not base currency!
    message: `Overpayment detected!`,
  };
}
```

---

## 🎯 REQUIRED FIXES

### Fix 1: Use API Key Base Currency (NOT USD)

**Current:**
```typescript
currency: ["USD"],  // ❌ Hardcoded
```

**Should be:**
```typescript
currency: [customerData.base_currency],  // ✅ API key base currency
```

### Fix 2: Return Overpayment in Base Currency

**Add to response:**
```typescript
{
  status: 200,
  paymentStatus: "complete",
  overpayment: {
    detected: true,
    amount_crypto: tempAmount,           // In crypto (BTC/ETH)
    amount_base: newAmount[0].amount,    // In base currency (USD/EUR)
    base_currency: customerData.base_currency,
    crypto_currency: tempCurrency
  }
}
```

### Fix 3: Store in Database

Add overpayment fields to transaction record:
```typescript
const customerPayload = {
  // ... existing fields
  overpayment_amount: tempAmount > 0 ? tempAmount : 0,
  overpayment_base: tempAmount > 0 ? newAmount[0].amount : 0,
  overpayment_detected: tempAmount > 0,
};
```

---

## 📊 EXAMPLE SCENARIOS

### Scenario 1: API Key with USD base currency

**Setup:**
- API key base_currency: USD
- Payment expected: $100 = 0.05 BTC
- Customer sends: 0.06 BTC = $120

**Current behavior:**
```json
{
  "overpayment": {
    "amount": 0.01,
    "currency": "BTC"
  }
}
```
- Overpayment converted to USD: $20 ✅
- Threshold check: $20 > $5 → flagged ✅

### Scenario 2: API Key with EUR base currency

**Setup:**
- API key base_currency: EUR
- Payment expected: €90 = 0.05 BTC  
- Customer sends: 0.06 BTC = €108

**Current behavior (WRONG):**
```json
{
  "overpayment": {
    "amount": 0.01,
    "currency": "BTC"
  }
}
```
- Overpayment converted to USD: $20 ❌ WRONG!
- Should convert to EUR: €18 ✅
- Threshold: €18 > €5 (not $5)

---

## 🔧 WHERE API KEY BASE CURRENCY IS STORED

### 1. API Model
**File:** `/app/backend/models/apiModels/apiModel.ts`  
**Line 48-51:**
```typescript
base_currency: {
  type: DataTypes.STRING,
  defaultValue: "USD",
},
```

### 2. Available in Payment Processing
**Line 1626:**
```typescript
base_currency: customerData.base_currency  // ← Available here!
```

This `customerData.base_currency` comes from the API key that created the payment.

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Fix Currency Conversion
- [ ] Replace hardcoded "USD" with `customerData.base_currency`
- [ ] Update threshold check to use base currency
- [ ] Test with USD API key
- [ ] Test with EUR API key
- [ ] Test with other base currencies

### Phase 2: Add Overpayment Indication to Response
- [ ] Add `overpayment` object to payment response
- [ ] Include amount in both crypto and base currency
- [ ] Include overpayment detection flag
- [ ] Document in API response structure

### Phase 3: Store in Database
- [ ] Add overpayment fields to customerTransactionModel (if not exists)
- [ ] Store overpayment_amount, overpayment_base, overpayment_detected
- [ ] Update transaction record creation
- [ ] Enable reporting/analytics on overpayments

### Phase 4: Webhook Notification
- [ ] Include overpayment info in webhook payload
- [ ] Document webhook overpayment fields
- [ ] Test webhook with overpayment scenarios

---

## 🎯 SUCCESS CRITERIA

1. **Currency Conversion:**
   - ✅ Overpayment converted to API key's base currency (not always USD)
   - ✅ EUR API key → overpayment in EUR
   - ✅ GBP API key → overpayment in GBP

2. **Response Indication:**
   - ✅ Payment response includes overpayment object
   - ✅ Shows amount in both crypto and base currency
   - ✅ Clear indication when overpayment detected

3. **Database Storage:**
   - ✅ Overpayment amount stored in transaction
   - ✅ Both crypto and base currency amounts saved
   - ✅ Can query/report on overpayments

4. **Webhook:**
   - ✅ Overpayment info included in webhook payload
   - ✅ Merchant notified of exact overpayment amount

---

## 🚨 CRITICAL ISSUE

**The threshold check (line 1845) uses $5 USD regardless of base currency!**

```typescript
if (newAmount[0].amount > 5) {  // ← Always $5!
  overPayment = true;
}
```

**This should be configurable or relative:**
- USD base: $5 threshold
- EUR base: €5 threshold  
- GBP base: £5 threshold

Or convert to equivalent:
- USD base: $5 = €4.50 = £3.80

---

## 📝 NEXT STEPS

1. **Verify API key base currency is working** - Check if it's properly set and used
2. **Implement Fix 1** - Use base_currency instead of USD
3. **Implement Fix 2** - Add overpayment to response
4. **Implement Fix 3** - Store in database
5. **Test all scenarios** - Different base currencies
6. **Update documentation** - API response structure

---

**Status:** ⚠️ PARTIALLY IMPLEMENTED - Needs fixes  
**Priority:** HIGH - Affects multi-currency support  
**Complexity:** MEDIUM - Clear fixes identified
