# Wallet Blockchain Type Validation - Visual Guide

## 🎯 Business Rule Enforced

```
╔═══════════════════════════════════════════════════════════╗
║  ONE WALLET ADDRESS PER BLOCKCHAIN TYPE PER COMPANY      ║
╚═══════════════════════════════════════════════════════════╝
```

---

## ✅ Allowed Configuration

### Company A - Multiple Blockchains
```
┌─────────────────────────────────────────┐
│  COMPANY A (ID: 1)                      │
├─────────────────────────────────────────┤
│                                         │
│  BTC  → 1JH5TnZzjY...          ✅      │
│  ETH  → 0x9a7221b5e...         ✅      │
│  TRX  → TTve8v6Y48...          ✅      │
│  LTC  → LM179QVx32...          ✅      │
│  USDT-TRC20 → TTve8v6Y48...    ✅      │
│                                         │
└─────────────────────────────────────────┘
```

### Company B - Can Use Same Addresses
```
┌─────────────────────────────────────────┐
│  COMPANY B (ID: 2)                      │
├─────────────────────────────────────────┤
│                                         │
│  BTC  → 1JH5TnZzjY...          ✅      │  ← Same as Company A
│  ETH  → 0x9a7221b5e...         ✅      │  ← OK, different company
│                                         │
└─────────────────────────────────────────┘
```

---

## ❌ Blocked Configuration

### Attempting to Add Duplicate BTC Wallet
```
┌─────────────────────────────────────────┐
│  COMPANY A (ID: 1)                      │
├─────────────────────────────────────────┤
│                                         │
│  BTC  → 1JH5TnZzjY...          ✅      │  ← Already exists
│  ETH  → 0x9a7221b5e...         ✅      │
│                                         │
│  Trying to add:                         │
│  BTC  → 3J98t1WpEZ...          ❌      │  ← BLOCKED!
│                                         │
│  ⚠️  Error: "A BTC wallet address       │
│     already exists for this company!"   │
│                                         │
└─────────────────────────────────────────┘
```

---

## 🔄 Payment Flow Architecture

### Why This Restriction Exists

```
Customer Makes Payment
         ↓
    ┌────────────────────┐
    │ Temporary Address  │  ← Unique per payment
    │ (Auto-generated)   │
    └────────┬───────────┘
             ↓
    ┌────────────────────┐
    │ Payment Received   │
    │ & Verified         │
    └────────┬───────────┘
             ↓
    ┌────────────────────┐
    │ Split Payment      │
    └────┬──────────┬────┘
         ↓          ↓
    ┌────────┐ ┌──────────────────────┐
    │ Admin  │ │ Merchant Wallet      │
    │ Wallet │ │ (ONE per blockchain) │ ← This is what we validate
    │ (Fees) │ │                      │
    └────────┘ └──────────────────────┘
         │              │
         ↓              ↓
    [Platform]    [Company A's BTC Wallet]
```

**Key Points:**
1. Each payment creates a temporary address
2. After verification, payment is split:
   - Platform fees → Admin wallet
   - Merchant portion → **Merchant's configured wallet**
3. **One destination per blockchain** = Simple, reliable forwarding

---

## 📊 Validation Logic Flow

```
                    START
                      ↓
         ┌────────────────────────┐
         │ Merchant Adds Wallet   │
         │ POST /validateWallet   │
         └────────┬───────────────┘
                  ↓
         ┌────────────────────────┐
         │ Validate Input:        │
         │ • Wallet Address       │
         │ • Currency Type        │
         │ • Company ID           │
         └────────┬───────────────┘
                  ↓
         ┌────────────────────────┐
         │ Check Database:        │
         │ Does company already   │
         │ have this blockchain?  │
         └────────┬───────────────┘
                  ↓
          ┌──────┴──────┐
          ↓             ↓
     ┌─────────┐   ┌─────────┐
     │  YES    │   │   NO    │
     │ EXISTS  │   │ NEW     │
     └────┬────┘   └────┬────┘
          ↓             ↓
     ┌──────────┐  ┌──────────┐
     │ BLOCKED  │  │ ALLOWED  │
     │ Return   │  │ Send OTP │
     │ 400      │  │ Continue │
     └──────────┘  └──────────┘
```

---

## 🗄️ Database Check

### Query Performed
```sql
SELECT * FROM tbl_user_wallet
WHERE wallet_address IS NOT NULL
  AND wallet_type = 'BTC'       -- The blockchain type
  AND user_id = 123             -- The user
  AND company_id = 1            -- The company

-- If any record found → BLOCK
-- If no record found → ALLOW
```

### Example Data

**Before Validation:**
```
┌───────────┬─────────┬────────────┬──────────────┬────────────────────┐
│ wallet_id │ user_id │ company_id │ wallet_type  │ wallet_address     │
├───────────┼─────────┼────────────┼──────────────┼────────────────────┤
│ 1         │ 123     │ 1          │ BTC          │ 1JH5TnZzjY...     │
│ 2         │ 123     │ 1          │ ETH          │ 0x9a7221b5e...    │
│ 3         │ 123     │ 1          │ TRX          │ NULL              │
│ 4         │ 123     │ 2          │ BTC          │ 3J98t1WpEZ...     │
└───────────┴─────────┴────────────┴──────────────┴────────────────────┘
```

**Validation Scenarios:**

1. **Try to add second BTC wallet to Company 1:**
   ```
   ❌ BLOCKED - Record #1 already has BTC for Company 1
   ```

2. **Try to add TRX wallet to Company 1:**
   ```
   ✅ ALLOWED - Record #3 has TRX but wallet_address is NULL
   ```

3. **Try to add BTC wallet to Company 3:**
   ```
   ✅ ALLOWED - No BTC wallet exists for Company 3
   ```

---

## 🎬 Real-World Example

### Scenario: E-commerce Company Setup

```
╔═══════════════════════════════════════════╗
║  ACME Corp - Payment Setup               ║
╚═══════════════════════════════════════════╝

Day 1: Setup Bitcoin
┌──────────────────────────────────────────┐
│ Action: Add BTC wallet                   │
│ Address: 1AcmeCorpBTC123...              │
│ Result: ✅ Success - OTP sent            │
└──────────────────────────────────────────┘

Day 2: Setup Ethereum  
┌──────────────────────────────────────────┐
│ Action: Add ETH wallet                   │
│ Address: 0xAcmeCorpETH456...             │
│ Result: ✅ Success - OTP sent            │
└──────────────────────────────────────────┘

Day 3: Try to add backup BTC wallet
┌──────────────────────────────────────────┐
│ Action: Add second BTC wallet            │
│ Address: 1AcmeBackupBTC789...            │
│ Result: ❌ BLOCKED                       │
│                                          │
│ Error Message:                           │
│ "A BTC wallet address already exists     │
│  for this company! Each company can      │
│  only have one wallet address per        │
│  blockchain type. Existing address:      │
│  1AcmeCorp..."                           │
└──────────────────────────────────────────┘

ACME Corp's Final Configuration:
┌──────────────────────────────────────────┐
│ • BTC:  1AcmeCorpBTC123...               │
│ • ETH:  0xAcmeCorpETH456...              │
│ • TRX:  Not configured                   │
│ • LTC:  Not configured                   │
└──────────────────────────────────────────┘
```

---

## 🔧 Implementation Details

### Code Location
**File:** `/app/backend/controller/walletController.ts`
**Function:** `validateWallet` (lines 2592-2671)
**Validation:** Lines 2620-2637

### Key Code Snippet
```typescript
// Check if company already has a wallet for this blockchain type
const existingWallet = await userWalletModel.findOne({
  where: {
    wallet_address: { [Op.not]: null },
    wallet_type: currency,      // ← Blockchain type (BTC, ETH, etc.)
    user_id: user_id,
    company_id: company_id      // ← Company scope
  },
});

if (existingWallet) {
  return errorResponseHelper(
    res, 400,
    `A ${currency} wallet address already exists for this company!`
  );
}
```

---

## 📱 API Response Examples

### Success: First BTC Wallet
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Address is a valid address and saved successfully!",
  "data": {
    "valid": true,
    "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
    "wallet_name": "BTC Main Wallet",
    "company_id": 1
  }
}
```

### Error: Duplicate BTC Wallet
```json
{
  "success": false,
  "statusCode": 400,
  "message": "A BTC wallet address already exists for this company! Each company can only have one wallet address per blockchain type. Existing address: 1JH5TnZzjY..."
}
```

---

## ⚡ Benefits of This Restriction

```
┌───────────────────────────────────────────────┐
│  ✅ Clean Architecture                        │
│     • One destination per blockchain          │
│     • No routing confusion                    │
│                                               │
│  ✅ Simple Accounting                         │
│     • One address = one ledger entry          │
│     • Clear reconciliation                    │
│                                               │
│  ✅ Reliable Forwarding                       │
│     • No ambiguity in payment routing         │
│     • Consistent threshold checking           │
│                                               │
│  ✅ Better Security                           │
│     • Fewer addresses = smaller attack surface│
│     • Easier to monitor                       │
│                                               │
│  ✅ Clear User Experience                     │
│     • Merchants know exactly where funds go   │
│     • No confusion about multiple addresses   │
└───────────────────────────────────────────────┘
```

---

## 🎓 Summary

The validation ensures that:

1. **Each company** can configure **ONE wallet address** per blockchain type
2. **Different companies** can use the same address (no conflict)
3. **Different blockchains** for the same company are allowed (BTC + ETH + TRX = OK)
4. **Duplicate blockchain types** for the same company are blocked (BTC + BTC = ❌)

This creates a clean, maintainable, and secure payment forwarding architecture where every payment knows exactly where to go.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│   🎉 Validation Successfully Implemented!       │
│                                                  │
│   Backend: ✅ Running                           │
│   Validation: ✅ Active                         │
│   Documentation: ✅ Complete                    │
│                                                  │
└──────────────────────────────────────────────────┘
```
