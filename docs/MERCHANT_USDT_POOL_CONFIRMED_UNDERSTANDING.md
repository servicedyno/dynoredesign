# Confirmed Understanding: Per-Merchant USDT Pool System

## 1. xpub Generation at Merchant Signup

**Trigger:** When merchant registers on DynoPay

**What happens:**
```
MERCHANT SIGNUP
      │
      ▼
┌─────────────────────────────────────────────────────┐
│  Generate & Store (via Tatum API):                  │
│                                                     │
│  1. USDT-TRC20 xpub/mnemonic (TRX blockchain)      │
│     - tatumSdk.blockchain.tron.generateTronwallet() │
│     - Encrypted & stored linked to user_id          │
│                                                     │
│  2. USDT-ERC20 xpub/mnemonic (ETH blockchain)      │
│     - tatumSdk.blockchain.eth.ethGenerateWallet()   │
│     - Encrypted & stored linked to user_id          │
└─────────────────────────────────────────────────────┘
```

**This is DIFFERENT from current system where:**
- Currently: Single admin xpub shared by all
- Proposed: Each merchant has their own xpub pair

---

## 2. Address Rotation Logic

### States:
```
AVAILABLE ──► RESERVED ──► PROCESSING ──► AVAILABLE (released)
     │            │             │
     │            │             └──► If sweep needed: SWEEPING ──► AVAILABLE
     │            │
     │            └──► Timeout (30min): Back to AVAILABLE
     │
     └──► All in use: Derive NEW address from merchant's xpub
```

### Detailed Flow:

**A. Payment Request Comes In:**
```typescript
1. Get merchant's user_id from company
2. Look for AVAILABLE address in merchant's pool:
   SELECT FROM tbl_usdt_pool_address 
   WHERE owner_user_id = :merchantId 
   AND wallet_type = :type 
   AND status = 'AVAILABLE'
   ORDER BY admin_fee_balance DESC, total_transactions DESC
   
3. If found:
   - Mark as RESERVED
   - Set reserved_until = NOW() + 30 minutes
   - Store: current_payment_id, current_company_id, expected_amount
   
4. If NOT found (all addresses in use):
   - Get merchant's xpub for this type
   - Derive next index address: xpub + (last_index + 1)
   - Create Tatum subscription for webhook
   - Mark new address as RESERVED immediately
```

**B. Payment Received (Within Timeout):**
```typescript
1. Status: RESERVED → PROCESSING
2. Extend timeout: reserved_until = NOW() + 60 minutes
3. Process payment:
   - Fund gas if needed
   - Transfer merchant portion
   - Accumulate admin fee
4. Release address back to AVAILABLE
```

**C. Reservation Timeout (No Payment):**
```typescript
1. Cron job checks: reserved_until < NOW() AND status = 'RESERVED'
2. Release: status → AVAILABLE
3. Clear: current_payment_id, expected_amount, etc.
4. Address ready for reuse by SAME merchant
```

---

## 3. Gas Funding Mechanism

### Current Implementation (Preserved):

```typescript
// Config from .env
TRC20_GAS_AMOUNT = 60       // TRX needed for USDT-TRC20 transfer
TRC20_GAS_MIN_DEFICIT = 10  // Only fund if deficit > 10 TRX
ERC20_GAS_AMOUNT = 0.004    // ETH needed for USDT-ERC20 transfer  
ERC20_GAS_MIN_DEFICIT = 0.001 // Only fund if deficit > 0.001 ETH

// Fee Wallets (central admin-controlled)
TRX_FEE_WALLET = process.env.TRX_FEE_WALLET
ETH_FEE_WALLET = process.env.ETH_FEE_WALLET
```

### Flow:
```
┌────────────────────────────────────────────────────────────────┐
│ BEFORE MERCHANT TRANSFER:                                       │
│                                                                 │
│ 1. Check current gas balance on pool address (on-chain)        │
│    currentBalance = tatumApi.getAddressBalance(address, TRX/ETH)│
│                                                                 │
│ 2. Calculate deficit:                                           │
│    deficit = requiredGas - currentBalance                       │
│                                                                 │
│ 3. Decision:                                                    │
│    IF deficit <= minDeficit:                                    │
│       → No funding needed, use leftover gas from prev tx        │
│    ELSE:                                                        │
│       → Transfer ONLY the deficit from fee wallet               │
│       → NOT full amount, saves gas costs                        │
│                                                                 │
│ 4. Track gas_balance in database for estimation                 │
└────────────────────────────────────────────────────────────────┘
```

### Leftover Optimization:
```
Transaction 1: Fund 60 TRX, use 45 TRX → Leftover 15 TRX
Transaction 2: Need 60 TRX, have 15 TRX → Deficit 45 TRX
              Only fund 45 TRX (not full 60)
Transaction 3: Need 60 TRX, have 12 TRX → Deficit 48 TRX, but minDeficit=10
              Fund 48 TRX
Transaction 4: Need 60 TRX, have 55 TRX → Deficit 5 TRX < minDeficit
              NO FUNDING needed, use existing 55 TRX
```

---

## 4. Admin Fee Sweep Logic

### When to Sweep:
```typescript
// Check if accumulated admin fees >= threshold
if (admin_fee_balance >= SWEEP_THRESHOLD) {  // Default $30
  → Address eligible for sweeping
}
```

### Sweep Process:
```
1. Mark address: AVAILABLE → SWEEPING
2. Fund gas if needed (for USDT transfer)
3. Get actual USDT balance on-chain (may differ from tracked)
4. Transfer ALL USDT to admin wallet:
   - USDT-TRC20 → USDT_TRC20_ADMIN_WALLET
   - USDT-ERC20 → USDT_ERC20_ADMIN_WALLET
5. Reset admin_fee_balance = 0
6. Mark address: SWEEPING → AVAILABLE
7. Process any queued payments (arrived during sweep)
```

### Edge Case - Payment During Sweep:
```
Problem: Payment arrives while address is being swept
Solution: Queue the payment, process after sweep completes

1. Payment arrives to address with status = SWEEPING
2. Create entry in tbl_usdt_pool_transaction with status = 'queued_during_sweep'
3. After sweep completes: processQueuedPayments(poolAddressId)
4. Queued payments get processed normally
```

---

## 5. Edge Cases & Handling

### A. Late Payment (Payment After Timeout)
```
CURRENT (Global Pool) - DANGEROUS:
- Address released, assigned to different merchant
- Late payment needs auto-matching (risky)

PROPOSED (Per-Merchant Pool) - SAFE:
- Address released back to SAME merchant's pool
- Late payment ALWAYS belongs to that merchant
- No cross-merchant confusion possible
```

### B. Partial Payment
```
Flow:
1. Customer sends less than expected_amount
2. Mark: is_partial_payment = true
3. Extend grace period: reserved_until = NOW() + 30 min
4. Wait for more payment OR timeout

After Grace Period Expires:
IF received_amount >= threshold:
  → Process as complete (merchant gets what was received)
IF received_amount < threshold:
  → 100% to admin fee (too small to forward)
```

### C. Overpayment
```
Customer sends MORE than expected:
- All funds go to merchant (minus admin fee %)
- Merchant responsible for refunding excess
- We don't auto-refund to avoid wrong address issues
```

### D. Stuck Addresses (Safety Net)
```
Cron job: cleanupStaleAddresses()
- Any address stuck in RESERVED/PROCESSING for > 2 hours
- Force release back to AVAILABLE
- Log for investigation
```

### E. All Addresses In Use
```
CURRENT (Global Pool):
- Create new address from admin xpub
- Shared by all merchants (dangerous)

PROPOSED (Per-Merchant Pool):
- Create new address from MERCHANT's xpub
- Belongs only to that merchant (safe)
- Merchant's pool grows independently
```

### F. Merchant Has Multiple Companies
```
Merchant (user_id=1)
├── Company A (company_id=10)
├── Company B (company_id=20)
└── Company C (company_id=30)

All companies share merchant's xpub pool:
- Address can be used for Company A payment
- Same address later reused for Company B payment
- All within SAME merchant = NO RISK
- Different merchant = IMPOSSIBLE (different xpub)
```

### G. Address Pool Exhaustion
```
If merchant has high volume and all addresses in use:
1. Auto-derive new address from merchant's xpub
2. No limit on pool growth (derivation index++)
3. Pool naturally shrinks as addresses become available
4. Sweep process consolidates admin fees
```

---

## 6. Database Schema Changes Summary

### New Table: tbl_merchant_usdt_wallet
```sql
CREATE TABLE tbl_merchant_usdt_wallet (
  wallet_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES tbl_user(user_id),
  wallet_type VARCHAR(20),  -- 'USDT-TRC20' or 'USDT-ERC20'
  xpub_mnemonic TEXT,       -- Encrypted JSON: {xpub, mnemonic}
  last_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, wallet_type)
);
```

### Modified: tbl_usdt_pool_address
```sql
ALTER TABLE tbl_usdt_pool_address 
ADD COLUMN owner_user_id INTEGER REFERENCES tbl_user(user_id);

-- Index for fast lookup
CREATE INDEX idx_pool_owner ON tbl_usdt_pool_address(owner_user_id, wallet_type, status);
```

---

## 7. Key Benefits of Per-Merchant System

| Scenario | Global Pool | Per-Merchant Pool |
|----------|-------------|-------------------|
| Late payment | Risk of wrong merchant | Always correct merchant |
| Cross-merchant mixing | Possible | Impossible |
| Auto-matching needed | Yes (risky) | No |
| Fee attribution | Unclear | Clear per merchant |
| Pool isolation | None | Complete |
| Orphan payments | Possible | Not possible |
| Security | Lower | Higher |

---

## Confirmation ✅

I understand:
1. ✅ xpub for USDT-TRC20 and USDT-ERC20 generated at **merchant signup**
2. ✅ Addresses derived from merchant's xpub on demand
3. ✅ Rotation: AVAILABLE → RESERVED → PROCESSING → AVAILABLE
4. ✅ If all addresses in use → derive new from same merchant's xpub
5. ✅ Gas funding uses leftover optimization (only fund deficit)
6. ✅ Admin fees accumulate per address, sweep when threshold reached
7. ✅ All edge cases preserved: late payment, partial payment, stuck addresses, queued during sweep
8. ✅ Multiple companies under same merchant share the pool (safe)
9. ✅ Different merchants have completely isolated pools (different xpubs)

**Ready to implement when you confirm!**
