# DynoPay - Crypto Payment Platform PRD

## Original Problem Statement
Build and maintain a full-stack cryptocurrency payment platform allowing merchants to accept crypto payments with multi-tenant support, payment links, and flexible fee structures.

## What's Been Implemented

### Session: February 5, 2026 (Latest)

#### Webhook Improvements ✅ COMPLETE
- **Issue**: Webhook failures showed empty error messages and misleading "sent successfully" logs
- **Root Cause**: Merchant used `localhost:8000` URL which is unreachable from cloud servers
- **Fixes Applied**:
  1. Added `WebhookResult` return type to track success/failure
  2. Added localhost/127.0.0.1 URL validation with clear error message
  3. Improved error messages for ECONNREFUSED, ETIMEDOUT
  4. Fixed misleading "sent successfully" log - now only shows on actual success
  5. Updated all webhook callers to handle the result properly
- **Documentation**: Added comprehensive webhook URL requirements section to `docs/WEBHOOK_INTEGRATION.md`
- **Files Modified**: `webhooks/index.ts`, `controller/paymentController.ts`, `docs/WEBHOOK_INTEGRATION.md`

#### Database Cleanup ✅ COMPLETE
- Cleared 28 orphaned wallet records (wallets with addresses but no company assignment)
- These were legacy records from before multi-tenant company support

#### getWallet API Fix (P0 Bug) ✅ COMPLETE
- **Issue**: `GET /api/wallet/getWallet?company_id=12` was returning only 1 wallet instead of 4
- **Root Cause**: Stale cache data from before cache invalidation was implemented
- **Investigation**: Verified 4 wallets exist in `tbl_user_wallet` for company 12 (BTC, LTC, DOGE, ETH)
- **Fix**: 
  1. Cleared stale Redis cache for user 16
  2. Added `invalidateWalletCache()` call to `verifyOtp` function (line 2931)
- **Result**: API now correctly returns all 4 wallets

### Session: February 4, 2026

#### Wallet Cache Invalidation Fix (Critical Bug)
- ✅ **Root Cause**: Wallet cache was not being cleared when wallets were added/updated/deleted
- ✅ **Symptom**: Deleted wallets still appeared in GET API, but delete API returned "not found"
- ✅ **Fix Applied**: Added `invalidateWalletCache()` function that clears all wallet-related cache keys
- ✅ **Functions Updated**:
  - `deleteWalletAddress` - Now invalidates cache after deletion
  - `deleteWalletAddressWithOTP` - Now invalidates cache after OTP-verified deletion
  - `addWalletAddress` - Now invalidates cache after adding new wallet
  - `updateWalletWithOTP` - Now invalidates cache after OTP-verified update
  - `editWalletAddress` - Now invalidates cache after editing
  - `deletePaymentWalletWithOTP` - Now invalidates cache after deletion
  - `verifyOtp` - NOW invalidates cache after wallet creation/update (NEW FIX)

#### Fee Calculator Multi-Currency Support
- ✅ `POST /api/pay/calculateFees` supports 40+ fiat currencies
- ✅ 60% promotional discount applied
- ✅ Public endpoint (no auth required)

#### Non-USD Currency Fix
- ✅ Fee tier calculation uses USD equivalent
- ✅ All currency conversions working correctly

#### API Documentation & Currency Selection
- ✅ Swagger documentation updated
- ✅ Currency selection architecture fixed

## Cache Architecture

**Cache Keys Format:**
- `wallet:{userId}:{companyId}:v2` - Wallet data cache (30-second TTL)
- `dashboard:{userId}:{companyId}` - Dashboard data cache

**Cache Invalidation Triggers:**
- Adding wallet address (via `addWalletAddress`)
- Creating/updating wallet via OTP verification (via `verifyOtp`)
- Updating wallet address (via `updateWalletWithOTP`, `editWalletAddress`)
- Deleting wallet address (via `deleteWalletAddress`, `deleteWalletAddressWithOTP`, `deletePaymentWalletWithOTP`)

**Cache Invalidation Function Locations:**
- Line 59: Function definition
- Line 1970: `addWalletAddress`
- Line 2931: `verifyOtp` (NEW)
- Line 3045: `deleteWalletAddress`
- Line 3264: `updateWalletWithOTP`
- Line 3497: `deleteWalletAddressWithOTP`
- Line 3710: `editWalletAddress`
- Line 3903: `deletePaymentWalletWithOTP`

## Key API Endpoints

| Endpoint | Cache | Invalidation |
|----------|-------|--------------|
| `GET /api/wallet/getWallet` | 30 sec | On any wallet modification |
| `GET /api/wallet/getWalletAddresses` | No cache | Real-time |
| `POST /api/wallet/validateWalletAddress` | N/A | Step 1 - Send OTP |
| `POST /api/wallet/verifyOtp` | N/A | Step 2 - Triggers invalidation |
| `DELETE /api/wallet/deleteWallet` | N/A | Triggers invalidation |

## Database Tables

| Table | Purpose |
|-------|---------|
| `tbl_user_wallet` | Primary wallet records (includes FIAT and CRYPTO) |
| `tbl_user_addresses` | Additional saved addresses for withdrawals |
| `tbl_company` | Company/merchant information |

## Prioritized Backlog

### P0 (Critical)
- [x] ~~getWallet API returning incomplete data~~ ✅ COMPLETE (Feb 5)
- [x] ~~Wallet cache invalidation bug~~ ✅ COMPLETE
- [x] ~~Fee calculator multi-currency~~ ✅ COMPLETE
- [x] ~~Non-USD currency fix~~ ✅ COMPLETE

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options

### P2 (Medium)
- [ ] High effort code cleaning
- [ ] Security monitoring dashboards
- [ ] Fee comparison tool

## Test Credentials
- Primary Test User:
  - Email: richard@dyno.pt
  - Password: Katiekendra123@
  - Companies: 38, 39, 41, 42
  
- User with Company 12:
  - Email: dharmikgodhani1705@gmail.com
  - Password: TestPassword123!
  - Company ID: 12 (4 wallets: BTC, LTC, DOGE, ETH)
