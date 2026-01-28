# Complete Understanding: Per-Merchant Pool for ALL Chains

## Confirmed: Address Selection Priority for ALL Chains

```typescript
// Applies to: BTC, ETH, LTC, DOGE, TRX, BCH, USDT-TRC20, USDT-ERC20
const tempAddress = await merchantTempAddressModel.findOne({
  where: {
    wallet_type: walletType,
    status: "AVAILABLE",
    owner_user_id: merchantId,  // Per-merchant isolation
  },
  order: [
    ["admin_fee_balance", "DESC"],   // 1st: Highest accumulated admin fee
    ["total_transactions", "DESC"],  // 2nd: Most active addresses
  ],
});
```

**Reason**: Prioritize addresses close to sweep threshold → consolidate fees faster.

---

## Features Implemented in Global Pool - Analysis for Per-Merchant Pool

### ✅ DISCUSSED Features (Will Preserve)

| Feature | Status | Notes |
|---------|--------|-------|
| Address rotation (AVAILABLE→RESERVED→PROCESSING→AVAILABLE) | ✅ Discussed | Same logic, scoped per-merchant |
| Gas funding optimization (deficit-only) | ✅ Discussed | Same logic |
| Leftover gas reuse | ✅ Discussed | Same logic |
| Partial payment handling | ✅ Discussed | Hosted checkout only |
| Below-threshold → 100% to admin | ✅ Discussed | Same logic |
| Admin fee sweep to admin wallet | ✅ Discussed | Same logic |
| Late payment handling | ✅ Discussed | SIMPLER: always goes to merchant owner |
| Stuck address cleanup (2-hour safety) | ✅ Discussed | Same logic |
| xpub generation at signup | ✅ Discussed | Per-merchant xpub |
| Pool creation on wallet add | ✅ Discussed | 2 addresses per chain when configured |

---

### 🔍 NOT YET DISCUSSED Features (From Current Implementation)

#### 1. **Pool Transaction Audit Trail** (`tbl_usdt_pool_transaction`)
```typescript
// Currently tracks EVERY payment through pool addresses
{
  pool_address_id: number,    // Which pool address
  temp_id: number,            // Link to tbl_user_temp_address
  company_id: number,         // Which merchant company
  user_id: number,            // Which merchant
  customer_id: number,        // Which customer
  payment_reference: string,  // Unique payment ID
  wallet_type: string,        // BTC, ETH, etc.
  payment_amount: number,     // Total received
  merchant_amount: number,    // Sent to merchant
  admin_fee_amount: number,   // Retained for admin
  gas_funded: number,         // Gas we funded
  gas_used: number,           // Actual gas consumed
  incoming_tx_id: string,     // Blockchain TX (incoming)
  merchant_tx_id: string,     // Blockchain TX (to merchant)
  gas_funding_tx_id: string,  // Blockchain TX (gas funding)
  status: string,             // pending → gas_funded → merchant_sent → completed
}
```
**Decision needed**: Keep this audit trail for per-merchant pool?

---

#### 2. **Pool Sweep Records** (`tbl_usdt_pool_sweep`)
```typescript
// Records every sweep from pool address to admin wallet
{
  sweep_id: number,
  pool_address_id: number,
  wallet_type: string,
  amount_swept: number,       // USDT swept
  gas_funded: number,         // Gas funded for sweep
  gas_used: number,           // Actual gas used
  sweep_tx_id: string,        // Blockchain TX
  gas_funding_tx_id: string,  // Gas funding TX
  admin_wallet: string,       // Destination
  status: string,             // pending → completed → failed
  error_message: string,
}
```
**Decision needed**: Keep sweep records for per-merchant pool?

---

#### 3. **Admin Fee Tracking Model** (`tbl_admin_fee`)
```typescript
// Separate table tracking accumulated fees per merchant
// Used for reporting which merchant generated how much admin fee
```
**Decision needed**: How to attribute admin fees per merchant in per-merchant pool?

---

#### 4. **Payment During Sweep (Queue Mechanism)**
```typescript
// When payment arrives while address is SWEEPING:
// 1. Queue the payment (don't process immediately)
// 2. After sweep completes: processQueuedPayments()
// 3. Process all queued payments normally

export const handleLatePayment = async (walletAddress, amount, txId) => {
  const poolAddress = await findByAddress(walletAddress);
  
  if (poolAddress.status === "SWEEPING") {
    // QUEUE FOR LATER
    return {
      action: "QUEUED_DURING_SWEEP",
      details: { willProcessAfterSweep: true }
    };
  }
  // ...
};

export const processQueuedPayments = async (poolAddressId) => {
  // Called after sweep completes
  // Process any payments that arrived during sweep
};
```
**Decision**: Keep this mechanism for per-merchant pool? YES (same issue exists)

---

#### 5. **Auto-Match Late Payment (GLOBAL POOL ONLY - TO BE REMOVED)**
```typescript
// CURRENT: Global pool tries to auto-match late payments
// by looking at recent transactions with similar amounts

// This is DANGEROUS and why we're moving to per-merchant pool
// In per-merchant pool: address ALWAYS belongs to owner_user_id
// No auto-matching needed!
```
**Decision**: REMOVE auto-matching in per-merchant pool (not needed)

---

#### 6. **Pool Status Dashboard** (`getPoolStatus`)
```typescript
// Returns status for admin dashboard
{
  "BTC": {
    addresses: [...],
    totalAddresses: 10,
    availableCount: 7,
    reservedCount: 2,
    processingCount: 1,
    sweepingCount: 0,
    totalAccumulatedFees: 0.005,
    sweepThreshold: 0.001,
  },
  // ... per chain
}
```
**Decision needed**: Modify for per-merchant view + admin global view?

---

#### 7. **Subscription Management (Tatum Webhooks)**
```typescript
// Each temp address has a Tatum webhook subscription
{
  subscription_id: string,  // Tatum subscription ID
}

// Created when address is derived
// Webhook notifies us when payment arrives
```
**Decision**: Same for per-merchant pool (subscription per address)

---

#### 8. **Private Key Encryption (KMS)**
```typescript
// Private keys encrypted via Google Cloud KMS
{
  private_key: "encrypted...",  // Encrypted via TEMP_KEY_ID
  mnemonic: "encrypted...",     // Encrypted via KMS
}

// Decryption when signing transactions
const decryptedKey = await decryptWithKMS(
  poolAddress.private_key,
  process.env.TEMP_KEY_ID
);
```
**Decision**: Same for per-merchant pool (encrypt per-merchant keys too)

---

#### 9. **Gas Balance Tracking**
```typescript
// Track estimated gas balance per address
{
  gas_balance: number,  // Estimated TRX/ETH remaining
}

// Updated after each transaction
// Used to decide if gas funding needed
```
**Decision**: Keep for per-merchant pool (same logic)

---

#### 10. **Reservation Timeout Handling**
```typescript
// Multiple timeout levels:
RESERVATION_TIMEOUT_MINUTES: 30,   // No payment → release
PROCESSING_TIMEOUT_MINUTES: 60,    // Partial → extend timeout
STALE_LOCK_TIMEOUT_MINUTES: 120,   // Safety → force release

// Cron jobs:
// - releaseExpiredReservations() - release 30-min timeout
// - processExpiredPartialPayments() - handle expired partials
// - cleanupStaleAddresses() - force release 2-hour stuck
```
**Decision**: Keep all for per-merchant pool (same logic)

---

## Summary: Features to Preserve vs Modify vs Remove

| Feature | Action | Notes |
|---------|--------|-------|
| Transaction audit trail | ✅ PRESERVE | Add `owner_user_id` to track merchant |
| Sweep records | ✅ PRESERVE | Track per-merchant sweeps |
| Admin fee tracking | ✅ MODIFY | Clear attribution per merchant |
| Queue during sweep | ✅ PRESERVE | Same mechanism |
| Auto-match late payment | ❌ REMOVE | Not needed (address has permanent owner) |
| Pool status dashboard | ✅ MODIFY | Per-merchant + admin global view |
| Tatum subscriptions | ✅ PRESERVE | One per address |
| KMS encryption | ✅ PRESERVE | Encrypt per-merchant keys |
| Gas balance tracking | ✅ PRESERVE | Same logic |
| Timeout handling | ✅ PRESERVE | Same timeouts |
| Address selection priority | ✅ PRESERVE | admin_fee_balance DESC, total_transactions DESC |

---

## New Per-Merchant Tables Summary

### 1. `tbl_merchant_wallet` (xpub storage)
```sql
CREATE TABLE tbl_merchant_wallet (
  wallet_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tbl_user(user_id),
  wallet_type VARCHAR(20),      -- BTC, ETH, LTC, DOGE, TRX, BCH
  xpub_mnemonic TEXT,           -- Encrypted: {xpub, mnemonic}
  last_derivation_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, wallet_type)
);
-- Note: USDT-TRC20 uses TRX wallet, USDT-ERC20 uses ETH wallet
```

### 2. `tbl_merchant_temp_address` (pool addresses)
```sql
CREATE TABLE tbl_merchant_temp_address (
  temp_address_id SERIAL PRIMARY KEY,
  owner_user_id INTEGER REFERENCES tbl_user(user_id),  -- PERMANENT owner
  wallet_type VARCHAR(20),
  wallet_address VARCHAR(100) UNIQUE,
  private_key TEXT,             -- Encrypted
  derivation_index INTEGER,
  subscription_id VARCHAR(100), -- Tatum webhook
  status VARCHAR(20) DEFAULT 'AVAILABLE',
  admin_fee_balance DECIMAL(20,8) DEFAULT 0,
  gas_balance DECIMAL(20,8) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  
  -- Current reservation (temporary, cleared after payment)
  current_payment_id VARCHAR(100),
  current_company_id INTEGER,
  expected_amount DECIMAL(20,8),
  received_amount DECIMAL(20,8) DEFAULT 0,
  is_partial_payment BOOLEAN DEFAULT FALSE,
  partial_payment_timestamp TIMESTAMP,
  reserved_until TIMESTAMP,
  locked_at TIMESTAMP,
  
  last_used_at TIMESTAMP,
  last_swept_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_merchant_temp_lookup 
ON tbl_merchant_temp_address(owner_user_id, wallet_type, status);
```

### 3. `tbl_merchant_pool_transaction` (audit trail)
```sql
-- Same as current tbl_usdt_pool_transaction but for all chains
-- Add owner_user_id for clear merchant attribution
```

### 4. `tbl_merchant_pool_sweep` (sweep records)
```sql
-- Same as current tbl_usdt_pool_sweep but for all chains
-- Add owner_user_id for clear merchant attribution
```

---

## Confirmed Understanding ✅

1. ✅ **Address selection**: `admin_fee_balance DESC, total_transactions DESC` for ALL chains
2. ✅ **Pool creation trigger**: When merchant adds wallet for a chain → create 2 temp addresses
3. ✅ **xpub at signup**: Generate for all 8 chains, store encrypted
4. ✅ **USDT shares xpub**: USDT-TRC20 uses TRX xpub, USDT-ERC20 uses ETH xpub
5. ✅ **Preserve**: Audit trail, sweep records, queue mechanism, KMS, gas tracking, timeouts
6. ✅ **Remove**: Auto-match late payment (not needed with permanent ownership)
7. ✅ **Modify**: Dashboard for per-merchant view

**Ready to implement when you confirm!**
