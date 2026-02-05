# DynoPay - Crypto Payment Platform PRD

## Original Problem Statement
Build and maintain a full-stack cryptocurrency payment platform allowing merchants to accept crypto payments with multi-tenant support, payment links, and flexible fee structures.

## What's Been Implemented

### Session: February 4, 2026 (Latest)

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
- Adding wallet address
- Updating wallet address
- Deleting wallet address
- Any OTP-verified wallet modification

## Key API Endpoints

| Endpoint | Cache | Invalidation |
|----------|-------|--------------|
| `GET /api/wallet/getWallet` | 30 sec | On any wallet modification |
| `GET /api/wallet/getWalletAddresses` | No cache | Real-time |
| `POST /api/wallet/addWallet` | N/A | Triggers invalidation |
| `DELETE /api/wallet/deleteWallet` | N/A | Triggers invalidation |

## Prioritized Backlog

### P0 (Critical)
- [x] ~~Wallet cache invalidation bug~~ ✅ COMPLETE
- [x] ~~Fee calculator multi-currency~~ ✅ COMPLETE
- [x] ~~Non-USD currency fix~~ ✅ COMPLETE

### P1 (High)
- [ ] Frontend implementation for accepted_currencies selector
- [ ] Frontend for fee payer options

### P2 (Medium)
- [ ] High effort code cleaning
- [ ] Security monitoring dashboards

## Test Credentials
- Email: richard@dyno.pt
- Password: Katiekendra123@
- Company ID: 38
