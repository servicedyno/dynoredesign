# Confirmed Understanding: Per-Merchant Pool for ALL Blockchains

## 1. Supported Blockchains

**All 8 chains will have per-merchant xpub:**
```
CRYPTO_TYPES = [
  'BTC',          // Bitcoin (UTXO)
  'ETH',          // Ethereum (Account-based)
  'LTC',          // Litecoin (UTXO)
  'DOGE',         // Dogecoin (UTXO)
  'TRX',          // Tron (Account-based)
  'BCH',          // Bitcoin Cash (UTXO)
  'USDT-TRC20',   // Tether on Tron (Token)
  'USDT-ERC20',   // Tether on Ethereum (Token)
]
```

## 2. Benefits of Per-Merchant Pool for ALL Chains

| Benefit | Description |
|---------|-------------|
| **Complete Isolation** | Each merchant's funds are on completely separate addresses |
| **No Cross-Merchant Risk** | Impossible for Merchant A's payment to go to Merchant B |
| **Late Payments Safe** | Even if customer pays late, funds go to correct merchant |
| **Clear Fee Attribution** | Admin fees per merchant easily tracked |
| **Simpler Error Handling** | No auto-matching complexity needed |
| **Better Auditability** | Clear ownership chain for compliance |
| **Multi-Company Support** | All companies under a merchant share same pool (safe) |
| **Scalable** | Each merchant's pool grows independently |
| **Security** | Different HD wallet roots = cryptographic isolation |

## 3. xpub Generation at Merchant Signup

**When:** Merchant registers on DynoPay

**What happens:**
```
MERCHANT SIGNUP
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│  Generate xpub/mnemonic for EACH supported chain:           │
│                                                             │
│  tbl_merchant_wallet:                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ user_id │ wallet_type  │ xpub_mnemonic │ last_index │   │
│  ├─────────┼──────────────┼───────────────┼────────────┤   │
│  │    1    │ BTC          │ encrypted...  │     0      │   │
│  │    1    │ ETH          │ encrypted...  │     0      │   │
│  │    1    │ LTC          │ encrypted...  │     0      │   │
│  │    1    │ DOGE         │ encrypted...  │     0      │   │
│  │    1    │ TRX          │ encrypted...  │     0      │   │
│  │    1    │ BCH          │ encrypted...  │     0      │   │
│  │    1    │ USDT-TRC20   │ (uses TRX)    │     0      │   │
│  │    1    │ USDT-ERC20   │ (uses ETH)    │     0      │   │
│  └─────────┴──────────────┴───────────────┴────────────┘   │
│                                                             │
│  Note: USDT-TRC20 uses TRX xpub, USDT-ERC20 uses ETH xpub  │
└─────────────────────────────────────────────────────────────┘
```

## 4. Temporary Address Generation Flow

**When payment is requested:**
```
┌─────────────────────────────────────────────────────────────┐
│  PAYMENT REQUEST (e.g., BTC payment for Company A)          │
│                                                             │
│  1. Get company_id → Get merchant (user_id)                 │
│  2. Look for AVAILABLE temp address in merchant's pool:     │
│                                                             │
│     SELECT FROM tbl_merchant_temp_address                   │
│     WHERE owner_user_id = :merchantId                       │
│     AND wallet_type = 'BTC'                                 │
│     AND status = 'AVAILABLE'                                │
│     ORDER BY admin_fee_balance DESC                         │
│                                                             │
│  3. If found → Reserve it                                   │
│     If NOT found → Derive new from merchant's BTC xpub      │
│                                                             │
│  4. Create Tatum subscription for webhook                   │
│  5. Return address to customer                              │
└─────────────────────────────────────────────────────────────┘
```

## 5. Address Rotation (States)

```
AVAILABLE ──────► RESERVED ──────► PROCESSING ──────► AVAILABLE
    │                │                  │                  │
    │                │                  │                  │
    │         (30 min timeout)    (Payment received)   (Released)
    │                │                  │                  
    │                ▼                  │                  
    │         Back to AVAILABLE        │                  
    │         (same merchant)          │                  
    │                                   │                  
    │                                   ▼                  
    │                           If sweep needed:           
    │                           SWEEPING → AVAILABLE       
    │                                                      
    └─► All in use? Derive NEW address from merchant's xpub
```

## 6. Two Payment Channels

### A. Hosted Checkout (DynoPay's UI) - SUPPORTS PARTIAL PAYMENTS

```
┌─────────────────────────────────────────────────────────────┐
│  HOSTED CHECKOUT FLOW                                       │
│  Endpoint: /api/pay/createPaymentLink + Checkout UI         │
│                                                             │
│  1. Merchant creates payment link ($100 USD)                │
│  2. Customer opens checkout UI, selects BTC                 │
│  3. System reserves temp address from merchant's pool       │
│  4. Customer can pay in MULTIPLE transactions:              │
│                                                             │
│     Payment 1: 0.002 BTC (partial)                         │
│        → Status: "partial"                                  │
│        → 30-minute grace period starts                      │
│        → Notify customer: "Send remaining 0.001 BTC"        │
│                                                             │
│     Payment 2: 0.001 BTC (completes payment)               │
│        → Status: "completed"                                │
│        → Process full amount (0.003 BTC)                    │
│                                                             │
│  5. If grace period expires with partial:                   │
│     → processIncompletePayments() cron                      │
│     → Process whatever was received                         │
│     → Status: "completed_partial"                           │
│                                                             │
│  KEY: UI guides customer through partial payment flow       │
└─────────────────────────────────────────────────────────────┘
```

### B. Custom Crypto API (Merchant's Own UI) - NO PARTIAL PAYMENTS

```
┌─────────────────────────────────────────────────────────────┐
│  CUSTOM API FLOW                                            │
│  Endpoint: POST /api/v1/crypto-payment                      │
│  Service: api-service (port 3301)                           │
│                                                             │
│  1. Merchant's backend calls API with customer token        │
│  2. System reserves temp address from merchant's pool       │
│  3. Returns: { address, qr_code, crypto_amount }            │
│  4. Merchant displays on THEIR own UI                       │
│                                                             │
│  5. Customer sends EXACT amount in SINGLE transaction       │
│                                                             │
│  6. Payment verification:                                   │
│     - Full payment → Process immediately                    │
│     - Underpayment → Merchant handles (no auto partial)     │
│     - Overpayment → All goes to merchant (minus fees)       │
│                                                             │
│  KEY: Merchant responsible for UI and partial handling      │
│  System does NOT auto-wait for more payments                │
└─────────────────────────────────────────────────────────────┘
```

### Key Differences:

| Aspect | Hosted Checkout | Custom API |
|--------|-----------------|------------|
| UI | DynoPay's checkout | Merchant's own |
| Partial Payment | ✅ Supported (30 min grace) | ❌ Not supported |
| Multiple TXs | ✅ Yes, tracked | ❌ No, single TX expected |
| Grace Period | ✅ 30 minutes | ❌ None |
| Error Handling | DynoPay handles | Merchant handles |

## 7. Fund Distribution Logic

### Fee Payer Modes:

**A. Company Pays Fees (Default):**
```
Customer pays: 0.003 BTC (exact crypto amount)
System calculates:
  - Convert to USD: $100 USD
  - Fee tier lookup: 2% + $3 fixed = $5 fee
  - Admin fee: 5% of 0.003 BTC = 0.00015 BTC
  - Merchant receives: 0.00285 BTC

Distribution:
  ├── Merchant wallet: 0.00285 BTC
  └── Admin fee: 0.00015 BTC (retained for sweep or sent)
```

**B. Customer Pays Fees:**
```
Base amount: $100 USD = 0.003 BTC
System adds fees: 5% = 0.00015 BTC
Customer pays: 0.00315 BTC (crypto + fees)

Distribution:
  ├── Merchant wallet: 0.003 BTC (original amount)
  └── Admin fee: 0.00015 BTC (the extra customer paid)
```

### Threshold Logic:
```
┌─────────────────────────────────────────────────────────────┐
│  IF received_amount_usd < min_forwarding_threshold:         │
│     → 100% to admin fee                                     │
│     → Merchant gets $0                                      │
│     → Reason: Gas cost would exceed merchant amount         │
│                                                             │
│  Thresholds (from .env):                                    │
│  BTC_THRESHOLD=3       # $3 USD minimum                     │
│  ETH_THRESHOLD=3                                            │
│  USDT_TRC20_THRESHOLD=3                                     │
│  USDT_ERC20_THRESHOLD=3                                     │
│  TRX_THRESHOLD=3                                            │
│  LTC_THRESHOLD=3                                            │
│  DOGE_THRESHOLD=3                                           │
│  BCH_THRESHOLD=3                                            │
└─────────────────────────────────────────────────────────────┘
```

## 8. Partial Payment Mechanism (Hosted Checkout Only)

```
┌─────────────────────────────────────────────────────────────┐
│  PARTIAL PAYMENT FLOW (Hosted Checkout)                     │
│                                                             │
│  Expected: 0.003 BTC                                        │
│                                                             │
│  Step 1: Customer sends 0.002 BTC                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Webhook triggers                                     │   │
│  │ Received (0.002) < Expected (0.003)                  │   │
│  │ → Mark status = "partial"                            │   │
│  │ → Set partial_payment_timestamp = NOW()              │   │
│  │ → Extend reservation 30 minutes                      │   │
│  │ → Send notification: "Pay remaining 0.001 BTC"       │   │
│  │ → Store in Redis: previousAmount = 0.002             │   │
│  │ → Address stays RESERVED                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Step 2a: Customer sends remaining 0.001 BTC (within 30m)  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Webhook triggers                                     │   │
│  │ Total = previousAmount + received = 0.003 BTC        │   │
│  │ Total >= Expected                                    │   │
│  │ → Mark status = "completed"                          │   │
│  │ → Process full 0.003 BTC                             │   │
│  │ → Distribute: merchant + admin fee                   │   │
│  │ → Release address to AVAILABLE                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Step 2b: 30 minutes expire (no additional payment)        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Cron: processIncompletePayments()                    │   │
│  │ → Found partial with expired grace period            │   │
│  │ → Get actual balance on-chain                        │   │
│  │ → Process whatever was received (0.002 BTC)          │   │
│  │ → Apply threshold logic:                             │   │
│  │   - If >= threshold: split merchant + admin          │   │
│  │   - If < threshold: 100% to admin                    │   │
│  │ → Mark status = "completed_partial"                  │   │
│  │ → Release address to AVAILABLE                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 9. Gas Funding & Leftover Optimization

### Chain Types:

**UTXO Chains (BTC, LTC, DOGE, BCH):**
- Gas (mining fee) paid FROM the payment itself
- No separate gas funding needed
- Admin fee included in same transaction output

**Account-based Chains (ETH, TRX, USDT-TRC20, USDT-ERC20):**
- Need native token for gas (ETH or TRX)
- Admin maintains fee wallets: ETH_FEE_WALLET, TRX_FEE_WALLET
- Fund gas before merchant transfer

### Gas Funding Flow:
```
┌─────────────────────────────────────────────────────────────┐
│  BEFORE MERCHANT TRANSFER (Account-based chains):           │
│                                                             │
│  1. Check current gas balance on temp address               │
│     currentGas = getAddressBalance(address, ETH/TRX)        │
│                                                             │
│  2. Calculate deficit:                                      │
│     requiredGas = 0.004 ETH (or 60 TRX)                     │
│     deficit = requiredGas - currentGas                      │
│                                                             │
│  3. Decision:                                               │
│     IF deficit <= minDeficit (0.001 ETH / 10 TRX):         │
│        → Use leftover gas, no funding                       │
│     ELSE:                                                   │
│        → Transfer ONLY deficit from fee wallet              │
│                                                             │
│  4. Execute merchant transfer using gas                     │
│                                                             │
│  5. Track leftover for next transaction                     │
└─────────────────────────────────────────────────────────────┘

EXAMPLE:
TX #1: Fund 0.004 ETH, use 0.003 ETH → Leftover 0.001 ETH
TX #2: Need 0.004 ETH, have 0.001 ETH → Fund 0.003 ETH (not full 0.004)
TX #3: Need 0.004 ETH, have 0.0035 ETH → Deficit 0.0005 < 0.001 minDeficit
       → NO FUNDING, use existing 0.0035 ETH
```

## 10. Admin Fee Sweep Logic

### UTXO Chains (BTC, LTC, DOGE, BCH):
```
- Admin fee sent in SAME transaction as merchant payment
- Multi-output transaction: [merchant, admin]
- No separate sweep needed
- admin_status = "successful" immediately
```

### Account-based Chains (ETH, TRX, USDT):
```
- Admin fee RETAINED in temp address
- admin_status = "pending_sweep"
- Accumulated until threshold ($30 default)
- Cron sweeps to admin wallet when threshold reached
```

### Sweep Process:
```
1. Find addresses with admin_fee_balance >= SWEEP_THRESHOLD
2. For each eligible address:
   a. Mark status = "SWEEPING"
   b. Fund gas if needed
   c. Transfer ALL balance to admin wallet
   d. Reset admin_fee_balance = 0
   e. Mark status = "AVAILABLE"
   f. Process any queued payments (arrived during sweep)
```

## 11. Edge Cases Handled

| Edge Case | Global Pool (Current) | Per-Merchant Pool (Proposed) |
|-----------|----------------------|------------------------------|
| Late payment | Auto-matching (risky) | Goes to correct merchant (safe) |
| Cross-merchant mixing | Possible | Impossible |
| Payment during sweep | Queued, processed after | Same, but per-merchant |
| Stuck addresses | 2-hour force release | Same |
| Pool exhaustion | New address (shared) | New address (merchant-specific) |
| Partial payment timeout | Process received | Same |
| Under threshold | 100% to admin | Same |
| Overpayment | All to merchant | Same |

## 12. Summary Confirmation ✅

**I understand:**

1. ✅ **xpub generation at signup** for ALL 8 chains (BTC, ETH, LTC, DOGE, TRX, BCH + USDT-TRC20/ERC20)
2. ✅ **Temporary addresses** derived from merchant's xpub per chain
3. ✅ **Address rotation**: AVAILABLE → RESERVED → PROCESSING → AVAILABLE
4. ✅ **Auto-expansion**: Derive new address if all in use
5. ✅ **Two payment channels**:
   - Hosted Checkout: Partial payments supported (30-min grace)
   - Custom API: No partial payments (single TX expected)
6. ✅ **Fund distribution**:
   - Company pays fees: Fees deducted from received amount
   - Customer pays fees: Merchant gets base amount, DynoPay keeps extra
7. ✅ **Threshold logic**: Under threshold = 100% to admin
8. ✅ **Gas funding**: Only fund deficit, use leftovers
9. ✅ **Sweep**: UTXO = immediate, Account-based = accumulated + swept
10. ✅ **Multiple companies** under merchant share pool (safe)

**Ready to implement when you confirm!**
