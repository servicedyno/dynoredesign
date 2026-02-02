# Payment Timing Analysis - Checkout Page

## Overview
Analysis of how payment timing (invoice expiry, payment window, grace period) is passed from backend to checkout page.

---

## Timing Components

### 1. Invoice/Payment Link Expiry
**Source:** Created when payment link is generated
**Options:**
- 24 hours (`expire: '24h'`)
- 7 days (`expire: '7d'`)
- 30 days (`expire: '30d'`)
- No expiry (null)

**Code Location:** `paymentController.ts` lines 4144-4153
```typescript
let expires_at = null;
if (expire === "24h") {
  expires_at = new Date(now.getTime() + 24 * 60 * 60 * 1000);
} else if (expire === "7d") {
  expires_at = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
} else if (expire === "30d") {
  expires_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}
```

### 2. Payment Window (15 minutes)
**Purpose:** Time allowed for customer to complete initial payment after selecting crypto
**Default:** 15 minutes
**Source:** Hardcoded default in `verifyCryptoPayment`

### 3. Grace Period (30 minutes)
**Purpose:** Time allowed for customer to complete partial/underpayment
**Default:** 30 minutes
**Configurable:** Per-company via `grace_period_minutes` field
**Source:** `companyModel.ts` line 88-93

---

## Data Flow to Checkout

### Step 1: getData (Initial Page Load)
**Endpoint:** `GET /api/pay?d={uniqueRef}`
**Returns:**
```json
{
  "expiry": {
    "expires_at": "2026-02-03T14:00:00Z",
    "is_expired": false,
    "countdown": {
      "days": 0,
      "hours": 23,
      "minutes": 45,
      "seconds": 30,
      "formatted": "0d : 23h : 45m : 30s"
    }
  },
  "incomplete_payment": {
    "remaining_minutes": 25  // For partial payments only
  }
}
```
✅ **PASSED CORRECTLY**

### Step 2: verifyCryptoPayment (Payment Status Polling)
**Endpoint:** `GET /api/pay/verifyCryptoPayment?address={addr}`
**Returns:**
```json
{
  "remaining_seconds": 900,        // ✅ PASSED
  "grace_period_minutes": 30,      // ✅ PASSED
  "merchant_settings": {
    "overpayment_threshold_usd": 5,
    "grace_period_minutes": 30
  }
}
```
✅ **PASSED CORRECTLY**

---

## ⚠️ IDENTIFIED ISSUES

### Issue 1: Initial Payment Window Not Explicitly Passed
**Problem:** The 15-minute payment window is not explicitly communicated in `getData` response.

**Current Behavior:**
- `getData` returns `expiry` (invoice-level expiry: 24h/7d/30d)
- But does NOT return `payment_window_minutes` (the 15-min crypto payment window)

**Impact:** 
- Checkout page cannot show accurate countdown for payment window
- Only invoice expiry is shown, not crypto address validity

**Location:** `paymentController.ts` getData function (lines 345-378)

### Issue 2: Payment Window vs Invoice Expiry Confusion
**Problem:** Two different timers exist:
1. **Invoice Expiry:** How long the payment link is valid (24h/7d/30d/never)
2. **Payment Window:** How long the crypto address is valid (15 min)

**Current State:**
- Invoice expiry is passed via `expiry` field ✅
- Payment window (15 min) is only inferred when no `expires_at` exists

### Issue 3: Grace Period Only in verifyCryptoPayment
**Problem:** `grace_period_minutes` is only returned AFTER payment starts polling.

**Ideal:** Should be passed in initial `getData` so checkout can display policy upfront.

---

## RECOMMENDED FIXES

### Fix 1: Add Payment Window to getData Response
Add a new field to pass payment window timing:
```typescript
// In getData response:
{
  "payment_settings": {
    "initial_window_minutes": 15,      // Time to pay after selecting crypto
    "grace_period_minutes": 30,        // Time to complete partial payment
    "overpayment_threshold_usd": 5     // Minimum overpayment to handle
  }
}
```

### Fix 2: Fetch Company Settings in getData
Currently company settings are only fetched in `verifyCryptoPayment`. 
Should also fetch in `getData` for consistent display.

### Fix 3: Document Timing Behavior for Checkout
Ensure checkout page knows:
- Invoice expiry = when payment link becomes invalid
- Payment window = when crypto address expires (15 min default)
- Grace period = time to complete underpayment (30 min default)

---

## Files to Modify

1. **`/app/backend/controller/paymentController.ts`**
   - Enhance `getData` to include payment window settings
   - Fetch company settings (grace_period_minutes) earlier

2. **Checkout Page (separate repo)**
   - Consume new `payment_settings` field
   - Show appropriate countdown based on context

---

## Current Timing Flow Summary

```
1. Invoice Created (createPaymentLink)
   └── expires_at set (24h/7d/30d or null)

2. Checkout Page Loaded (getData)
   └── Returns: expiry countdown ✅
   └── Missing: payment_window_minutes ⚠️
   └── Missing: grace_period_minutes ⚠️

3. Crypto Selected (getCurrencyRates)
   └── Address generated
   └── 15-min window starts (implicit)

4. Payment Polling (verifyCryptoPayment)
   └── Returns: remaining_seconds ✅
   └── Returns: grace_period_minutes ✅
   └── Returns: merchant_settings ✅

5. Partial Payment Detected
   └── Grace period starts (30 min)
   └── remaining_minutes passed ✅
```

---

Generated: 2026-02-02
