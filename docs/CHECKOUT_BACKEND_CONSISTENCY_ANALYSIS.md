# DynoPay Checkout Frontend vs Backend Consistency Analysis

**Date:** February 2, 2026  
**Checkout Repo:** https://github.com/Moxxcompany/DynocheckoutDarkMode/tree/ongoingfixes  
**Backend:** `/app/backend`

---

## Summary

| Area | Backend | Checkout Frontend | Status |
|------|---------|-------------------|--------|
| Payment Statuses | 8 statuses (waiting, pending, confirmed, underpaid, overpaid, expired, failed, processing) | 6 statuses (missing: failed, processing) | ⚠️ NEEDS FIX |
| Initial Window | 15 minutes | N/A (uses timer from backend) | ✅ OK |
| Grace Period | 30 minutes default | **15 minutes default** | ❌ MISMATCH |
| Overpayment Threshold | $5 USD | $5 USD | ✅ OK |
| Payment Link Expiry | Handled with expires_at field | Handled with countdown timer | ⚠️ PARTIAL |

---

## 1. Payment Statuses and Polling

### Backend Statuses (paymentController.ts)

```typescript
// verifyCryptoPayment returns these statuses:
"waiting"     // No payment data in Redis OR pending without txId
"pending"     // Transaction detected, awaiting confirmation
"confirmed"   // Payment confirmed successfully
"underpaid"   // Partial payment received
"overpaid"    // More than expected was paid
"expired"     // Payment window expired (implicit)
"failed"      // Payment processing failed
"processing"  // Being processed (maps to "pending" in response)
"retrying"    // Retry in progress (maps to "pending" in response)
```

### Checkout Frontend Statuses (cryptoTransfer.tsx)

```typescript
type PaymentStatusType =
  | "waiting"      // No payment detected yet
  | "pending"      // Payment detected, awaiting confirmation
  | "confirmed"    // Payment confirmed successfully
  | "underpaid"    // Partial payment received
  | "overpaid"     // More than expected was paid
  | "expired";     // Payment window expired
```

### ❌ Issues Found

1. **Missing "failed" status handler:**
   - Backend can return `status: "failed"` with `lastError` message
   - Frontend doesn't handle this status - payment failure won't be shown to user
   
2. **Implicit status mapping:**
   - Backend maps "processing" and "retrying" to "pending" in response
   - This is correct, but frontend should be aware

### ✅ Recommendations

```typescript
// Add to PaymentStatusType:
type PaymentStatusType =
  | "waiting"
  | "pending"
  | "confirmed"
  | "underpaid"
  | "overpaid"
  | "expired"
  | "failed";    // ADD THIS

// Add handler in polling switch statement:
case "failed":
  setIsStart(false);
  setIsReceived(false);
  setIsPolling(false);
  clearInterval(pollInterval);
  dispatch({
    type: TOAST_SHOW,
    payload: {
      message: data.message || t('crypto.paymentFailed'),
      severity: "error",
    },
  });
  break;
```

---

## 2. Initial Window Minutes (15)

### Backend Configuration

```typescript
// paymentController.ts line 298
const paymentSettings = {
  initial_window_minutes: 15,      // Default: 15 minutes to pay after selecting crypto
  grace_period_minutes: 30,        // Default: 30 minutes to complete partial payment
  overpayment_threshold_usd: 5,    // Default: $5 minimum overpayment to handle
};

// verifyCryptoPayment line 2643
let remainingSeconds = 15 * 60; // Default 15 minutes

// Timer calculation for initial vs partial (line 2704)
const defaultExpiryMinutes = String(tempData?.incomplete) === "true" ? gracePeriodMinutes : 15;
```

### Checkout Frontend

The frontend correctly uses `remaining_seconds` from the backend API response to set the timer:

```typescript
// Timer set from response
const timerMinutes = result?.remaining_minutes || result?.expires_in_minutes || result?.expiration_minutes;
if (timerMinutes && timerMinutes > 0) {
  setTimeLeft(timerMinutes * 60);
}
```

### ✅ Status: OK

The initial window is correctly set from the backend. Frontend relies on `remaining_seconds` in API responses.

---

## 3. Grace Period (30 minutes)

### ❌ CRITICAL MISMATCH FOUND

**Backend Default:**
```typescript
// paymentController.ts line 299
grace_period_minutes: 30,        // Default: 30 minutes to complete partial payment

// verifyCryptoPayment line 2644
let gracePeriodMinutes = 30; // Default grace period for underpayment completion
```

**Checkout Frontend Default:**
```typescript
// cryptoTransfer.tsx - merchantSettings initialization
const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
  overpayment_threshold_usd: 5,
  grace_period_minutes: 15       // DEFAULT IS 15, NOT 30!
});
```

### Impact

When user pays partial payment and clicks "Pay Remaining":
1. Frontend resets timer using local default (15 min)
2. Backend expects 30 min grace period
3. Timer shows 15 min to user but backend may allow 30 min

### ✅ Fix Required

```typescript
// cryptoTransfer.tsx - Change default to match backend
const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
  overpayment_threshold_usd: 5,
  grace_period_minutes: 30       // CHANGE 15 → 30
});
```

---

## 4. Overpayment Threshold ($5 USD)

### Backend

```typescript
// paymentController.ts line 300
overpayment_threshold_usd: 5,    // Default: $5 minimum overpayment to handle

// verifyCryptoPayment line 2647
let merchantOverpaymentThreshold = 5; // Default $5
```

### Checkout Frontend

```typescript
// cryptoTransfer.tsx
const [merchantSettings, setMerchantSettings] = useState<MerchantSettings>({
  overpayment_threshold_usd: 5,  // Default $5
  grace_period_minutes: 15
});

// Overpayment screen logic:
if (excessUsd > threshold) {
  // Show overpayment screen
} else {
  // Treat as confirmed - minor overpayment
}
```

### ✅ Status: OK

Both backend and frontend use $5 USD as default overpayment threshold.

---

## 5. Payment Link Expiry

### Backend Implementation

```typescript
// createPaymentLink (line 4165-4177)
let expires_at = null;
if (expire) {
  if (expire === '1d') {
    expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  } else if (expire === '7d') {
    expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  } else if (expire === '30d') {
    expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
}

// getData checks expiry (line 384-389)
if (diffMs <= 0) {
  console.log(`[getData] Payment link expired at ${item.expires_at}`);
  return errorResponseHelper(
    res, 400,
    "This payment link has expired. Please contact the merchant for a new payment link."
  );
}

// createCryptoPayment checks expiry (line 951-958)
if (expiresAt.getTime() <= now.getTime()) {
  return errorResponseHelper(
    res, 400,
    "This payment link has expired and can no longer be used for payments."
  );
}
```

### Checkout Frontend

```typescript
// pages/pay/index.tsx - Countdown timer
useEffect(() => {
  if (!expiryInfo?.expires_at) return

  const updateCountdown = () => {
    const now = new Date().getTime()
    const expiry = new Date(expiryInfo.expires_at).getTime()
    const diff = expiry - now

    if (diff <= 0) {
      setCountdown('Expired')
      return
    }
    // ... calculate days, hours, minutes, seconds
  }

  updateCountdown()
  const interval = setInterval(updateCountdown, 1000)
  return () => clearInterval(interval)
}, [expiryInfo, t])
```

### ⚠️ Partial Implementation

**Issues:**

1. **No error handler for mid-flow expiry:**
   - If payment link expires WHILE user is on crypto payment screen
   - Backend will return 400 error on verifyCryptoPayment
   - Frontend catches error but doesn't show user-friendly expired message

2. **No refresh on expiry:**
   - When countdown reaches "Expired", frontend just displays "Expired"
   - Doesn't prevent user from trying to pay
   - Doesn't redirect or show expired UI component

### ✅ Recommendations

```typescript
// In polling error handler:
} catch (e: any) {
  const message = e?.response?.data?.message ?? e?.message;
  const status = e?.response?.status;
  
  // Check for expiry error
  if (status === 400 && message?.toLowerCase().includes('expired')) {
    setPaymentStatus("expired");
    setIsPolling(false);
    clearInterval(pollInterval);
    return;
  }
}

// When countdown reaches 0:
if (diff <= 0) {
  setCountdown('Expired');
  setPaymentStatus("expired"); // ADD THIS
  return;
}
```

---

## Additional Recommendations

### 1. Create Shared Constants

Backend and frontend should share timing constants:

```typescript
// shared/constants.ts (or sync via API)
export const PAYMENT_CONSTANTS = {
  INITIAL_WINDOW_MINUTES: 15,
  GRACE_PERIOD_MINUTES: 30,
  OVERPAYMENT_THRESHOLD_USD: 5,
  POLLING_INTERVALS: {
    TRX: 10000,
    ETH: 15000,
    BTC: 30000,
    DEFAULT: 15000
  }
};
```

### 2. Improve Error Handling

Frontend should handle all possible backend errors:

```typescript
const handleApiError = (error: any) => {
  const status = error?.response?.status;
  const message = error?.response?.data?.message;
  
  switch (status) {
    case 400:
      if (message?.includes('expired')) {
        setPaymentStatus('expired');
      } else {
        showToast(message, 'error');
      }
      break;
    case 404:
      showToast('Payment not found', 'error');
      break;
    case 500:
      showToast('Server error, please try again', 'error');
      break;
  }
};
```

### 3. Add Status Transition Logging

```typescript
// Log all status transitions for debugging
const setPaymentStatusWithLog = (newStatus: PaymentStatusType) => {
  console.log(`[PaymentStatus] ${paymentStatus} → ${newStatus}`);
  setPaymentStatus(newStatus);
};
```

---

## Summary of Required Fixes

| Priority | File | Change |
|----------|------|--------|
| 🔴 HIGH | cryptoTransfer.tsx | Change `grace_period_minutes` default from 15 to 30 |
| 🟡 MEDIUM | cryptoTransfer.tsx | Add "failed" status handler in polling switch |
| 🟡 MEDIUM | cryptoTransfer.tsx | Handle API 400 errors for expired payment links |
| 🟢 LOW | Both | Create shared constants file |
| 🟢 LOW | cryptoTransfer.tsx | Add expired UI component trigger when countdown hits 0 |

---

## Files Analyzed

**Backend:**
- `/app/backend/controller/paymentController.ts` (verifyCryptoPayment, getData, createPaymentLink)
- `/app/backend/models/companyModels/companyModel.ts` (merchant settings)
- `/app/backend/swagger/paths/payment.ts` (API documentation)

**Checkout Frontend:**
- `pages/pay/index.tsx` (main payment page)
- `Components/Page/Pay3Components/cryptoTransfer.tsx` (crypto payment component)
