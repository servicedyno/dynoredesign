# Swagger API Documentation Updated

## ✅ Changes Made

### 1. Added Primary Endpoint Documentation

**New Endpoint Added to Swagger:**
```
GET /api/wallet/getWallet
```

**Summary:** 📖 Get Wallet Addresses (RECOMMENDED - Use This)

**Description:**
- ✅ RECOMMENDED ENDPOINT
- Returns OTP-verified wallet addresses
- Includes balance information
- Shows current crypto transfer rates
- Integrated with payment forwarding system
- Enforces one-wallet-per-blockchain rule
- Table: tbl_user_wallet (Main payment system)

**Parameters:**
- `company_id` (optional): Filter by company ID or omit for all companies

**Response Example:**
```json
{
  "message": "Successfully retrieved 2 wallet",
  "data": [
    {
      "wallet_id": 145,
      "user_id": 28,
      "company_id": 38,
      "wallet_type": "ETH",
      "wallet_address": "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
      "wallet_name": "ETH Main Wallet",
      "amount": "0.00",
      "balance_in_usd": "0.00",
      "transfer_rate": 0.00035729
    }
  ]
}
```

---

### 2. Updated Legacy Endpoint Documentation

**Marked as Deprecated:**
```
GET /api/wallet/getWalletAddresses
```

**Summary:** ⚠️ Get Wallet Addresses (LEGACY - Not Recommended)

**Description:**
- ⚠️ DEPRECATED - USE /api/wallet/getWallet INSTEAD
- Returns from legacy alternative table
- NOT integrated with payment forwarding
- May return empty even if you have wallets
- No balance information
- No transfer rates
- Table: tbl_user_wallet_address (Legacy system)

---

### 3. Enhanced validateWalletAddress Documentation

**Updated Description:**
```
POST /api/wallet/validateWalletAddress
```

**New Information Added:**
- ✅ Saves to main payment system (tbl_user_wallet)
- ✅ Wallet will appear in GET /api/wallet/getWallet
- ✅ Integrated with payment forwarding
- ✅ Enforces one-wallet-per-blockchain rule
- 🔒 OTP is tied to specific currency (cannot swap currencies during verification)

---

## 📊 Swagger UI Comparison

### Before Update:
```
GET /api/wallet/getWalletAddresses
📖 Read All Wallet Addresses

(No mention of /getWallet endpoint)
(Users unaware of correct endpoint)
```

### After Update:
```
GET /api/wallet/getWallet
📖 Get Wallet Addresses (RECOMMENDED - Use This)
✅ This is the main endpoint to use

GET /api/wallet/getWalletAddresses
⚠️ Get Wallet Addresses (LEGACY - Not Recommended)
Deprecated - Use /getWallet instead
```

---

## 🎯 Impact

### For Developers Using Swagger UI:

1. **Clear Guidance:** 
   - Green checkmark (✅) on recommended endpoint
   - Warning symbol (⚠️) on deprecated endpoint

2. **Detailed Information:**
   - Explains which table each endpoint queries
   - Shows example responses
   - Lists features/limitations

3. **Migration Path:**
   - Legacy endpoint points to new endpoint
   - Clear "USE THIS INSTEAD" message

### For API Consumers:

1. **Correct Endpoint Visible:**
   - `/getWallet` now appears in Swagger docs
   - Easy to discover and use

2. **Prevents Confusion:**
   - Both endpoints documented
   - Clear distinction between primary and legacy

3. **Better Integration:**
   - Developers will use the correct payment-integrated system
   - Reduces support requests

---

## 🧪 Verification

### Check Swagger UI:
1. Visit: `https://install-manager-5.preview.emergentagent.com/api/docs`
2. Find "Wallet Address Management" section
3. Verify both endpoints are listed:
   - ✅ `/getWallet` marked as RECOMMENDED
   - ⚠️ `/getWalletAddresses` marked as LEGACY

### Test Endpoints:

**Primary Endpoint (Recommended):**
```bash
curl -X GET "https://install-manager-5.preview.emergentagent.com/api/wallet/getWallet?company_id=38" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Returns wallets with balances ✅

**Legacy Endpoint (Deprecated):**
```bash
curl -X GET "https://install-manager-5.preview.emergentagent.com/api/wallet/getWalletAddresses?company_id=38" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** May return empty (as documented) ⚠️

---

## 📝 Files Modified

1. **`/app/backend/swagger/paths/wallet.ts`**
   - Added `/api/wallet/getWallet` documentation
   - Updated `/api/wallet/getWalletAddresses` to mark as deprecated
   - Enhanced `/api/wallet/validateWalletAddress` description
   - Added detailed examples and feature lists

2. **Backend Service**
   - Restarted to load new Swagger documentation
   - Status: ✅ RUNNING

---

## 🎓 Developer Guidance

### What to Use:

**✅ For Production:**
```
GET /api/wallet/getWallet?company_id={id}
```

**❌ Avoid:**
```
GET /api/wallet/getWalletAddresses
```

### Why the Change:

The system has two wallet tables:
1. **tbl_user_wallet** - Main payment system with OTP verification ✅
2. **tbl_user_wallet_address** - Legacy alternative ❌

Wallets added via `validateWallet` + `verifyOtp` flow are stored in the main table and only accessible via `/getWallet`.

---

## ✅ Summary

**Problem:** Swagger docs only showed deprecated endpoint
**Solution:** Added correct endpoint documentation and marked legacy as deprecated
**Result:** Clear guidance for developers on which endpoint to use

**Backend Status:** ✅ Running
**Swagger Docs:** ✅ Updated
**API Routes:** ✅ Unchanged (both work)
**Guidance:** ✅ Clear and visible

Developers using Swagger UI will now see the recommended endpoint prominently and understand why to use it.
