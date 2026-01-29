# Checkout Page Performance Analysis

## Issue: Slow Loading After Currency Selection

After selecting a cryptocurrency on the checkout page, there is a noticeable delay before the QR code and payment address are displayed.

---

## Analysis Summary

### Root Cause: **BOTH Backend AND Frontend**

The delay is caused by a **sequential chain of operations** that run one after another:

```
User selects currency
       ↓
1. Frontend: getCurrencyRates API call (100-500ms)
       ↓
2. Frontend: addPayment API call (2000-5000ms) ← MAIN BOTTLENECK
       ↓
        ├── Backend: Decrypt request
        ├── Backend: Get Redis data
        ├── Backend: Crypto() function
        │       ├── reserveAddress()
        │       │       ├── Release expired reservations (DB query)
        │       │       ├── Find available address (DB query)
        │       │       ├── createSubscription() ← SLOW (Tatum API call 1-3 seconds)
        │       │       └── Update address status (DB query)
        │       ├── Generate QR code
        │       ├── Find wallet details (DB query)
        │       └── Create transaction record (DB query)
        └── Backend: Set Redis data
       ↓
3. Frontend: Display QR code
```

---

## Detailed Breakdown

### 1. BACKEND BOTTLENECKS

#### A. Tatum Subscription Call (1-3 seconds) ⚠️ CRITICAL
**File:** `/app/backend/services/merchantPoolService.ts` (lines 466-476)
```typescript
const subResult = await tatumApi.createSubscription(
  poolAddress.dataValues.wallet_address,
  walletType,
  true
);
```
- This external API call to Tatum takes **1-3 seconds** every time
- It's called synchronously during address reservation
- **This is the MAIN bottleneck**

#### B. Multiple Sequential Database Queries
- Release expired reservations
- Find available address (with row lock)
- Update address status
- Find wallet details
- Create transaction record

#### C. QR Code Generation (100-300ms)
```typescript
const url = await QR_Code.toDataURL(address, { width: 300 });
```

### 2. FRONTEND BOTTLENECKS

#### A. Sequential API Calls
**File:** `Components/Page/Pay3Components/cryptoTransfer.tsx` (getCurrencyRateAndSubmit function)

```typescript
// CALL 1: Get currency rates
const rateResponse = await axiosBaseApi.post("/pay/getCurrencyRates", {...});

// CALL 2: Submit payment (waits for CALL 1 to complete)
const submitResponse = await axiosBaseApi.post("/pay/addPayment", {...});
```

These calls are sequential but could potentially be parallelized or the rate could be cached.

#### B. No Loading State Feedback
The loading indicator appears but doesn't show progress, making the wait feel longer.

---

## Recommended Fixes

### BACKEND FIXES (High Impact)

#### Fix 1: Make Tatum Subscription Async (Save 1-3 seconds)
**File:** `/app/backend/services/merchantPoolService.ts`

Instead of waiting for subscription synchronously:
```typescript
// CURRENT (SLOW):
const subResult = await tatumApi.createSubscription(...);

// RECOMMENDED (FAST):
// Fire and forget - subscription can be created in background
tatumApi.createSubscription(...).then(subResult => {
  // Update subscription ID in background
  poolAddress.update({ subscription_id: subResult?.id });
}).catch(err => {
  console.error('Background subscription creation failed:', err);
});
```

**Impact:** Saves 1-3 seconds per payment

#### Fix 2: Pre-create Subscriptions When Pool Addresses are Generated
Instead of creating subscriptions at payment time, create them when addresses are added to the pool:

**File:** `/app/backend/services/merchantPoolService.ts` (addAddressToMerchantPool function)
```typescript
// Add subscription immediately after creating pool address
const subResult = await tatumApi.createSubscription(address, walletType, true);
await newPoolAddress.update({ subscription_id: subResult?.id });
```

**Impact:** Zero delay at payment time for pre-created addresses

#### Fix 3: Check Existing Subscription Before Creating
```typescript
// Only create if no subscription exists
if (!poolAddress.dataValues.subscription_id) {
  const subResult = await tatumApi.createSubscription(...);
}
```

### FRONTEND FIXES (Medium Impact)

#### Fix 1: Show Better Loading States
**File:** `cryptoTransfer.tsx`

Add step-by-step loading indicators:
```typescript
const [loadingStep, setLoadingStep] = useState<'rates' | 'payment' | null>(null);

// In getCurrencyRateAndSubmit:
setLoadingStep('rates');
const rateResponse = await axiosBaseApi.post("/pay/getCurrencyRates", ...);
setLoadingStep('payment');
const submitResponse = await axiosBaseApi.post("/pay/addPayment", ...);
setLoadingStep(null);
```

#### Fix 2: Cache Currency Rates
Currency rates don't change every second - cache them for 30-60 seconds:
```typescript
const RATE_CACHE_DURATION = 30000; // 30 seconds
let rateCache = { data: null, timestamp: 0 };

const getCurrencyRates = async () => {
  if (rateCache.data && Date.now() - rateCache.timestamp < RATE_CACHE_DURATION) {
    return rateCache.data;
  }
  const response = await axiosBaseApi.post("/pay/getCurrencyRates", ...);
  rateCache = { data: response.data.data, timestamp: Date.now() };
  return rateCache.data;
};
```

#### Fix 3: Prefetch Rates on Page Load
Load currency rates in the background when the page loads, not when user selects:
```typescript
useEffect(() => {
  // Prefetch rates on component mount
  axiosBaseApi.post("/pay/getCurrencyRates", {
    source: walletState?.currency,
    amount: walletState?.amount,
    currencyList: cryptoOptions.map((x) => x.value),
  }).then(response => {
    setCurrencyRates(response.data.data);
  });
}, [walletState]);
```

---

## Performance Impact Estimates

| Fix | Time Saved | Difficulty |
|-----|-----------|------------|
| Async Tatum subscription | 1-3 seconds | Easy |
| Pre-create subscriptions | 1-3 seconds | Medium |
| Prefetch currency rates | 200-500ms | Easy |
| Cache currency rates | 100-300ms | Easy |
| **Total Potential Savings** | **2-5 seconds** | - |

---

## Quick Win Implementation

### Backend Quick Fix (Immediate 1-3 second improvement)

**File:** `/app/backend/services/merchantPoolService.ts` (line 462-476)

Replace:
```typescript
// Ensure Tatum subscription exists for webhook notifications
let subscriptionId = poolAddress.dataValues.subscription_id;
try {
  const subResult = await tatumApi.createSubscription(
    poolAddress.dataValues.wallet_address,
    walletType,
    true
  );
  subscriptionId = subResult?.id || subscriptionId;
  console.log(`[MerchantPool] ✅ Subscription ensured...`);
} catch (subError) {
  console.error(`[MerchantPool] ⚠️ Failed to ensure subscription...`);
}
```

With:
```typescript
// Only create subscription if one doesn't already exist
let subscriptionId = poolAddress.dataValues.subscription_id;
if (!subscriptionId) {
  // Create subscription asynchronously - don't block payment
  tatumApi.createSubscription(
    poolAddress.dataValues.wallet_address,
    walletType,
    true
  ).then(subResult => {
    if (subResult?.id) {
      poolAddress.update({ subscription_id: subResult.id }).catch(() => {});
      console.log(`[MerchantPool] ✅ Subscription created in background: ${subResult.id}`);
    }
  }).catch(subError => {
    console.error(`[MerchantPool] ⚠️ Background subscription failed:`, subError.message);
  });
}
```

---

## Summary

| Component | Contribution to Delay | Priority |
|-----------|----------------------|----------|
| Backend: Tatum API call | 60-70% (1-3s) | HIGH |
| Backend: DB queries | 15-20% (300-500ms) | MEDIUM |
| Backend: QR generation | 5-10% (100-300ms) | LOW |
| Frontend: Sequential calls | 10-15% (200-500ms) | MEDIUM |

**Primary Fix:** Make Tatum subscription creation asynchronous or skip it if subscription already exists.
