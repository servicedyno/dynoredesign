# Final Confirmed Understanding: Per-Merchant Pool System

## 1. Supported Chains (Updated with USDC)

```typescript
// UPDATED: 10 supported crypto types
const CRYPTO_TYPES = [
  'BTC',          // Bitcoin (UTXO)
  'ETH',          // Ethereum (Account-based)
  'LTC',          // Litecoin (UTXO)
  'DOGE',         // Dogecoin (UTXO)
  'TRX',          // Tron (Account-based)
  'BCH',          // Bitcoin Cash (UTXO)
  'USDT-TRC20',   // Tether on Tron
  'USDT-ERC20',   // Tether on Ethereum
  'USDC-TRC20',   // USD Coin on Tron (NEW)
  'USDC-ERC20',   // USD Coin on Ethereum (NEW)
];
```

### Chain Categories:

| Type | Chains | xpub Derivation | Gas Token |
|------|--------|-----------------|-----------|
| **UTXO** | BTC, LTC, DOGE, BCH | Own xpub each | From payment itself |
| **Account-based** | ETH, TRX | Own xpub each | ETH / TRX |
| **Token (Tron)** | USDT-TRC20, USDC-TRC20 | Uses TRX xpub | TRX |
| **Token (Ethereum)** | USDT-ERC20, USDC-ERC20 | Uses ETH xpub | ETH |

### xpub Generation at Signup:
```
Merchant signs up → Generate 6 xpubs:
├── BTC xpub
├── ETH xpub   ← Used by: ETH, USDT-ERC20, USDC-ERC20
├── LTC xpub
├── DOGE xpub
├── TRX xpub   ← Used by: TRX, USDT-TRC20, USDC-TRC20
└── BCH xpub
```

---

## 2. Company Wallet Validation (Confirmed)

### Current Flow (Preserved):
```
┌─────────────────────────────────────────────────────────────┐
│  PAYMENT REQUEST                                            │
│                                                             │
│  Step 1: Get merchant's configured wallets for THIS company │
│                                                             │
│  SELECT DISTINCT wallet_type FROM tbl_user_wallet           │
│  WHERE user_id = :merchantId                                │
│  AND company_id = :companyId    ← COMPANY-SPECIFIC!         │
│  AND wallet_type IN (:CRYPTO_TYPES)                         │
│  AND wallet_address IS NOT NULL                             │
│                                                             │
│  Result: ['BTC', 'ETH', 'USDT-TRC20']  (example)           │
│                                                             │
│  Step 2: Validate requested currency is in list             │
│                                                             │
│  IF customer requests 'LTC' AND 'LTC' NOT IN list:         │
│     → Error: "LTC is not available for this payment"        │
│                                                             │
│  Step 3: Reserve temp address from merchant's pool          │
│                                                             │
│  Only proceed if validation passes!                         │
└─────────────────────────────────────────────────────────────┘
```

### Multi-Company Scenario:
```
MERCHANT (user_id=1)
├── Company A (company_id=10)
│   └── Configured: [BTC, ETH]           ← Only BTC/ETH available
├── Company B (company_id=20)
│   └── Configured: [BTC, ETH, USDT-TRC20, USDC-ERC20]  ← More options
└── Company C (company_id=30)
    └── Configured: [USDT-TRC20]         ← Only USDT-TRC20

Payment via Company A API key → Can only pay with BTC or ETH
Payment via Company B API key → Can pay with BTC, ETH, USDT-TRC20, USDC-ERC20
Payment via Company C API key → Can only pay with USDT-TRC20
```

### Validation Points:
1. **API Service** (`getAvailableCurrencies`): Checks `tbl_user_wallet` per company
2. **Payment Controller**: Validates requested currency against available list
3. **Merchant Wallet Check**: Confirms merchant has receiving address for currency

---

## 3. Per-Merchant Temp Address Pool

### Pool Creation Trigger:
```
MERCHANT adds BTC wallet for Company A
      │
      ▼
System checks: Does merchant have BTC pool addresses?
      │
      ├── YES: Pool already exists, no action needed
      │        (Pool is shared across all merchant's companies)
      │
      └── NO: Create initial pool
              ├── Derive address[0] from merchant's BTC xpub
              ├── Derive address[1] from merchant's BTC xpub
              ├── Create Tatum subscriptions
              └── Status: AVAILABLE
```

### Key Point: Pool is Per-MERCHANT, Wallets are Per-COMPANY
```
MERCHANT's BTC Pool (shared):
├── temp_addr_1 (owner_user_id=1)
├── temp_addr_2 (owner_user_id=1)
└── ... derived from merchant's BTC xpub

COMPANY-level wallets (separate):
├── Company A: BTC receiving wallet = bc1abc...
├── Company B: BTC receiving wallet = bc1xyz...
└── Company C: (no BTC wallet configured)

When payment arrives:
1. Temp address belongs to MERCHANT
2. Merchant wallet lookup uses COMPANY_ID
3. Funds sent to correct company's receiving wallet
```

---

## 4. Complete Payment Flow

```
┌─────────────────────────────────────────────────────────────┐
│  CUSTOMER PAYMENT REQUEST (via Company B API)               │
│                                                             │
│  1. VALIDATE COMPANY WALLET                                 │
│     ├── Get available currencies for Company B              │
│     ├── Result: [BTC, ETH, USDT-TRC20, USDC-ERC20]         │
│     └── Requested: BTC ✓ (in list, proceed)                │
│                                                             │
│  2. GET/CREATE TEMP ADDRESS                                 │
│     ├── Find merchant (user_id) from Company B              │
│     ├── Check merchant's BTC pool:                          │
│     │   SELECT FROM tbl_merchant_temp_address               │
│     │   WHERE owner_user_id = :merchantId                   │
│     │   AND wallet_type = 'BTC'                             │
│     │   AND status = 'AVAILABLE'                            │
│     │   ORDER BY admin_fee_balance DESC                     │
│     ├── If found: Reserve it                                │
│     └── If not: Derive new from merchant's BTC xpub         │
│                                                             │
│  3. RESERVE ADDRESS                                         │
│     ├── status = 'RESERVED'                                 │
│     ├── current_company_id = Company B's ID                 │
│     ├── current_payment_id = payment reference              │
│     ├── expected_amount = 0.003 BTC                         │
│     └── reserved_until = NOW() + 30 minutes                 │
│                                                             │
│  4. RETURN TO CUSTOMER                                      │
│     └── { address: "bc1...", amount: "0.003", qr_code }    │
│                                                             │
│  5. PAYMENT RECEIVED (webhook)                              │
│     ├── Validate: address belongs to merchant               │
│     ├── Get Company B's BTC receiving wallet                │
│     ├── Calculate: merchant_amount, admin_fee               │
│     ├── Transfer to Company B's wallet                      │
│     ├── Accumulate admin fee in temp address                │
│     └── Release address to AVAILABLE                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Admin Wallet Configuration (for USDC)

### .env additions needed:
```bash
# USDC Admin Wallets (for sweep destination)
USDC_TRC20=<admin TRC20 address for USDC>
USDC_ERC20=<admin ERC20 address for USDC>
USDC_TRC20_ADMIN_WALLET=<same or different>
USDC_ERC20_ADMIN_WALLET=<same or different>

# USDC Thresholds
USDC_TRC20_THRESHOLD=3
USDC_ERC20_THRESHOLD=3
```

### Token Contract Addresses:
```bash
# USDC Contracts (for transfers)
USDC_TRC20_CONTRACT=<Tron USDC contract address>
USDC_ERC20_CONTRACT=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  # Mainnet USDC
```

---

## 6. Summary Confirmation ✅

| Item | Status |
|------|--------|
| **Supported chains**: 10 (BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20, USDC-TRC20, USDC-ERC20) | ✅ |
| **xpub generation**: At merchant signup (6 xpubs, tokens share parent chain) | ✅ |
| **Pool creation**: When merchant adds wallet for any chain | ✅ |
| **Initial pool size**: 2 addresses per chain | ✅ |
| **Company wallet validation**: Only configured wallets available | ✅ |
| **Address selection**: `admin_fee_balance DESC, total_transactions DESC` | ✅ |
| **Pool ownership**: Per-MERCHANT (`owner_user_id`) | ✅ |
| **Wallet ownership**: Per-COMPANY (`company_id`) | ✅ |
| **Audit trail**: Preserve with merchant attribution | ✅ |
| **Sweep records**: Preserve with merchant attribution | ✅ |
| **Dashboard**: Per-merchant view + Admin global view | ✅ |
| **Late payment**: No auto-match (goes to `owner_user_id`) | ✅ |

---

## 7. Implementation Checklist

### Database:
- [ ] Create `tbl_merchant_wallet` (xpub storage)
- [ ] Create `tbl_merchant_temp_address` (pool addresses)
- [ ] Create `tbl_merchant_pool_transaction` (audit)
- [ ] Create `tbl_merchant_pool_sweep` (sweep records)

### Backend:
- [ ] Add USDC-TRC20, USDC-ERC20 to `CRYPTO_TYPES`
- [ ] Generate xpubs at merchant registration
- [ ] Create pool on wallet configuration
- [ ] Modify temp address reservation to use merchant pool
- [ ] Update webhook handlers for per-merchant pool
- [ ] Add USDC contract addresses and thresholds

### Validation:
- [ ] Preserve company-level wallet validation
- [ ] Ensure only configured currencies available
- [ ] Test multi-company scenarios

**Ready to implement when you confirm!**
