# Wallet Blockchain Type Validation Implementation

## 🎯 Requirement
**ONE wallet address per blockchain type per company**

Each company can only configure one wallet address for each blockchain type (BTC, ETH, LTC, TRX, USDT-TRC20, USDT-ERC20, DOGE, BCH).

## ✅ What's Allowed
- Company A: 1 BTC wallet ✅
- Company A: 1 ETH wallet ✅  
- Company A: 1 USDT-TRC20 wallet ✅
- Company B: 1 BTC wallet ✅ (different company)

## ❌ What's Blocked
- Company A: 2 BTC wallets ❌
- Company A: 2 ETH wallets ❌
- Company A: 2 USDT-TRC20 wallets ❌

---

## 📁 Files Modified

### `/app/backend/controller/walletController.ts`

**Function:** `validateWallet` (lines 2592-2671)

**Validation Logic Added (lines 2620-2637):**

```typescript
// CRITICAL VALIDATION: Check if company already has a wallet for this blockchain type
// Each company can only have ONE wallet address per blockchain (BTC, ETH, etc.)
const existingWallet = await userWalletModel.findOne({
  where: {
    wallet_address: { [Op.not]: null },
    wallet_type: currency,
    user_id: user_id,
    company_id: company_id
  },
});

if (existingWallet) {
  return errorResponseHelper(
    res,
    400,
    `A ${currency} wallet address already exists for this company! Each company can only have one wallet address per blockchain type. Existing address: ${existingWallet.dataValues.wallet_address.substring(0, 10)}...`
  );
}
```

---

## 🔄 Payment Forwarding Flow

Understanding why this restriction exists:

```
Customer Payment
      ↓
[Temporary Address] ← Customer pays here
      ↓
[Payment Verified]
      ↓
[Split & Forward]
      ├─→ [Admin Wallet] (Fees)
      └─→ [Merchant Wallet] ← ONE address per blockchain per company
```

**Why One Address?**
- Single forwarding destination per blockchain
- Simplified settlement tracking
- Clear accounting per blockchain
- Threshold monitoring (e.g., BTC_THRESHOLD=7 USD)

---

## 📡 API Endpoint

**POST** `/api/wallet/validateWalletAddress`

**Headers:**
```json
{
  "Authorization": "Bearer <JWT_TOKEN>"
}
```

**Request Body:**
```json
{
  "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "currency": "BTC",
  "company_id": 1,
  "wallet_name": "BTC Main Wallet"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Address is a valid address and saved successfully!",
  "data": {
    "valid": true,
    "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "wallet_name": "BTC Main Wallet",
    "company_id": 1
  }
}
```

**Error Response - Duplicate Blockchain Type (400):**
```json
{
  "success": false,
  "message": "A BTC wallet address already exists for this company! Each company can only have one wallet address per blockchain type. Existing address: 1JH5TnZzjY...",
  "statusCode": 400
}
```

---

## 🧪 Testing Scenarios

### Test Case 1: Add First BTC Wallet
**Input:**
```json
{
  "currency": "BTC",
  "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "company_id": 1
}
```
**Expected:** ✅ Success - OTP sent

### Test Case 2: Add Second BTC Wallet (Duplicate)
**Input:**
```json
{
  "currency": "BTC",
  "wallet_address": "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy",
  "company_id": 1
}
```
**Expected:** ❌ Error - "A BTC wallet address already exists for this company!"

### Test Case 3: Add ETH Wallet (Different Blockchain)
**Input:**
```json
{
  "currency": "ETH",
  "wallet_address": "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed",
  "company_id": 1
}
```
**Expected:** ✅ Success - OTP sent (different blockchain type)

### Test Case 4: Same BTC Address, Different Company
**Input:**
```json
{
  "currency": "BTC",
  "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "company_id": 2
}
```
**Expected:** ✅ Success - OTP sent (different company can use same address)

---

## 🗄️ Database Schema

**Table:** `tbl_user_wallet`

**Relevant Fields:**
```sql
- wallet_id (PRIMARY KEY)
- user_id (FOREIGN KEY → tbl_user)
- company_id (FOREIGN KEY → tbl_company)
- wallet_type (VARCHAR) -- BTC, ETH, LTC, TRX, USDT-TRC20, etc.
- wallet_address (VARCHAR) -- The merchant's wallet address
- amount (FLOAT) -- Balance
```

**Unique Constraint Logic (in code):**
- Combination: `(user_id, company_id, wallet_type)` must be unique when `wallet_address IS NOT NULL`

---

## 🔒 Supported Blockchain Types

1. **BTC** - Bitcoin
2. **ETH** - Ethereum
3. **LTC** - Litecoin
4. **TRX** - Tron
5. **USDT-TRC20** - Tether on Tron (TRC20)
6. **USDT-ERC20** - Tether on Ethereum (ERC20)
7. **DOGE** - Dogecoin
8. **BCH** - Bitcoin Cash

---

## ⚡ Blockchain Thresholds

Payments are forwarded when the USD value exceeds these thresholds:

| Blockchain | Threshold (USD) |
|------------|----------------|
| BTC        | $7             |
| ETH        | $5             |
| USDT-TRC20 | $10            |
| USDT-ERC20 | $5             |
| TRX        | $5             |
| LTC        | $5             |
| DOGE       | $5             |
| BCH        | $5             |

---

## 📝 Implementation Status

✅ **Validation Added** - Lines 2620-2637 in walletController.ts
✅ **Error Messages** - Clear, descriptive error messages
✅ **Backend Restarted** - Changes are live
✅ **Documentation Created** - This file

---

## 🔍 How to Verify

### Method 1: Check Existing Wallets
```bash
curl -X GET "https://blockchain-fee-check.preview.emergentagent.com/api/wallet/getWallet?company_id=1" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

### Method 2: Try Adding Duplicate
```bash
curl -X POST "https://blockchain-fee-check.preview.emergentagent.com/api/wallet/validateWalletAddress" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "currency": "BTC",
    "company_id": 1
  }'
```

If a BTC wallet already exists, you'll get a 400 error with the message:
```
"A BTC wallet address already exists for this company! Each company can only have one wallet address per blockchain type..."
```

---

## 🎉 Summary

The validation is now in place and enforces the business rule:

**ONE wallet address per blockchain type per company**

This ensures:
- Clean payment forwarding architecture
- No confusion about which wallet to forward to
- Clear accounting per blockchain
- Proper threshold management

The merchant will receive a clear error message if they try to add a duplicate blockchain type to the same company.
