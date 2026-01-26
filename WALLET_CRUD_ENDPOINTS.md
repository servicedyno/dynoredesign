# 📋 Complete API Endpoints for tbl_user_wallet (Payment Forwarding)

**Table**: `tbl_user_wallet` (Main Payment Forwarding Table)  
**Date**: 2026-01-26

---

## ✅ **YES - All CRUD Operations Available with OTP Verification**

---

## 🔐 **CREATE - Add Wallet Address (2-Step OTP Flow)**

### **Step 1: Validate Address & Send OTP**
**Endpoint**: `POST /api/wallet/validateWalletAddress`

**Request Body**:
```json
{
  "wallet_address": "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",
  "currency": "BTC",
  "wallet_name": "BTC Wallet - Company Name",
  "company_id": 38
}
```

**Validations**:
- ✅ Validates address format via Tatum API
- ✅ Checks for duplicate (one blockchain per company)
- ✅ Sends OTP to user's email
- ⏱️ OTP expires in 5 minutes

**Response**:
```json
{
  "message": "Address is a valid address and saved successfully!",
  "data": {
    "valid": true,
    "wallet_address": "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7"
  }
}
```

---

### **Step 2: Verify OTP & Confirm Wallet Creation**
**Endpoint**: `POST /api/wallet/verifyOtp`

**Request Body**:
```json
{
  "otp": "123456",
  "wallet_address": "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",
  "currency": "BTC"
}
```

**What It Does**:
- ✅ Verifies OTP
- ✅ Updates `tbl_user_wallet.wallet_address`
- ✅ Clears OTP from database

**Response**:
```json
{
  "message": "OTP verified successfully!",
  "data": {
    "verified": true
  }
}
```

---

## 📝 **READ - Get Wallet Addresses**

**Endpoint**: `GET /api/wallet/getWallet`

**Query Parameters**:
```
?company_id=38  (optional - filter by company)
```

**Response**:
```json
{
  "message": "Successfully retrieved 16 wallets",
  "data": [
    {
      "wallet_id": 430,
      "user_id": 28,
      "company_id": 38,
      "wallet_name": "BTC Wallet - Company 38",
      "amount": 0.00005,
      "wallet_type": "BTC",
      "wallet_address": "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",
      "currency_type": "CRYPTO",
      "amount_in_usd": "5.23",
      "transfer_rate": 0.00001142
    }
  ]
}
```

---

## ✏️ **UPDATE - Modify Wallet Address (2-Step OTP Flow)**

### **Step 1: Send OTP for Update**
**Endpoint**: `POST /api/wallet/wallet/update/send-otp`

**Request Body**:
```json
{
  "wallet_id": 430,
  "company_id": 38
}
```

**Validations**:
- ✅ Wallet must exist
- ✅ Wallet must have an address (cannot update empty wallets)
- ✅ Multi-tenant security (company_id check)
- ✅ Sends OTP to email
- ⏱️ OTP expires in 5 minutes

**Response**:
```json
{
  "message": "OTP sent to your email",
  "data": {
    "wallet_id": 430,
    "wallet_type": "BTC",
    "current_address": "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",
    "email": "jo***@dyno.pt"
  }
}
```

---

### **Step 2: Verify OTP & Update Wallet**
**Endpoint**: `POST /api/wallet/wallet/update`

**Request Body**:
```json
{
  "wallet_id": 430,
  "company_id": 38,
  "otp": "123456",
  "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  "wallet_name": "New BTC Wallet Name",
  "currency": "BTC"
}
```

**What It Does**:
- ✅ Verifies OTP
- ✅ Validates new address format via Tatum API
- ✅ Checks OTP currency matches wallet type
- ✅ Updates wallet address, name, or currency
- ✅ Clears OTP

**Response**:
```json
{
  "message": "Wallet updated successfully!",
  "data": {
    "wallet_id": 430,
    "wallet_type": "BTC",
    "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "wallet_name": "New BTC Wallet Name",
    "company_id": 38
  }
}
```

---

## 🗑️ **DELETE - Remove Wallet Address (2-Step OTP Flow)**

### **Step 1: Send OTP for Deletion**
**Endpoint**: `POST /api/wallet/wallet/delete/send-otp`

**Request Body**:
```json
{
  "wallet_id": 430,
  "company_id": 38
}
```

**Validations**:
- ✅ Wallet must exist
- ✅ Wallet must have an address
- ✅ Multi-tenant security (company_id check)
- ✅ Sends OTP to email with warning
- ⏱️ OTP expires in 5 minutes

**Response**:
```json
{
  "message": "OTP sent to your email",
  "data": {
    "wallet_id": 430,
    "wallet_type": "BTC",
    "wallet_address": "1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7",
    "email": "jo***@dyno.pt",
    "warning": "This action is permanent and cannot be undone"
  }
}
```

---

### **Step 2: Verify OTP & Delete Wallet**
**Endpoint**: `POST /api/wallet/wallet/delete/verify`

**Request Body**:
```json
{
  "wallet_id": 430,
  "company_id": 38,
  "otp": "123456"
}
```

**What It Does**:
- ✅ Verifies OTP
- ✅ Checks OTP currency matches wallet type
- ✅ **Soft Delete**: Sets `wallet_address`, `wallet_name`, and `company_id` to NULL
- ✅ Wallet record remains (only clears address)
- ✅ Clears OTP

**Response**:
```json
{
  "message": "Wallet address removed successfully!",
  "data": {
    "removed": true,
    "wallet_id": 430,
    "wallet_type": "BTC",
    "company_id": null
  }
}
```

**Note**: This is a **soft delete** - the wallet record remains but the address is cleared. The wallet can be reused later by adding a new address.

---

## 🔒 **Security Features**

### **Multi-Tenancy**
- All endpoints support `company_id` parameter
- Validates user has permission to access the company
- One blockchain per company enforcement

### **OTP Security**
- 6-digit random OTP
- 5-minute expiration
- Email delivery
- Currency validation (prevents OTP reuse across different cryptocurrencies)
- Single-use (cleared after verification)

### **Address Validation**
- Blockchain-specific validation via Tatum API
- Format verification
- Balance check (confirms address is valid)

### **Duplicate Prevention**
```typescript
// Checks for existing wallet with same currency for the company
const existingWallet = await userWalletModel.findOne({
  where: {
    wallet_address: { [Op.not]: null },
    wallet_type: currency,
    user_id: user_id,
    company_id: company_id
  }
});
```

---

## 📊 **Complete CRUD Summary**

| Operation | Step 1 Endpoint | Step 2 Endpoint | OTP Required |
|-----------|----------------|----------------|--------------|
| **CREATE** | `POST /api/wallet/validateWalletAddress` | `POST /api/wallet/verifyOtp` | ✅ Yes |
| **READ** | `GET /api/wallet/getWallet` | N/A | ❌ No |
| **UPDATE** | `POST /api/wallet/wallet/update/send-otp` | `POST /api/wallet/wallet/update` | ✅ Yes |
| **DELETE** | `POST /api/wallet/wallet/delete/send-otp` | `POST /api/wallet/wallet/delete/verify` | ✅ Yes |

---

## 🎯 **Key Differences from tbl_user_addresses**

| Feature | tbl_user_wallet | tbl_user_addresses |
|---------|----------------|-------------------|
| **Purpose** | Payment forwarding | Withdrawal address book |
| **CREATE** | 2-step OTP | Direct (no OTP) |
| **UPDATE** | 2-step OTP | 2-step OTP |
| **DELETE** | 2-step OTP (soft delete) | 2-step OTP (hard delete) |
| **Security** | High (all operations need OTP) | Medium (only CUD needs OTP) |

---

## ✅ **Conclusion**

**YES, we have complete CRUD operations for `tbl_user_wallet` with OTP verification:**

1. ✅ **CREATE**: `validateWalletAddress` → `verifyOtp`
2. ✅ **READ**: `getWallet`
3. ✅ **UPDATE**: `wallet/update/send-otp` → `wallet/update`
4. ✅ **DELETE**: `wallet/delete/send-otp` → `wallet/delete/verify`

All CUD operations require **2-step OTP verification** for security.
