# BCH Merchant Wallet Configuration - MISSING ❌

## Issue Confirmed

You are **100% correct!** The BCH merchant wallet has NOT been configured for company 38 (user 28 - john@dyno.pt).

---

## Current Status

### ❌ Merchant Wallet Table (tbl_merchant_wallet)
```
User 28 (john@dyno.pt): 0 wallets configured
BCH wallet: NOT FOUND
```

**Result:** Cannot generate BCH payment addresses because no xpub/mnemonic is configured.

### ✅ User Wallet Table (tbl_user_wallet)  
```
User 28 has wallets for: BTC, DOGE, ETH, LTC, TRX, USDT-ERC20, USDT-TRC20
BCH: NOT in the list
```

**Note:** These are admin wallets for receiving swept funds, NOT for generating customer payment addresses.

---

## What's Missing

### Merchant Pool System Requirements:

For BCH to work, we need an entry in `tbl_merchant_wallet`:

```sql
INSERT INTO tbl_merchant_wallet (
  user_id,
  wallet_type,
  xpub,           -- Extended public key for address derivation
  mnemonic,       -- OR mnemonic phrase (encrypted)
  last_derivation_index
) VALUES (
  28,
  'BCH',
  '<bch_xpub_here>',  -- REQUIRED for address generation
  NULL,               -- OR mnemonic if using that approach
  0
);
```

---

## Why It Doesn't Work

### The Problem:
1. User wallet table has admin BCH address: ✅
2. Merchant wallet table has BCH xpub/mnemonic: ❌ **MISSING**
3. Without xpub, merchant pool cannot derive new addresses
4. Payment creation will fail with "wallet not configured"

### The Fix Needed:
Configure BCH merchant wallet with either:
- **Option A:** BCH xpub (extended public key for HD wallet derivation)
- **Option B:** Encrypted mnemonic phrase

---

## How to Configure BCH Wallet

### Option 1: Use Google Cloud KMS (Current System)
The system uses Google Cloud KMS to generate and store xpubs:

```bash
# Environment variables already configured:
PROJECT_ID=newdyno
LOCATION_ID=global
KEY_RING_ID=admin-ring
XPUB_KEY_ID=keys-for-xpubs
```

**Steps:**
1. Generate BCH xpub using GCP KMS
2. Store in `tbl_merchant_wallet` table
3. Merchant pool can then derive BCH addresses

### Option 2: Manual Configuration (Testing)
For testing, you could manually insert a BCH xpub:

```sql
-- Example (use real BCH xpub)
INSERT INTO tbl_merchant_wallet (user_id, wallet_type, xpub, last_derivation_index)
VALUES (28, 'BCH', 'xpub...your_bch_xpub_here...', 0);
```

---

## What Other Chains Are Missing?

Let me check all expected chains:

**Expected Chains (9 total):**
1. BTC - ❌ Not in merchant_wallet
2. ETH - ❌ Not in merchant_wallet
3. LTC - ❌ Not in merchant_wallet
4. DOGE - ❌ Not in merchant_wallet
5. TRX - ❌ Not in merchant_wallet
6. **BCH - ❌ Not in merchant_wallet**
7. USDT-TRC20 - ❌ Not in merchant_wallet
8. USDT-ERC20 - ❌ Not in merchant_wallet
9. USDC-ERC20 - ❌ Not in merchant_wallet

**ALL chains are missing from merchant_wallet!**

---

## Root Cause

The merchant pool system has **NEVER been initialized** for this user. This explains why:
- No wallets in `tbl_merchant_wallet`
- No merchant pool addresses generated
- Payment creation will fail for ALL crypto currencies

---

## Solution: Initialize Merchant Pool

### Manual Approach:
We need to call the merchant pool initialization function or configure wallets through the admin panel.

### API Approach:
Check if there's an endpoint to configure merchant wallets:
```bash
POST /api/wallet/configure
POST /api/wallet/setup-merchant-pool
```

### Database Approach (for BCH specifically):
```sql
-- Generate BCH xpub first, then:
INSERT INTO tbl_merchant_wallet (user_id, wallet_type, xpub, last_derivation_index, created_at, updated_at)
VALUES (28, 'BCH', '<generated_bch_xpub>', 0, NOW(), NOW());
```

---

## Next Steps

1. **Check if wallet configuration endpoint exists**
2. **Generate xpubs for all chains (BTC, ETH, LTC, DOGE, TRX, BCH, etc.)**
3. **Initialize merchant_wallet table with proper xpubs**
4. **Test BCH payment creation after configuration**

---

## Conclusion

✅ **You are correct!** BCH wallet is NOT configured for merchant payments.
❌ **Current state:** 0/9 chains configured in merchant_wallet
🔧 **Required:** Configure merchant wallet with BCH xpub/mnemonic
⚠️  **Impact:** Cannot create ANY crypto payments until merchant pool is initialized

**Status:** Merchant pool system exists but is completely uninitialized for user 28.
