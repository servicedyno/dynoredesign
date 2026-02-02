# Frontend Currency Conversion Bug Analysis

## 🐛 Bug Location
**File:** `pages/pay/index.tsx` (DynocheckoutDarkMode repo)  
**Line:** ~Lines where display amounts are calculated

---

## 🔍 Root Cause

The frontend is prioritizing the **USD amount** over the **converted currency amount** when displaying totals.

### Current Buggy Code:
```typescript
// Line ~330
const totalAmount = Number(
  currencyRates?.total_amount_source ??  // ❌ This is USD amount!
  currencyRates?.amount ??               // ✅ This is converted amount
  walletState?.amount ?? 
  0
)
```

### Backend Response Structure:
When user selects CNY, backend returns:
```json
{
  "currency": "CNY",
  "amount": 108.49,                    // ✅ Converted CNY amount
  "total_amount": 108.49,              // ✅ Converted CNY amount
  "total_amount_source": 15.61,        // ❌ USD amount (source)
  "total_amount_usd": 15.61,           // USD reference
  "transferRate": 6.95
}
```

### The Problem:
1. Frontend checks `currencyRates?.total_amount_source` **first**
2. This returns `15.61` (USD amount)
3. Frontend then displays: `15.61 CNY` ❌
4. Should display: `108.49 CNY` ✅

The `displayCurrency` correctly shows "CNY", but the `totalAmount` shows the USD value.

---

## 🔧 Required Fix

### Fix #1: Total Amount Calculation
**Current (Buggy):**
```typescript
const totalAmount = Number(
  currencyRates?.total_amount_source ?? 
  currencyRates?.amount ?? 
  walletState?.amount ?? 
  0
)
```

**Fixed:**
```typescript
const totalAmount = Number(
  currencyRates?.amount ??                // ✅ Use converted amount first
  currencyRates?.total_amount ??          // ✅ Or total_amount
  walletState?.amount ??                  // Fallback to original
  0
)
```

### Fix #2: Subtotal Display
**Current:**
```typescript
const subtotalAmount = Number(
  feeInfo?.subtotal || 
  walletState?.amount || 
  0
)
```

**Fixed:**
```typescript
const subtotalAmount = Number(
  currencyRates?.base_amount ??           // ✅ Use converted base amount
  feeInfo?.subtotal || 
  walletState?.amount || 
  0
)
```

### Fix #3: Processing Fee Display
Add conversion for processing fee:
```typescript
const processingFee = Number(
  currencyRates?.processing_fee ??        // ✅ Use converted fee
  feeInfo?.processing_fee || 
  0
)
```

### Fix #4: Tax Amount Display  
Add conversion for tax:
```typescript
const taxAmount = Number(
  currencyRates?.tax_amount ??            // ✅ Use converted tax
  taxInfo?.amount || 
  0
)
```

---

## 📊 Impact

### Before Fix:
```
User selects CNY
Backend returns: 108.49 CNY (correct)
Frontend displays: 12.30 CNY (wrong - showing USD value)
```

### After Fix:
```
User selects CNY
Backend returns: 108.49 CNY (correct)
Frontend displays: 108.49 CNY (correct)
```

---

## 🎯 Technical Details

### Why `total_amount_source` exists:
The backend includes `total_amount_source` as a **reference** field to show the original USD amount for internal tracking. It's not meant to be displayed to the user when they've selected a different currency.

### Correct Field Priority:
1. **`amount`** or **`total_amount`** → Converted currency amount (for display)
2. **`total_amount_usd`** → USD equivalent (for reference)
3. **`total_amount_source`** → Internal USD tracking (not for display)

### Similar Issues to Check:
The same pattern may exist for:
- Subtotal display
- Processing fee display
- Tax amount display
- Any other currency-dependent values

All should prioritize the converted amounts from `currencyRates` over the source USD amounts.

---

## ✅ Testing After Fix

**Test Case:**
1. Create payment link for $10 USD
2. Select CNY currency
3. Verify displays show:
   - Base: ~69.5 CNY (not $10)
   - Tax: ~15.98 CNY (not $2.30)
   - Fees: ~23 CNY (not $3.31)
   - Total: ~108.49 CNY (not $12.30)

---

## 📝 Files to Modify

1. **`pages/pay/index.tsx`**
   - Lines ~328-338: Amount calculation logic
   - Update to prioritize `currencyRates?.amount`
   - Update subtotal, fee, and tax to use converted values

---

## 🚀 Deployment Notes

- This is a **frontend-only fix**
- Backend currency conversion is working correctly
- No backend changes needed
- Deploy to checkout frontend repo: `DynocheckoutDarkMode`

---

*Generated: 2026-02-01*  
*Issue: Currency conversion displays USD amounts with selected currency symbol*  
*Resolution: Prioritize converted amounts over source USD amounts*
