# DynoCheckoutFIX - Comprehensive Bug Fixes & Improvements

## Repository: https://github.com/Moxxcompany/DynoCheckoutFIX
## Branch: Checkout-Fixes2

---

## 🔴 CRITICAL BUG FIXES

### Issue 1: Checkout Page Doesn't Move to Confirmation After Completion Payment

**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

**Root Cause:** When underpayment is detected, `clearInterval(pollInterval)` is called at line 547. When user clicks "Pay with Crypto" to complete the remaining payment, the polling doesn't properly restart because:
1. The `handlePayRemaining` function sets states but doesn't trigger a new poll
2. The polling `useEffect` depends on `[selectedCrypto, cryptoDetails?.address, dispatch, selectedNetwork, walletState?.currency]`
3. None of these change when continuing with crypto, so polling never restarts

**Fix Required:**

Add a `pollingTrigger` state and restart polling mechanism:

```tsx
// Line ~170 - Add new state
const [pollingTrigger, setPollingTrigger] = useState(0);

// Line ~677 - In handlePayRemaining, after clearing states
const handlePayRemaining = (method: "bank" | "crypto") => {
  if (method === "crypto") {
    // ... existing code ...
    
    setPaymentStatus("waiting");
    setIsStart(false);
    setIsReceived(false);
    setPartialPaymentData(null);
    
    // ADD THIS: Force polling to restart
    setPollingTrigger(prev => prev + 1);
  } else {
    // ... bank transfer code
  }
};

// Line ~615 - Add pollingTrigger to useEffect dependencies
}, [selectedCrypto, cryptoDetails?.address, dispatch, selectedNetwork, walletState?.currency, pollingTrigger]);
```

**Alternative Fix (Simpler):** Create a ref for the interval and manually restart:

```tsx
// Line ~145 - Add ref
const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

// Line ~487 - Store interval in ref
pollIntervalRef.current = setInterval(async () => {
  // ... polling logic
}, 15000);

// Line ~613 - Cleanup
return () => {
  if (pollIntervalRef.current) {
    clearInterval(pollIntervalRef.current);
  }
};

// Line ~677 - In handlePayRemaining, manually trigger immediate poll
const handlePayRemaining = (method: "bank" | "crypto") => {
  if (method === "crypto") {
    // ... existing state updates ...
    
    // Immediately do one poll, then let the interval continue
    setTimeout(async () => {
      try {
        const response = await axiosBaseApi.post("/pay/verifyCryptoPayment", {
          address: cryptoDetails?.address,
        });
        // Handle response same as in polling logic
        const data = response?.data?.data;
        const status = data?.status;
        setPaymentStatus(status);
        // ... handle status switch cases
      } catch (e) {
        console.error("Manual poll error:", e);
      }
    }, 1000);
  }
};
```

---

### Issue 2: Timer Not Resetting for 30-Minute Grace Period

**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

**Root Cause:** Timer is initialized once at line 162 with `useState(14 * 60 + 21)` and never reset when underpayment occurs or when continuing to pay.

**Fix Required:**

```tsx
// Line ~677 - In handlePayRemaining function
const handlePayRemaining = (method: "bank" | "crypto") => {
  if (method === "crypto") {
    // IMPORTANT: Keep the same address for partial payment completion
    
    if (partialPaymentData) {
      // Store remaining payment info for display
      setRemainingPaymentInfo({
        remainingAmount: partialPaymentData.remainingAmount,
        remainingAmountUsd: partialPaymentData.remainingAmountUsd || 0,
        currency: partialPaymentData.currency,
      });
      
      // ... existing selectedCurrency update ...
      
      setIsPartialPaymentMode(true);
    }
    
    // ADD THIS: Reset timer to 30 minutes for grace period
    setTimeLeft(30 * 60); // 30 minutes = 1800 seconds
    
    setPaymentStatus("waiting");
    setIsStart(false);
    setIsReceived(false);
    setPartialPaymentData(null);
  } else {
    // Bank transfer - also reset timer
    setTimeLeft(30 * 60);
    // ... existing code
  }
};
```

---

## 🟡 HARDCODED VALUES THAT SHOULD BE DYNAMIC

### 1. Initial Timer Value
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`, Line 162

**Current:** `const [timeLeft, setTimeLeft] = useState(14 * 60 + 21);` (14:21)

**Problem:** The timer starts at 14:21 which seems arbitrary. Should come from backend.

**Fix:**
```tsx
// Should get from payment link data or props
const [timeLeft, setTimeLeft] = useState(() => {
  // Get from payment data if available
  return walletState?.expirySeconds || 15 * 60; // Default 15 minutes
});
```

### 2. Polling Interval
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`, Line 611

**Current:** `}, 15000);` (15 seconds hardcoded)

**Problem:** Polling interval should be configurable based on network/chain.

**Fix:**
```tsx
// Add constant at top of file
const POLLING_INTERVALS = {
  BTC: 30000,  // 30 seconds for BTC (slower confirmations)
  ETH: 15000,  // 15 seconds for ETH
  TRX: 10000,  // 10 seconds for TRX (faster)
  DEFAULT: 15000,
};

// In useEffect
const pollingInterval = POLLING_INTERVALS[selectedCrypto as keyof typeof POLLING_INTERVALS] 
  || POLLING_INTERVALS.DEFAULT;

const pollInterval = setInterval(async () => {
  // ... polling logic
}, pollingInterval);
```

### 3. Rate Cache Duration
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`, Line 87

**Current:** `const RATE_CACHE_DURATION_MS = 30000; // 30 seconds`

**Recommendation:** This is okay as constant but should be documented.

### 4. Bank Transfer Timer
**File:** `Components/Page/Pay3Components/bankTransferCompo.tsx`, Line 52

**Current:** `const [timeLeft, setTimeLeft] = useState(30 * 60);`

**Recommendation:** Should be consistent with crypto timer and come from backend.

### 5. Overpayment Threshold
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`, Lines 556-557

**Current:** 
```tsx
const excessUsd = data?.excessAmountUsd || 0;
const OVERPAYMENT_THRESHOLD_USD = 5;
```

**Recommendation:** Should come from merchant settings via backend.

```tsx
// Get from payment config
const OVERPAYMENT_THRESHOLD_USD = walletState?.overpaymentThreshold || 5;
```

### 6. Grace Period Message
**File:** `Components/UI/UnderPayment/Index.tsx`, Line 143

**Current:** `⏰ Please complete payment within 30 minutes to use the same address.`

**Fix:** Should use dynamic value:
```tsx
// Add prop to UnderPayment component
graceMinutes?: number;

// Use in message
`⏰ Please complete payment within ${graceMinutes || 30} minutes to use the same address.`
```

---

## 🟢 UX IMPROVEMENTS

### 1. Add Loading State During Poll
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

```tsx
// Add state
const [isPolling, setIsPolling] = useState(false);

// In polling useEffect
const pollInterval = setInterval(async () => {
  setIsPolling(true);
  try {
    // ... existing code
  } finally {
    setIsPolling(false);
  }
}, 15000);

// Show subtle indicator in UI
{isPolling && <CircularProgress size={12} sx={{ ml: 1 }} />}
```

### 2. Add Countdown Warning When Timer < 5 Minutes
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

```tsx
// In timer display section
const isLowTime = timeLeft < 5 * 60; // Less than 5 minutes

<Typography
  color={isLowTime ? "error" : "inherit"}
  sx={{ 
    animation: isLowTime ? 'pulse 1s infinite' : 'none',
    fontWeight: isLowTime ? 'bold' : 'normal'
  }}
>
  {formatTime(timeLeft)}
</Typography>
```

### 3. Add Visual Progress for Partial Payments
**File:** `Components/UI/UnderPayment/Index.tsx`

```tsx
// Add progress bar showing payment completion
import LinearProgress from '@mui/material/LinearProgress';

const progressPercent = (paidAmount / expectedAmount) * 100;

<Box sx={{ width: '100%', mb: 2 }}>
  <LinearProgress 
    variant="determinate" 
    value={progressPercent} 
    sx={{ 
      height: 10, 
      borderRadius: 5,
      backgroundColor: '#E5E7EB',
      '& .MuiLinearProgress-bar': {
        backgroundColor: '#10B981',
      }
    }}
  />
  <Typography variant="caption" sx={{ mt: 0.5 }}>
    {progressPercent.toFixed(0)}% paid
  </Typography>
</Box>
```

### 4. Add Copy Feedback Toast
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

**Current:** Only sets `setCopied(true)` which may not be visible.

**Fix:**
```tsx
const handleCopy = () => {
  navigator.clipboard.writeText(cryptoDetails.address);
  setCopied(true);
  dispatch({
    type: TOAST_SHOW,
    payload: {
      message: "Address copied to clipboard!",
      severity: "success",
    },
  });
  setTimeout(() => setCopied(false), 2000);
};
```

### 5. Add Network Fee Warning for Small Payments
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

```tsx
// Before showing payment amount
const networkFeeEstimate = selectedCrypto === 'ETH' ? 0.0001 : 
                           selectedCrypto === 'BTC' ? 0.00001 : 0;
const isSmallPayment = selectedCurrency?.amount < networkFeeEstimate * 10;

{isSmallPayment && (
  <Alert severity="warning" sx={{ mb: 2 }}>
    Note: Network fees may be significant for this payment amount.
  </Alert>
)}
```

### 6. Improve Error Handling in Polling
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`, Line 601-609

**Current:** Errors are silently caught (commented out toast).

**Fix:**
```tsx
} catch (e: any) {
  const message = e?.response?.data?.message ?? e?.message;
  console.error("Payment verification error:", message);
  
  // Only show error toast after multiple failures
  pollErrorCount.current = (pollErrorCount.current || 0) + 1;
  
  if (pollErrorCount.current >= 3) {
    dispatch({
      type: TOAST_SHOW,
      payload: {
        message: "Having trouble verifying payment. Please wait...",
        severity: 'warning'
      }
    });
    pollErrorCount.current = 0;
  }
}
```

### 7. Add Retry Button for Failed Payments
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx`

After the `failed` status case, add a retry mechanism:

```tsx
case "failed":
  setIsStart(true);
  setIsReceived(false);
  setPaymentStatus("failed");
  clearInterval(pollInterval);
  break;

// In render, add retry button
{paymentStatus === "failed" && (
  <Box textAlign="center" mt={2}>
    <Button 
      variant="outlined" 
      onClick={() => {
        setPaymentStatus("waiting");
        setPollingTrigger(prev => prev + 1);
      }}
    >
      Retry Verification
    </Button>
  </Box>
)}
```

---

## 📋 SUMMARY OF ALL AFFECTED FILES

| File | Changes Required | Priority |
|------|-----------------|----------|
| `Components/Page/Pay3Components/cryptoTransfer.tsx` | Timer reset, Polling restart, Multiple UX improvements | 🔴 Critical |
| `Components/UI/UnderPayment/Index.tsx` | Dynamic grace period, Progress bar | 🟡 Medium |
| `Components/Page/Pay3Components/bankTransferCompo.tsx` | Timer consistency | 🟢 Low |
| `axiosConfig.ts` | No changes needed | - |

---

## 🔧 IMPLEMENTATION ORDER

1. **First:** Fix Issue 1 (Polling restart) - Critical for payment flow
2. **Second:** Fix Issue 2 (Timer reset) - Critical for user experience
3. **Third:** Add dynamic values for timers and thresholds
4. **Fourth:** UX improvements (progress bar, warnings, etc.)

---

## 🧪 TESTING CHECKLIST

After implementing fixes, test these scenarios:

- [ ] Normal full payment → Confirmation screen appears
- [ ] Partial payment → Underpayment screen appears  
- [ ] Complete remaining via crypto → Timer resets to 30 min
- [ ] Complete remaining via crypto → Polling restarts immediately
- [ ] Complete remaining → Confirmation screen appears
- [ ] Timer expires → Appropriate message shown
- [ ] Multiple partial payments → Each accumulates correctly
- [ ] Overpayment → Overpayment screen appears (if > $5)
- [ ] Network switch during payment → Handles gracefully

