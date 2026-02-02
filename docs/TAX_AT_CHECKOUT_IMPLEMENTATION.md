# Tax at Checkout - Implementation Complete

## Overview

This document describes the tax at checkout feature where:
1. **Tax is OFF by default** - No tax applied unless merchant explicitly enables it
2. **Merchant enables during payment link creation** - Using `apply_tax: true` parameter
3. **Tax calculated based on customer location** - Detected automatically from IP at checkout
4. **Uses existing Tax API** - APILayer Tax Data API with fallback rates

---

## Implementation Status: ✅ COMPLETE

### Backend Changes Made

| Component | Status | Details |
|-----------|--------|---------|
| **Payment Link Model** | ✅ Done | Added `apply_tax` boolean field (default: false) |
| **createPaymentLink API** | ✅ Done | Accepts `apply_tax` parameter |
| **getData API** | ✅ Done | Auto-detects country & calculates tax |
| **Geolocation Utility** | ✅ Done | `/app/backend/utils/geolocation.ts` |
| **Database Migration** | ✅ Done | `apply_tax` column added to tbl_payment_link |

---

## How It Works
