# PAYMENT FLOW DIAGRAM - THRESHOLD LOGIC
## DynoPay Minimum Forwarding Threshold

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CUSTOMER SENDS PAYMENT                              │
│                                                                              │
│                        Customer → Temporary Address                          │
│                              (Blockchain)                                     │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WEBHOOK RECEIVES NOTIFICATION                         │
│                                                                              │
│  1. Payment detected on blockchain                                           │
│  2. Amount received: X USD                                                   │
│  3. Currency: BTC/ETH/USDT-TRC20/etc.                                       │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GET THRESHOLD FOR CURRENCY                               │
│                                                                              │
│  getBlockchainThreshold(currency) → minForwarding                           │
│                                                                              │
│  BTC: $7  │  ETH: $5  │  USDT-TRC20: $10  │  TRX: $5  │  Others: $5       │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CALCULATE TRANSACTION FEES                               │
│                                                                              │
│  calculateTransactionFees(currency, amount) returns:                        │
│  {                                                                           │
│    fixedFee,                                                                │
│    transactionFee,                                                          │
│    blockchainBuffer,                                                        │
│    totalDeduction,                                                          │
│    minForwarding  ← THRESHOLD VALUE                                         │
│  }                                                                           │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  AMOUNT < THRESHOLD?   │
                    └───────┬────────────┬───┘
                            │            │
                   YES ─────┘            └───── NO
                    │                          │
                    ▼                          ▼
    ┌───────────────────────────┐  ┌──────────────────────────┐
    │   BELOW THRESHOLD         │  │   ABOVE THRESHOLD        │
    │                           │  │                          │
    │ Example: $6 BTC (< $7)    │  │ Example: $100 BTC (≥ $7) │
    └──────────┬────────────────┘  └────────────┬─────────────┘
               │                                 │
               ▼                                 ▼
┌──────────────────────────────┐  ┌─────────────────────────────┐
│  ROUTE 1: ALL TO ADMIN       │  │  ROUTE 2: SPLIT PAYMENT     │
│                              │  │                             │
│  adminAmountToSend = $6      │  │  adminAmountToSend = $6     │
│  userAmountToSend = $0       │  │    (fees)                   │
│                              │  │  userAmountToSend = $94     │
│  Reason: Payment too small   │  │    (after fees)             │
│  to cover blockchain costs   │  │                             │
└──────────────┬───────────────┘  └──────────────┬──────────────┘
               │                                  │
               │                                  │
               └─────────────┬────────────────────┘
                             │
                             ▼
           ┌─────────────────────────────────────────┐
           │   settleCryptoTransaction()             │
           │                                         │
           │   Parameters:                           │
           │   - receivedAmount: adminAmountToSend   │
           │   - userAmount: userAmountToSend        │
           │   - userAddress: merchant wallet        │
           └─────────────┬───────────────────────────┘
                         │
                         ▼
           ┌─────────────────────────────────────────┐
           │   Get Admin Wallet Address              │
           │                                         │
           │   getAdminWalletAddress(currency)       │
           │   → Admin wallet from .env              │
           │                                         │
           │   BTC → 1JH5TnZzj...                    │
           │   ETH → 0x9a7221b5e...                  │
           │   USDT-TRC20 → TTve8v6Y...              │
           └─────────────┬───────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────────────┐
        │   BLOCKCHAIN TRANSACTION EXECUTION         │
        └────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌───────────────────┐         ┌──────────────────────┐
│  TRANSACTION 1:   │         │  TRANSACTION 2:      │
│  Temp → Admin     │         │  Temp → Merchant     │
│                   │         │  (Only if above      │
│  Amount:          │         │   threshold)         │
│  adminAmountToSend│         │                      │
│                   │         │  Amount:             │
│  Always executed  │         │  userAmountToSend    │
└─────────┬─────────┘         └──────────┬───────────┘
          │                              │
          │                              │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │   Update Database Records    │
          │                              │
          │  - Update temp address       │
          │  - Increment admin fee       │
          │  - Update merchant wallet    │
          │    (only if above threshold) │
          └──────────────┬───────────────┘
                         │
                         ▼
          ┌──────────────────────────────┐
          │   FINAL STATE                │
          └──────────────────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌──────────────────┐          ┌────────────────────┐
│ BELOW THRESHOLD  │          │ ABOVE THRESHOLD    │
│                  │          │                    │
│ Admin Wallet:    │          │ Admin Wallet:      │
│   + $6 USD       │          │   + $6 USD (fees)  │
│                  │          │                    │
│ Merchant Wallet: │          │ Merchant Wallet:   │
│   + $0 USD       │          │   + $94 USD        │
│                  │          │                    │
│ Status:          │          │ Status:            │
│   "successful"   │          │   "successful"     │
└──────────────────┘          └────────────────────┘
```

---

## KEY DECISION POINTS

### Decision 1: Threshold Check
```typescript
if (Number(totalAmountReceived) < Number(minForwarding)) {
    // Below threshold path
} else {
    // Above threshold path
}
```

### Decision 2: Admin Amount Calculation

**Below Threshold:**
```typescript
adminAmountToSend = Number(totalAmountReceived);  // 100%
userAmountToSend = 0;                             // 0%
```

**Above Threshold:**
```typescript
adminAmountToSend = Number(totalDeduction);                      // Fees only
userAmountToSend = Number(totalAmountReceived) - Number(totalDeduction);  // Remainder
```

---

## EXAMPLES BY CURRENCY

### BTC ($7 threshold)
```
$6  BTC → Admin: $6,  Merchant: $0   ❌ Below threshold
$8  BTC → Admin: ~$5, Merchant: ~$3  ✅ Above threshold
$100 BTC → Admin: ~$6, Merchant: ~$94 ✅ Above threshold
```

### USDT-TRC20 ($10 threshold)
```
$8   USDT → Admin: $8,   Merchant: $0   ❌ Below threshold
$12  USDT → Admin: ~$5,  Merchant: ~$7  ✅ Above threshold
$100 USDT → Admin: ~$6,  Merchant: ~$94 ✅ Above threshold
```

### ETH ($5 threshold)
```
$4  ETH → Admin: $4,  Merchant: $0   ❌ Below threshold
$6  ETH → Admin: ~$5, Merchant: ~$1  ✅ Above threshold
$50 ETH → Admin: ~$5, Merchant: ~$45 ✅ Above threshold
```

---

## ADMIN WALLET DESTINATIONS

| Currency | Admin Wallet Address | Threshold |
|----------|---------------------|-----------|
| BTC | 1JH5TnZzjYTf1yYwBDLjWoHgkAcCHc1Do7 | $7 |
| ETH | 0x9a7221b5e32d5f99e8da95585835442e29afb38f | $5 |
| LTC | LM179QVx32QMtEzkhJZnvMdQgJfkAbf3fm | $5 |
| DOGE | DEReH1ES1zT8MUtkBQPqLqYGWrJhw2gCUL | $5 |
| TRX | TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR | $5 |
| USDT-TRC20 | TTve8v6Y48ChsCTEiCjMRFSbjNtz4mAkxR | $10 |
| USDT-ERC20 | 0x9a7221b5e32d5f99e8da95585835442e29afb38f | $5 |
| BCH | (Not configured) | $5 |

---

## RATIONALE

**Purpose:** Prevent uneconomical blockchain transactions where network fees would consume most or all of the payment value.

**Why Admin Receives Below-Threshold Payments:**
1. Blockchain fees don't scale linearly with amount
2. Small payments may cost more in fees than the payment itself
3. Admin can accumulate and batch process these payments
4. Protects merchant from receiving unprofitable transactions
5. Admin handles edge cases manually

**Economic Examples:**
```
Scenario 1: $6 BTC payment
- Gas/Network fee: ~$5
- DynoPay fees: ~$5
- Total cost: ~$10
- Net to merchant: -$4 (LOSS)
✅ Solution: Send to admin instead

Scenario 2: $100 BTC payment
- Gas/Network fee: ~$5
- DynoPay fees: ~$6
- Total cost: ~$11
- Net to merchant: $89 (PROFIT)
✅ Solution: Process normally
```
