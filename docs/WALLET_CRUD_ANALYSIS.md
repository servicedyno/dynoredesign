# CRUD Analysis: Multi-Tenant Wallet Model (userWalletModel)

## Current Status

### ✅ CREATE (Add Wallet) - WITH OTP
**Endpoints:**
1. `POST /api/wallet/validateWalletAddress` (Step 1: Validate + Send OTP)
2. `POST /api/wallet/verifyOtp` (Step 2: Verify OTP + Save)

**Status:** ✅ COMPLETE
**OTP Required:** ✅ YES
**Multi-Tenant:** ✅ YES

---

### ✅ READ (Get Wallets) - NO OTP
**Endpoint:**
- `GET /api/wallet/getWallet?company_id={id}`

**Status:** ✅ COMPLETE
**OTP Required:** ❌ NO (read-only)
**Multi-Tenant:** ✅ YES

---

### ❌ UPDATE (Edit Wallet) - MISSING!
**Current Status:** NOT IMPLEMENTED for userWalletModel
**What Exists:** Only for legacy table (userWalletAddressModel)

**What's Missing:**
- No update endpoint for main payment forwarding wallets
- Cannot change wallet address after creation
- Cannot rename wallet

**Should Have:**
1. `POST /api/wallet/updateWallet/send-otp` (Step 1: Send OTP)
2. `POST /api/wallet/updateWallet` (Step 2: Verify OTP + Update)

**OTP Required:** ✅ SHOULD BE YES
**Multi-Tenant:** ✅ SHOULD USE company_id

---

### ⚠️ DELETE (Remove Wallet) - NO OTP!
**Endpoints:**
1. `POST /api/wallet/wallet/delete`
2. `DELETE /api/wallet/wallet/{wallet_id}`

**Status:** ✅ EXISTS but ❌ NO OTP PROTECTION
**OTP Required:** ❌ NO (SHOULD BE YES!)
**Multi-Tenant:** ✅ YES

**Security Risk:** Delete operations are permanent and should require OTP!

---

## Summary

| Operation | Endpoint | OTP? | Multi-Tenant? | Status |
|-----------|----------|------|---------------|--------|
| CREATE | validateWalletAddress + verifyOtp | ✅ YES | ✅ YES | ✅ COMPLETE |
| READ | getWallet | ❌ NO | ✅ YES | ✅ COMPLETE |
| UPDATE | ❌ MISSING | ⚠️ N/A | ⚠️ N/A | ❌ NOT IMPLEMENTED |
| DELETE | wallet/delete | ❌ NO | ✅ YES | ⚠️ MISSING OTP |

## Recommendation

### 1. Add UPDATE functionality (High Priority)
Merchants need to update wallet addresses when:
- Changing to a new wallet
- Fixing incorrect address
- Switching to different exchange

### 2. Add OTP to DELETE (High Priority - Security)
Delete operations are permanent and should require OTP verification

### 3. Complete CRUD with OTP protection
All CUD operations should require OTP for security
