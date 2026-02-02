# 📊 DynoPay Wallet Architecture Analysis

**Source**: Original DynoBackend Repository (main branch)  
**Date**: 2026-01-26

---

## 🎯 **Key Finding: Which Table is Used for Payment Forwarding?**

### ✅ **Answer: `tbl_user_wallet` (userWalletModel)**

This is the **main payment forwarding table** where cryptocurrency addresses are stored for receiving customer payments.

---

## 📋 **Two Tables Comparison**

| Feature | tbl_user_wallet | tbl_user_addresses |
|---------|----------------|-------------------|
| **Purpose** | Payment forwarding addresses | Saved withdrawal addresses (address book) |
| **Used For** | Receiving crypto payments from customers | User's saved external addresses for withdrawals |
| **Fields (Original)** | wallet_id, user_id, amount, wallet_type, wallet_address, currency_type | user_address_id, user_id, label, currency, wallet_address |
| **Multi-tenancy** | ❌ NO (added in current project) | ❌ NO (added in current project) |

---

## 🔄 **How Wallets Are Added (Original Implementation)**

### **2-Step OTP Process:**

#### **Step 1: POST `/api/wallet/validateWalletAddress`**
```typescript
const validateWallet = async (req, res) => {
  const { wallet_address, currency } = req.body;
  
  // 1. Validate address via Tatum API
  let balance;
  if (currency === "TRX" || currency === "USDT-TRC20") {
    balance = await tatumApi.validateTronAddress(wallet_address);
  } else {
    balance = await tatumApi.getAddressBalance(wallet_address, currency);
  }
  
  // 2. Check for duplicates (ONE BLOCKCHAIN PER USER)
  const existingWallet = await userWalletModel.findOne({
    where: {
      wallet_address: { [Op.not]: null },
      wallet_type: currency,
      user_id: user_id
    },
  });
  
  if (existingWallet) {
    return errorResponseHelper(res, 400, 
      `This address with ${currency} currency already exists!`
    );
  }
  
  // 3. Send OTP to user's email
  await updateOtp(userData, wallet_address, currency);
  
  // 4. Return success
  return successResponseHelper(res, 200, 
    "Address is a valid address and saved successfully!",
    { valid: true, wallet_address }
  );
};
```

#### **Step 2: POST `/api/wallet/verifyOtp`**
```typescript
const verifyOtp = async (req, res) => {
  const { otp, wallet_address, currency } = req.body;
  
  // 1. Verify OTP
  const walletWithOtp = await userModel.findOne({
    where: { user_id, verified_otp: otp }
  });
  
  if (!walletWithOtp) {
    return errorResponseHelper(res, 400, "Please enter a valid OTP!");
  }
  
  // 2. Check OTP expiry
  if (new Date() > walletWithOtp.dataValues.otp_expired) {
    return errorResponseHelper(res, 400, "OTP has expired!");
  }
  
  // 3. Clear OTP
  await userModel.update(
    { verified_otp: null, otp_expired: null },
    { where: { user_id } }
  );
  
  // 4. UPDATE tbl_user_wallet (MAIN PAYMENT TABLE)
  await userWalletModel.update(
    { wallet_address },
    { where: { user_id, wallet_type: currency }}
  );
  
  return successResponseHelper(res, 200, "OTP verified successfully!");
};
```

---

## 🔒 **Security Validation**

### **Original Implementation (Per User):**
```typescript
// Check if user already has this blockchain
const existingWallet = await userWalletModel.findOne({
  where: {
    wallet_address: { [Op.not]: null },
    wallet_type: currency,
    user_id: user_id
  }
});
```

### **Current Project (Multi-Tenant - Per Company):**
```typescript
// Check if company already has this blockchain
const existingWallet = await userWalletModel.findOne({
  where: {
    wallet_address: { [Op.not]: null },
    wallet_type: currency,
    user_id: user_id,
    company_id: company_id  // ✅ ADDED FOR MULTI-TENANCY
  }
});
```

---

## 🗑️ **How Wallets Are Deleted**

```typescript
const deleteWalletAddress = async (req, res) => {
  const { currency } = req.body;
  
  // Sets wallet_address to NULL (doesn't delete the record)
  await userWalletModel.update(
    { wallet_address: null },
    { where: { user_id, wallet_type: currency }}
  );
  
  return successResponseHelper(res, 200, 
    "Wallet address removed successfully!"
  );
};
```

**Note**: This does NOT delete the wallet record, only removes the address.

---

## 📌 **Multi-Tenancy Additions in Current Project**

The current DynoPay implementation added these fields:

### **tbl_user_wallet:**
- ✅ `company_id` (INTEGER, references tbl_company)
- ✅ `wallet_name` (STRING(100))

### **tbl_user_addresses:**
- ✅ `company_id` (INTEGER, references tbl_company)  
- ✅ `wallet_name` (STRING(100))

---

## ✅ **Correct API Endpoints for Testing**

### **For Main Payment Wallets (tbl_user_wallet):**

| Operation | Endpoint | Method | Notes |
|-----------|----------|--------|-------|
| **Add Wallet** | `/api/wallet/validateWalletAddress` | POST | Step 1: Validate & send OTP |
| **Confirm Wallet** | `/api/wallet/verifyOtp` | POST | Step 2: Verify OTP & save |
| **Delete Wallet** | `/api/wallet/deleteWalletAddress` | POST | Sets address to NULL |
| **Get Wallets** | `/api/wallet/getWallet` | GET | Retrieve all wallets |

### **For Saved Addresses (tbl_user_addresses):**

| Operation | Endpoint | Method | Notes |
|-----------|----------|--------|-------|
| **Add Address** | `/api/wallet/addWalletAddress` | POST | Direct add, no OTP |
| **Get Addresses** | `/api/wallet/getWalletAddresses` | GET | Retrieve saved addresses |

---

## 🎯 **Conclusion**

1. **Payment Forwarding**: Use `tbl_user_wallet` (userWalletModel)
2. **Add Wallets**: Use `validateWalletAddress` + `verifyOtp` endpoints
3. **Multi-Tenancy**: Check by `company_id` (one blockchain per company)
4. **Delete Wallets**: Sets `wallet_address` to NULL (record remains)
5. **Address Book**: `tbl_user_addresses` is for withdrawal addresses only

---

**Next Steps:**
- Test `validateWalletAddress` + `verifyOtp` flow
- Implement multi-tenancy validation (company_id check)
- Test duplicate prevention (same blockchain for same company)
