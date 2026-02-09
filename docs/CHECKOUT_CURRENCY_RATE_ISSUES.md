# Checkout Frontend - Currency Rate Fetching Issues Analysis

**Repository:** https://github.com/Moxxcompany/DynocheckoutDarkMode  
**Date:** 2026-02-02

---

## Issues Found

### 🔴 CRITICAL ISSUE #1: Missing `fee_payer` in Initial Rate Fetch

**File:** `/pages/pay/index.tsx` (lines 316-325)

```typescript
// CURRENT CODE - BUG
const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
  source: data.base_currency,
  amount: amount,
  currencyList: [data.base_currency],
  fixedDecimal: false,
  // Don't pass fee_payer here - let CryptoTransfer handle accurate fee calculation  ❌ WRONG COMMENT
  tax_amount: data.tax_info?.tax_amount || 0
});
```

**Problem:** The initial rate fetch does NOT pass `fee_payer`, but the backend expects it for correct fee calculation.

**Fix:**
```typescript
const ratesResponse = await axiosBaseApi.post('/pay/getCurrencyRates', {
  source: data.base_currency,
  amount: amount,
  currencyList: [data.base_currency],
  fixedDecimal: false,
  fee_payer: data.fee_payer || 'company',  // ✅ ADD THIS
  tax_amount: data.tax_info?.tax_amount || 0
});
```

---

### 🔴 CRITICAL ISSUE #2: `feePayer` State May Be Empty String

**File:** `/pages/pay/index.tsx` (line 131)

```typescript
const [feePayer, setFeePayer] = useState<string>('')  // ❌ Empty string default
```

**Problem:** When `getCurrencyRate()` is called, `feePayer` may still be empty string `''`, which the backend may not handle correctly.

**File:** `/pages/pay/index.tsx` (lines 348-358)
```typescript
const getCurrencyRate = async (selectedCurrency: string) => {
  try {
    const {
      data: { data }
    } = await axiosBaseApi.post('/pay/getCurrencyRates', {
      source: walletState?.currency,
      amount: walletState?.amount,
      currencyList: [selectedCurrency],
      fixedDecimal: false,
      fee_payer: feePayer,  // ❌ Could be empty string ''
      tax_amount: taxInfo?.amount || 0
    })
```

**Fix:**
```typescript
fee_payer: feePayer || 'company',  // ✅ Default to 'company' if empty
```

---

### 🟡 ISSUE #3: `walletState` May Have Zero/Undefined Values

**File:** `/pages/pay/index.tsx` (lines 126-129)

```typescript
const [walletState, setWalletState] = useState<walletState>({
  amount: 0,      // ❌ Default is 0
  currency: 'USD'
})
```

When `getCurrencyRate()` is called:
```typescript
source: walletState?.currency,   // Could be 'USD' (okay)
amount: walletState?.amount,     // ❌ Could be 0!
```

**Problem:** If `walletState.amount` is 0, the backend returns rates for $0 which is meaningless.

**Fix:** Add validation before calling:
```typescript
const getCurrencyRate = async (selectedCurrency: string) => {
  // ✅ ADD VALIDATION
  if (!walletState?.amount || walletState.amount <= 0) {
    console.warn('Cannot fetch rates: amount is not set');
    return;
  }
  // ... rest of function
}
```

---

### 🟡 ISSUE #4: Error Handler Crashes on Undefined Response

**File:** `/pages/pay/index.tsx` (lines 362-370)

```typescript
} catch (e: any) {
  const message = e.response.data.message ?? e.message  // ❌ CRASH if e.response is undefined
  dispatch({
    type: TOAST_SHOW,
    payload: {
      message: message,
      severity: 'error'
    }
  })
}
```

**Problem:** If the request fails due to network error (no response), `e.response` is undefined and `e.response.data.message` throws an error.

**Fix:**
```typescript
} catch (e: any) {
  const message = e?.response?.data?.message ?? e?.message ?? 'Failed to fetch currency rates'  // ✅ Safe access
  dispatch({
    type: TOAST_SHOW,
    payload: {
      message: message,
      severity: 'error'
    }
  })
}
```

---

### 🟡 ISSUE #5: Currency Options Limited to 3 Currencies

**File:** `/pages/pay/index.tsx` (lines 84-103)

```typescript
export const currencyOptions = [
  { code: 'USD', ... },
  { code: 'EUR', ... },
  { code: 'NGN', ... }
]  // ❌ Only 3 currencies!
```

**Problem:** Backend now supports 38+ currencies, but frontend only shows 3 options.

**Fix:** Expand to include all supported currencies (see separate analysis document).

---

### 🟢 ISSUE #6: No Loading State During Currency Switch

**File:** `/pages/pay/index.tsx` (lines 348-371)

```typescript
const getCurrencyRate = async (selectedCurrency: string) => {
  try {
    // ❌ No setLoading(true) at start
    const { data: { data } } = await axiosBaseApi.post('/pay/getCurrencyRates', {...})
    setCurrencyRates(data[0])
    setSelectedCurrency(selectedCurrency)
    setLoading(false)  // Only sets false, never true
  } catch (e: any) {
    // ❌ No setLoading(false) in catch
  }
}
```

**Fix:**
```typescript
const getCurrencyRate = async (selectedCurrency: string) => {
  setLoading(true)  // ✅ ADD
  try {
    const { data: { data } } = await axiosBaseApi.post('/pay/getCurrencyRates', {...})
    setCurrencyRates(data[0])
    setSelectedCurrency(selectedCurrency)
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? 'Failed to fetch rates'
    dispatch({ type: TOAST_SHOW, payload: { message, severity: 'error' } })
  } finally {
    setLoading(false)  // ✅ Always reset loading
  }
}
```

---

## Summary of Required Fixes

| Priority | Issue | File | Line | Fix |
|----------|-------|------|------|-----|
| 🔴 Critical | Missing `fee_payer` in initial fetch | index.tsx | 316-325 | Add `fee_payer: data.fee_payer \|\| 'company'` |
| 🔴 Critical | Empty `feePayer` state | index.tsx | 357 | Change to `fee_payer: feePayer \|\| 'company'` |
| 🟡 Medium | Zero amount validation | index.tsx | 348 | Add amount validation before API call |
| 🟡 Medium | Unsafe error handler | index.tsx | 363 | Use optional chaining `e?.response?.data?.message` |
| 🟡 Medium | Limited currency options | index.tsx | 84-103 | Expand `currencyOptions` array |
| 🟢 Low | Missing loading state | index.tsx | 348-371 | Add `setLoading(true/false)` |

---

## Quick Fix Patch

```typescript
// In getCurrencyRate function (line 348)
const getCurrencyRate = async (selectedCurrency: string) => {
  // Validate before calling
  if (!walletState?.amount || walletState.amount <= 0) {
    console.warn('Cannot fetch rates: amount is not set');
    return;
  }
  
  setLoading(true);
  try {
    const { data: { data } } = await axiosBaseApi.post('/pay/getCurrencyRates', {
      source: walletState?.currency,
      amount: walletState?.amount,
      currencyList: [selectedCurrency],
      fixedDecimal: false,
      fee_payer: feePayer || 'company',  // ✅ Default fallback
      tax_amount: taxInfo?.amount || 0
    })
    setCurrencyRates(data[0])
    setSelectedCurrency(selectedCurrency)
  } catch (e: any) {
    const message = e?.response?.data?.message ?? e?.message ?? 'Failed to fetch currency rates'
    dispatch({
      type: TOAST_SHOW,
      payload: { message, severity: 'error' }
    })
  } finally {
    setLoading(false)
  }
}
```

---

## Environment Variable Check

Ensure the checkout app has the correct environment variable:

```bash
NEXT_PUBLIC_BASE_URL=https://init-install-1.preview.emergentagent.com
```

Without this, the axios base URL defaults to `/api/` which may cause routing issues.

---

*Analysis by DynoPay Development Team*
