# Wallet API Endpoints - Usage Guide

## 🚨 Important: Two Different Wallet Systems

DynoPay has **TWO separate wallet systems** with different endpoints. Make sure you're using the correct one!

---

## ✅ Primary System: `/api/wallet/getWallet`

### Overview
- **Table:** `tbl_user_wallet`
- **Purpose:** Main wallet system for payment forwarding
- **Security:** OTP-based verification required
- **Payment Flow:** Integrated with payment forwarding system
- **Status:** ✅ ACTIVE - Use this for production

### Endpoint
```
GET /api/wallet/getWallet
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| company_id | integer | ❌ Optional | Filter by specific company. If omitted, returns all companies for the user |

### Headers
```json
{
  "Authorization": "Bearer <JWT_TOKEN>"
}
```

### Response Example
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
      "wallet_name": "JohnAdd",
      "amount": "0.00",
      "balance_in_usd": "0.00",
      "transfer_rate": 0.00035729,
      "createdAt": "2026-01-25T18:18:05.691Z",
      "updatedAt": "2026-01-25T23:17:20.112Z"
    },
    {
      "wallet_id": 144,
      "user_id": 28,
      "company_id": 38,
      "wallet_type": "BTC",
      "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "wallet_name": "BTC Main Wallet",
      "amount": "0.00",
      "balance_in_usd": "0.00",
      "transfer_rate": 0.00001159,
      "createdAt": "2026-01-25T18:18:05.691Z",
      "updatedAt": "2026-01-25T23:17:19.418Z"
    }
  ]
}
```

### Features
- ✅ Returns wallets with addresses (filters out empty wallets)
- ✅ Includes balance information
- ✅ Shows transfer rates (current crypto prices)
- ✅ Supports company_id filtering
- ✅ Returns all companies if company_id not provided
- ✅ Integrated with payment forwarding system
- ✅ OTP-verified addresses

### Usage Examples

**Get all wallet addresses for user (all companies):**
```bash
curl -X GET "https://dynopay-fix.preview.emergentagent.com/api/wallet/getWallet" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Get wallet addresses for specific company:**
```bash
curl -X GET "https://dynopay-fix.preview.emergentagent.com/api/wallet/getWallet?company_id=38" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Frontend JavaScript/React:**
```javascript
const response = await fetch(`${API_URL}/wallet/getWallet?company_id=${companyId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
const wallets = data.data.filter(w => w.wallet_address); // Get only wallets with addresses
```

---

## ⚠️ Alternative System: `/api/wallet/getWalletAddresses`

### Overview
- **Table:** `tbl_user_wallet_address`
- **Purpose:** Alternative wallet address storage (no OTP)
- **Security:** Direct add without OTP verification
- **Payment Flow:** NOT integrated with payment forwarding
- **Status:** ⚠️ LEGACY - Not recommended for production use

### Endpoint
```
GET /api/wallet/getWalletAddresses
```

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| company_id | integer | ❌ Optional | Filter by specific company |

### Response Example (Empty)
```json
{
  "message": "No wallet addresses found. Add your first wallet address to start receiving payments.",
  "data": []
}
```

### Why It's Empty
- Uses different table (`tbl_user_wallet_address`)
- Not connected to OTP verification flow
- Not used by payment forwarding system
- Wallets added via `validateWallet` + `verifyOtp` go to the main table

### ⚠️ Important
**DO NOT USE THIS ENDPOINT** for production features. It queries a different table that's not integrated with the payment system.

---

## 📊 Comparison Table

| Feature | `/getWallet` ✅ | `/getWalletAddresses` ⚠️ |
|---------|----------------|--------------------------|
| Table | `tbl_user_wallet` | `tbl_user_wallet_address` |
| OTP Verification | ✅ Yes | ❌ No |
| Payment Forwarding | ✅ Integrated | ❌ Not integrated |
| Balance Info | ✅ Yes | ❌ No |
| Transfer Rates | ✅ Yes | ❌ No |
| Company Filter | ✅ Yes (optional) | ✅ Yes (optional) |
| One-per-blockchain Rule | ✅ Enforced | ❌ Not enforced |
| OTP Currency Validation | ✅ Enforced | ❌ N/A |
| Recommended for Production | ✅ YES | ❌ NO |

---

## 🎯 Which Endpoint Should I Use?

### ✅ Use `/api/wallet/getWallet` if you want to:
- Display merchant's configured wallet addresses
- Show wallet balances
- List payment-receiving wallets
- Build merchant dashboard
- Show wallets for payment forwarding
- **This is the recommended endpoint for all production features**

### ⚠️ Use `/api/wallet/getWalletAddresses` if you:
- Need to access the legacy wallet address system
- Have addresses stored in `tbl_user_wallet_address`
- Are maintaining backward compatibility with old code
- **Generally not recommended - consider migrating to main system**

---

## 🔄 Adding Wallet Addresses

### Primary Method (OTP-based) - ✅ Recommended

**Step 1: Validate and Send OTP**
```bash
POST /api/wallet/validateWalletAddress
{
  "wallet_address": "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
  "currency": "ETH",
  "company_id": 38,
  "wallet_name": "ETH Main Wallet"
}
```

**Step 2: Verify OTP**
```bash
POST /api/wallet/verifyOtp
{
  "otp": "123456",
  "wallet_address": "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
  "currency": "ETH",
  "company_id": 38,
  "wallet_name": "ETH Main Wallet"
}
```

**Result:** Wallet saved to `tbl_user_wallet` ✅

### Alternative Method (No OTP) - ⚠️ Not Recommended

```bash
POST /api/wallet/addWalletAddress
{
  "wallet_address": "0x...",
  "currency": "ETH",
  "company_id": 38
}
```

**Result:** Wallet saved to `tbl_user_wallet_address` (not integrated with payments) ⚠️

---

## 🐛 Common Issues

### Issue 1: "No wallet addresses found" error

**Problem:** Frontend calling `/getWalletAddresses` instead of `/getWallet`

**Symptoms:**
```json
{
  "message": "No wallet addresses found. Add your first wallet address to start receiving payments.",
  "data": []
}
```

**Solution:** Change frontend to call `/getWallet`:
```javascript
// ❌ Wrong
fetch(`${API_URL}/wallet/getWalletAddresses?company_id=${id}`)

// ✅ Correct
fetch(`${API_URL}/wallet/getWallet?company_id=${id}`)
```

### Issue 2: Wallet exists but not showing up

**Cause:** Wallet in wrong table

**Check which table has the wallet:**
```sql
-- Check main table (correct)
SELECT * FROM tbl_user_wallet 
WHERE user_id = 28 AND wallet_address IS NOT NULL;

-- Check alternative table (legacy)
SELECT * FROM tbl_user_wallet_address 
WHERE user_id = 28;
```

**Solution:** Use `/getWallet` endpoint to access main table

### Issue 3: Company filter not working

**Problem:** Passing wrong parameter or format

**Solution:**
```javascript
// ✅ Correct - number parameter
fetch(`${API_URL}/wallet/getWallet?company_id=38`)

// ✅ Correct - optional parameter (returns all companies)
fetch(`${API_URL}/wallet/getWallet`)

// ❌ Wrong - string "null" or "undefined"
fetch(`${API_URL}/wallet/getWallet?company_id=null`)
```

---

## 📝 Migration Guide

### If You're Using `/getWalletAddresses`

**Step 1: Update Frontend API Calls**
```javascript
// Before
const response = await fetch(
  `${API_URL}/wallet/getWalletAddresses?company_id=${companyId}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);

// After
const response = await fetch(
  `${API_URL}/wallet/getWallet?company_id=${companyId}`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
```

**Step 2: Update Data Processing**
```javascript
// The data structure is similar, but includes more fields
const wallets = data.data.filter(w => w.wallet_address);

// Access fields
wallets.forEach(wallet => {
  console.log(wallet.wallet_type);      // BTC, ETH, etc.
  console.log(wallet.wallet_address);   // Address
  console.log(wallet.balance_in_usd);   // USD balance
  console.log(wallet.transfer_rate);    // Current rate
});
```

**Step 3: Test**
- Verify wallet addresses display correctly
- Check company filtering works
- Confirm balances show up

---

## 🎓 Summary

### For Production Use:

```
✅ USE: GET /api/wallet/getWallet?company_id={id}
   - Returns wallets from main payment system
   - Includes OTP-verified addresses
   - Integrated with payment forwarding
   - Supports company filtering (optional)
   
❌ AVOID: GET /api/wallet/getWalletAddresses?company_id={id}
   - Returns from legacy alternative table
   - Not integrated with payment system
   - Currently returns empty for most users
```

### Quick Reference:

**Get all wallet addresses:**
```
GET /api/wallet/getWallet
```

**Get wallet addresses for specific company:**
```
GET /api/wallet/getWallet?company_id=38
```

**Add wallet address (with OTP):**
```
POST /api/wallet/validateWalletAddress  → Send OTP
POST /api/wallet/verifyOtp              → Verify and save
```

---

## 📞 Support

If you encounter issues:
1. Verify you're using `/getWallet` not `/getWalletAddresses`
2. Check company_id parameter is correct (number, not string "null")
3. Ensure Authorization header is present
4. Check backend logs for errors

**Documentation:** `/app/WALLET_API_ENDPOINTS_GUIDE.md`
**Bug Reports:** This is the correct expected behavior - two separate systems exist
