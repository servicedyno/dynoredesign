# Payment Timing Analysis - Checkout Page

## Overview
Analysis of how payment timing (invoice expiry, payment window, grace period) is passed from backend to checkout page.

---

## ✅ FIX IMPLEMENTED

### Added `payment_settings` to getData Response

The `getData` endpoint now returns payment timing settings upfront:

```json
{
  "data": {
    "amount": 50,
    "base_currency": "USD",
    "merchant": { ... },
    "payment_settings": {
      "initial_window_minutes": 15,
      "grace_period_minutes": 30,
      "overpayment_threshold_usd": 5
    },
    "expiry": { ... }
  }
}
```

### Changes Made:
1. **Fetch company settings early** in `getData` function
2. **Pass payment_settings** in all response payloads
3. **Use dynamic grace_period** for `incomplete_payment.remaining_minutes` calculation
4. **Updated Swagger documentation** with new field

---

## Timing Components

### 1. Invoice/Payment Link Expiry
**Source:** Created when payment link is generated
**Options:**
- 24 hours (`expire: '24h'`)
- 7 days (`expire: '7d'`)
- 30 days (`expire: '30d'`)
- No expiry (null)

**Passed via:** `expiry` field with countdown ✅

### 2. Payment Window (15 minutes)
**Purpose:** Time allowed for customer to complete initial payment after selecting crypto
**Default:** 15 minutes
**Passed via:** `payment_settings.initial_window_minutes` ✅ (NEW)

### 3. Grace Period (30 minutes default, configurable)
**Purpose:** Time allowed for customer to complete partial/underpayment
**Default:** 30 minutes
**Configurable:** Per-company via `grace_period_minutes` field in tbl_company
**Passed via:** `payment_settings.grace_period_minutes` ✅ (NEW)

### 4. Overpayment Threshold
**Purpose:** Minimum overpayment amount to trigger special handling
**Default:** $5 USD
**Configurable:** Per-company via `overpayment_threshold_usd` field in tbl_company
**Passed via:** `payment_settings.overpayment_threshold_usd` ✅ (NEW)

---

## Data Flow to Checkout (UPDATED)

### Step 1: getData (Initial Page Load)
**Endpoint:** `POST /api/pay/getData`
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
  "payment_settings": {
    "initial_window_minutes": 15,
    "grace_period_minutes": 30,
    "overpayment_threshold_usd": 5
  },
  "incomplete_payment": {
    "remaining_minutes": 25  // Uses grace_period_minutes
  }
}
```
✅ **ALL TIMING INFO NOW PASSED**

### Step 2: verifyCryptoPayment (Payment Status Polling)
**Endpoint:** `GET /api/pay/verifyCryptoPayment?address={addr}`
**Returns:**
```json
{
  "remaining_seconds": 900,
  "grace_period_minutes": 30,
  "merchant_settings": {
    "overpayment_threshold_usd": 5,
    "grace_period_minutes": 30
  }
}
```
✅ **CONSISTENT WITH getData**

---

## Checkout Page Integration Guide

### For Checkout Page Developers:

```javascript
// 1. On page load (getData response)
const { payment_settings, expiry } = response.data;

// Display invoice expiry countdown
if (expiry?.countdown) {
  showCountdown(expiry.countdown.formatted);  // "6d : 23h : 45m : 30s"
}

// Store timing settings for later use
const PAYMENT_WINDOW_MINUTES = payment_settings.initial_window_minutes;  // 15
const GRACE_PERIOD_MINUTES = payment_settings.grace_period_minutes;      // 30

// 2. After customer selects crypto (start payment window timer)
startTimer(PAYMENT_WINDOW_MINUTES * 60);  // 15 minutes = 900 seconds

// 3. On partial payment (extend timer with grace period)
if (status === 'underpaid') {
  startTimer(GRACE_PERIOD_MINUTES * 60);  // 30 minutes = 1800 seconds
}
```

---

## Files Modified

1. **`/app/backend/controller/paymentController.ts`**
   - Lines 295-325: Fetch company settings including grace_period_minutes and overpayment_threshold_usd
   - Lines 500, 563, 607: Added `payment_settings` to all response payloads
   - Lines 534, 588, 633: Updated remaining_minutes calculation to use paymentSettings.grace_period_minutes

2. **`/app/backend/swagger/paths/payment.ts`**
   - Updated getData endpoint documentation with payment_settings field
   - Added examples showing the new field

---

## Summary

| Timing Info | Before | After |
|-------------|--------|-------|
| Invoice expiry | ✅ Passed in getData | ✅ Still passed |
| Payment window (15 min) | ❌ Not passed | ✅ `payment_settings.initial_window_minutes` |
| Grace period (30 min) | ❌ Only in verifyCryptoPayment | ✅ `payment_settings.grace_period_minutes` |
| Overpayment threshold | ❌ Only in verifyCryptoPayment | ✅ `payment_settings.overpayment_threshold_usd` |

---

Generated: 2026-02-02
Updated: 2026-02-02 (Post-Fix)
