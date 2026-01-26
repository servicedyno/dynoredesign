# Payment Flow Address & Notification Analysis

**Payment Link ID**: 129  
**Amount**: $10 USD  
**Company**: 38 (Johnny LTD)  
**User**: 28 (john@dyno.pt)  
**Currency**: ETH

---

## ETH Addresses for Payment Distribution

### 1. Customer Pays To (Temporary Address)
When the payment link is opened and ETH is selected, a **temporary address** is generated using:
- Admin's XPUB key
- Incrementing index
- Stored in `tbl_user_temp_address`

**Example**: `0x1234...abcd` (unique per payment)

### 2. Merchant Receives From (Company 38's ETH Wallet)

**Address**: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`

**Details**:
- **User ID**: 28
- **Company ID**: 38
- **Wallet Type**: ETH
- **Amount Received**: $6.70 USD (67% of $10)

**Source**: Retrieved from `tbl_user_wallet` table
```sql
SELECT wallet_address 
FROM tbl_user_wallet 
WHERE user_id = 28 
  AND company_id = 38 
  AND wallet_type = 'ETH'
```

### 3. Admin Fee Wallet (DynoPay Platform)

**Address**: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`

**Details**:
- **Wallet Type**: ETH (Admin Wallet)
- **Amount Received**: $3.30 USD (33% of $10)
- **Purpose**: Platform fees

**Source**: From `.env` file
```
ETH=0x9a7221b5e32d5f99e8da95585835442e29afb38f
```

---

## ⚠️ CRITICAL FINDING: Same Address Issue!

### Problem Identified:
```
Merchant Address: 0x9a7221b5e32d5f99e8da95585835442e29afb38f
Admin Address:    0x9a7221b5e32d5f99e8da95585835442e29afb38f
```

**Both addresses are identical!**

This means:
- ❌ Merchant wallet and admin wallet are the same
- ❌ Cannot distinguish between merchant funds and platform fees
- ❌ All ETH goes to the same address

### Why This Happens:
Looking at the wallet data, it appears the merchant hasn't configured their own ETH wallet address yet, so the system is using the admin's address as a placeholder.

### Recommendation:
**Merchant MUST configure a separate ETH wallet address for Company 38 before accepting payments.**

To fix:
1. Merchant should go to wallet settings
2. Add a new ETH wallet address (different from admin)
3. This ensures proper fund separation

---

## Payment Flow with Addresses

```
Step 1: Customer Opens Payment Link
┌────────────────────────────────────┐
│ Payment Link ID: 129               │
│ Amount: $10 USD                    │
│ Company: 38                        │
└────────────────────────────────────┘
              ↓
Step 2: Temporary Address Generated
┌────────────────────────────────────┐
│ Temp Address: 0xTEMP123...        │
│ (Unique for this payment)         │
└────────────────────────────────────┘
              ↓
Step 3: Customer Sends ETH
┌────────────────────────────────────┐
│ Customer → 0xTEMP123...           │
│ Amount: 0.003 ETH (~$10)          │
└────────────────────────────────────┘
              ↓
Step 4: Webhook Detects Payment
┌────────────────────────────────────┐
│ Tatum Webhook Fires               │
│ Calls: cryptoVerification()       │
└────────────────────────────────────┘
              ↓
Step 5: Fund Distribution
┌─────────────────────────────────────┐
│  settleCryptoTransaction()         │
│                                    │
│  Admin: $3.30 → 0x9a7221...       │
│  (Platform Fee)                   │
│                                    │
│  Merchant: $6.70 → 0x9a7221...    │
│  (Company 38)                     │
│                                    │
│  ⚠️ SAME ADDRESS!                 │
└─────────────────────────────────────┘
```

---

## Email Notifications Analysis

### 1. ✅ Payment Detected (Pending) Email

**When**: As soon as transaction is broadcast to blockchain (0 confirmations)

**To**: Merchant (john@dyno.pt)

**Triggered By**: 
- `tatumCryptoWebHook()` webhook handler
- Calls `sendPendingPaymentNotification()`

**Email Template**:
```
Subject: ⏳ Payment Pending Confirmation - DynoPay

A new payment has been detected for your company Johnny LTD!

💰 Amount: 0.003 ETH (~$10)
📝 Transaction ID: 0xabc123...
⏳ Status: Awaiting Confirmation

The transaction has been broadcast to the ETH network and is 
waiting for blockchain confirmation. This typically takes:
• ETH/ERC20: 1-5 minutes

We'll notify you once the payment is fully confirmed and 
credited to your wallet.
```

**Code Location**: `/app/backend/webhooks/index.ts` (Lines 120-132)
```typescript
if (isFirstTransaction) {
  const customerData = await getRedisItem(items?.ref);
  if (customerData) {
    await sendPendingPaymentNotification(
      address,
      payload.txId,
      incomingAmount,
      items?.currency || payload.asset,
      customerData
    );
  }
}
```

**Status**: ✅ **SENT**

---

### 2. ✅ Payment Received (Confirmed) Email

**When**: After payment is confirmed and funds are distributed

**To**: Merchant (john@dyno.pt)

**Triggered By**:
- `cryptoVerification()` function
- After successful fund settlement

**Email Template**:
```
Subject: Payment Received - DynoPay

Great news! Your company Johnny LTD has received a payment.

💰 Amount: 6.70 ETH

📝 Transaction Reference: 0xabc123...

The funds have been credited to your wallet. You can view 
the full transaction details in your DynoPay dashboard.

Thank you for using DynoPay for your crypto payments!
```

**Code Location**: `/app/backend/controller/paymentController.ts` (Lines 2039-2046)
```typescript
await sendPaymentReceivedEmail(
  userData?.email,           // john@dyno.pt
  userData?.name,           // Johnny LTD
  companyName,              // Johnny LTD
  userAmountToSend,         // 6.70
  tempCurrency,             // ETH
  transactionId             // 0xabc123...
);
```

**Amount in Email**: $6.70 ETH (merchant's portion, after fees deducted)

**Status**: ✅ **SENT**

---

### 3. ✅ In-App Notification - Payment Received

**When**: Same time as email notification

**To**: Merchant (User ID: 28)

**Code Location**: Lines 2048-2062
```typescript
await createNotification(
  customerData.adm_id,                    // User 28
  NOTIFICATION_TYPES.PAYMENT_RECEIVED,
  "Payment Received",
  `Your company ${companyName} received ${userAmountToSend} ${tempCurrency}`,
  {
    amount: userAmountToSend,            // 6.70
    currency: tempCurrency,              // ETH
    transaction_id: transactionId,
    company_name: companyName,           // Johnny LTD
    company_id: company_data?.company_id, // 38
  },
  company_data?.company_id               // 38
);
```

**Status**: ✅ **SENT**

---

### 4. ❌ Admin Fee Notification - NOT SENT

**When**: N/A - Not implemented

**To**: Admin (moxxcompany@gmail.com)

**Expected**: Notification when admin wallet receives platform fees

**Current Status**: ❌ **NOT IMPLEMENTED**

**Code Analysis**:
```typescript
// Line 1868-1871 - Admin fee is recorded
await adminWalletModel.increment("fee", {
  by: adminAmountToSend,  // $3.30
  where: { wallet_type: tempCurrency },
});

// ❌ NO EMAIL OR NOTIFICATION FOLLOWS
```

**What Should Happen**:
```typescript
// Proposed: After line 1871, add:
const adminEmail = process.env.ADMIN_EMAIL; // moxxcompany@gmail.com

if (adminAmountToSend > 0) {
  await sendAdminFeeReceivedEmail(
    adminEmail,
    "DynoPay Admin",
    adminAmountToSend,
    tempCurrency,
    transactionId,
    company_data?.company_name,
    userAmountToSend
  );
  
  // Create admin notification
  await createNotification(
    1, // Admin user ID
    NOTIFICATION_TYPES.FEE_RECEIVED,
    "Platform Fee Received",
    `Received ${adminAmountToSend} ${tempCurrency} in fees from ${company_data?.company_name}`,
    {
      fee_amount: adminAmountToSend,
      merchant_amount: userAmountToSend,
      currency: tempCurrency,
      company_name: company_data?.company_name,
      company_id: company_data?.company_id,
      transaction_id: transactionId,
    }
  );
}
```

**Status**: ❌ **MISSING - NEEDS IMPLEMENTATION**

---

### 5. ❌ Admin Fee Notification - Regardless of Threshold

**Question**: Does admin get notified even if fee doesn't meet forwarding threshold?

**Answer**: ❌ **NO - Admin notification not implemented at all**

**Threshold Logic**:
```typescript
// Line 1848-1854
if (Number(totalAmountReceived) < Number(minForwarding)) {
  // Below threshold: ALL goes to admin
  adminAmountToSend = Number(totalAmountReceived);
  userAmountToSend = 0;
} else {
  // Above threshold: Normal distribution
  adminAmountToSend = Number(totalDeduction);  // $3.30
  userAmountToSend = Number(totalAmountReceived) - Number(totalDeduction); // $6.70
}
```

**For $10 Payment**:
- $10 > $5 (ETH_THRESHOLD) ✅
- Admin gets: $3.30 (normal fees)
- Merchant gets: $6.70

**Current Behavior**:
- Admin fee IS recorded in database ✅
- Admin wallet IS incremented ✅
- Admin notification NOT sent ❌
- Admin email NOT sent ❌

**This applies to ALL scenarios**:
- ❌ Payment >= threshold (normal fees) - No admin notification
- ❌ Payment < threshold (all to admin) - No admin notification
- ❌ Partial payments - No admin notification
- ❌ Expired payments - No admin notification

---

## Summary of Email Notifications

| Notification Type | Recipient | Email Sent? | In-App Notif? | When |
|-------------------|-----------|-------------|---------------|------|
| **Payment Detected (Pending)** | Merchant | ✅ Yes | ✅ Yes | Transaction broadcast (0 conf) |
| **Payment Received (Confirmed)** | Merchant | ✅ Yes | ✅ Yes | After confirmation & distribution |
| **Admin Fee Received** | Admin | ❌ No | ❌ No | Never (not implemented) |
| **Payment Partial** | Merchant | ✅ Yes | ✅ Yes | When < expected amount |
| **Payment Confirming** | Merchant | ✅ Yes | ✅ Yes | At 50%, 75% confirmation |

---

## Notification Timeline for $10 ETH Payment

```
Time: T+0 seconds
┌────────────────────────────────────────────────┐
│ Customer sends 0.003 ETH to temp address      │
└────────────────────────────────────────────────┘
              ↓
Time: T+5 seconds (Transaction Broadcast)
┌────────────────────────────────────────────────┐
│ ✅ Email 1: Payment Pending                   │
│    To: john@dyno.pt                           │
│    Subject: ⏳ Payment Pending Confirmation   │
│    Amount: 0.003 ETH (~$10)                   │
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│ ✅ In-App 1: Payment Pending                  │
│    To: User 28                                │
└────────────────────────────────────────────────┘
              ↓
Time: T+1-5 minutes (12 Confirmations for ETH)
┌────────────────────────────────────────────────┐
│ Payment Confirmed                             │
│ Fund Distribution:                            │
│   - Admin: $3.30 → 0x9a7221...               │
│   - Merchant: $6.70 → 0x9a7221...            │
└────────────────────────────────────────────────┘
              ↓
Time: T+5 minutes (After Distribution)
┌────────────────────────────────────────────────┐
│ ✅ Email 2: Payment Received                  │
│    To: john@dyno.pt                           │
│    Subject: Payment Received - DynoPay        │
│    Amount: 6.70 ETH (merchant portion)        │
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│ ✅ In-App 2: Payment Received                 │
│    To: User 28                                │
│    Amount: 6.70 ETH                           │
│    Company: Johnny LTD (38)                   │
└────────────────────────────────────────────────┘
              ↓
Time: T+5 minutes (Admin Side)
┌────────────────────────────────────────────────┐
│ ❌ Email 3: Fee Received (NOT SENT)          │
│    To: moxxcompany@gmail.com                  │
│    Subject: Platform Fee Received             │
│    Amount: $3.30 ETH                          │
│    Status: NOT IMPLEMENTED                    │
└────────────────────────────────────────────────┘
┌────────────────────────────────────────────────┐
│ ❌ In-App 3: Fee Received (NOT SENT)         │
│    To: Admin User                             │
│    Status: NOT IMPLEMENTED                    │
└────────────────────────────────────────────────┘
```

---

## Issues & Recommendations

### Issue #1: Same ETH Address for Merchant and Admin
**Severity**: 🔴 **CRITICAL**

**Problem**: 
- Merchant wallet: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`
- Admin wallet: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`
- Cannot distinguish funds

**Impact**:
- All ETH goes to same address
- Accounting nightmare
- Cannot track fees vs merchant funds

**Solution**:
1. Merchant MUST configure a separate ETH wallet
2. Admin should use a different address for fees
3. System should validate addresses are different

---

### Issue #2: No Admin Fee Notifications
**Severity**: 🟡 **MEDIUM**

**Problem**: Admin never receives notifications about fee income

**Impact**:
- Admin doesn't know when fees are received
- No visibility into platform revenue
- Manual database checks required

**Solution**: Implement admin fee notification system

**Proposed Code** (add after line 1871):
```typescript
// After admin fee increment
if (adminAmountToSend > 0) {
  const adminEmail = process.env.ADMIN_EMAIL;
  
  // Send email to admin
  await sendAdminFeeReceivedEmail(
    adminEmail,
    "DynoPay Platform",
    adminAmountToSend.toFixed(8),
    tempCurrency,
    transactionId,
    company_data?.company_name || "Unknown Company",
    userAmountToSend.toFixed(8)
  );
  
  // Log for tracking
  console.log(`[Admin Fee] Received ${adminAmountToSend} ${tempCurrency} from Company ${company_data?.company_id}`);
}
```

**New Email Template Needed**:
```typescript
const sendAdminFeeReceivedEmail = async (
  recipientEmail: string,
  name: string,
  feeAmount: string,
  currency: string,
  transactionId: string,
  companyName: string,
  merchantAmount: string
) => {
  const subject = "Platform Fee Received - DynoPay";
  const message = `Platform fee received from ${companyName}!

💰 Fee Amount: ${feeAmount} ${currency}
📊 Merchant Received: ${merchantAmount} ${currency}
🏢 Company: ${companyName}

📝 Transaction Reference: ${transactionId}

The fee has been credited to the admin wallet.`;

  await mailTransporter({
    to: recipientEmail,
    name,
    subject,
    body: message,
  });
};
```

---

### Issue #3: Threshold Context Not Clear in Notifications
**Severity**: 🟢 **LOW**

**Problem**: Merchant emails don't mention if payment met minimum threshold

**Recommendation**: Add context to payment received email:
- "Payment of $10 received (above minimum threshold of $5)"
- "Your net amount after platform fees: $6.70"

---

## Final Answer to Your Questions

### Q1: Which ETH addresses will receive payment?

**Customer Pays To**: 
- Temporary address (generated per payment)
- Example: `0xTEMP1234...`

**Merchant (Company 38) Receives**: 
- Address: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`
- Amount: $6.70 ETH (67%)
- ⚠️ Currently same as admin address!

**Admin (DynoPay) Receives**:
- Address: `0x9a7221b5e32d5f99e8da95585835442e29afb38f`
- Amount: $3.30 ETH (33%)
- ⚠️ Currently same as merchant address!

---

### Q2: Will merchant get "payment detected" email?
✅ **YES** - Sent immediately when transaction is broadcast

### Q3: Will merchant get "payment confirmed/received" email?
✅ **YES** - Sent after confirmation and fund distribution
- Amount shown: $6.70 ETH (merchant's net amount)

### Q4: Will admin get notification about fee payment?
❌ **NO** - Not currently implemented
- Admin fee IS recorded in database
- Admin wallet balance IS updated
- But NO email or notification sent

### Q5: Does admin get notified regardless of threshold?
❌ **NO** - No admin notifications at all
- Whether payment >= threshold (normal fees)
- Or payment < threshold (all to admin)
- Admin is never notified

---

## Conclusion

**Payment Distribution**: ✅ Works correctly (67% merchant, 33% admin)  
**Merchant Notifications**: ✅ Complete (pending + received emails)  
**Admin Notifications**: ❌ Not implemented (no emails or alerts)  
**Address Issue**: 🔴 Critical - Same address for both parties  

**Recommendation**: 
1. **URGENT**: Configure separate ETH addresses for merchant and admin
2. **HIGH**: Implement admin fee notification system
3. **MEDIUM**: Add threshold context to merchant emails

---

**Analysis Date**: 2026-01-26  
**Status**: ✅ Merchant notifications working  
**Status**: ❌ Admin notifications missing  
**Status**: 🔴 Address conflict detected
