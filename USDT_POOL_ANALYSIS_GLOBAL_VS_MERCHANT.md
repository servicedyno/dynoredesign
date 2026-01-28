# USDT Pool System Analysis: Global vs Individual Merchant Pool

## Executive Summary

The current implementation uses a **Global Pool System** where USDT addresses are shared across all merchants. This creates several dangerous scenarios that could result in:
- Funds being sent to wrong merchants
- Complex error handling for late payments
- Operational overhead for orphan payment resolution
- Potential security vulnerabilities

**Recommendation**: Migrate to an **Individual Merchant Pool System** where each merchant has their own dedicated pool of USDT addresses.

---

## Current Global Pool System

### Architecture
```
┌──────────────────────────────────────────────────────┐
│                 GLOBAL USDT POOL                      │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│  │ Addr #1 │ │ Addr #2 │ │ Addr #3 │ │ Addr #N │     │
│  │AVAILABLE│ │RESERVED │ │PROCESS  │ │SWEEPING │     │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
│                     ↑                                 │
│        Shared by ALL merchants                        │
└──────────────────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
   Merchant A   Merchant B   Merchant C
```

### Current Flow
1. Customer initiates USDT payment
2. System reserves AVAILABLE address from global pool
3. Address tracks `current_company_id`, `current_payment_id`
4. Customer sends USDT to address
5. Merchant portion transferred, admin fee accumulates
6. Address released back to AVAILABLE (for ANY merchant)

### Identified Dangerous Scenarios

#### 1. Cross-Merchant Fund Mixing (CRITICAL)
```
Timeline:
T0: Addr#1 reserved for Merchant A (payment $100)
T1: Customer A is slow, doesn't pay
T30min: Reservation expires, Addr#1 released to AVAILABLE
T31min: Addr#1 reserved for Merchant B (payment $98)
T32min: Customer A finally sends $100 to Addr#1
T33min: Customer B sends $98 to Addr#1

Result: Two payments in quick succession - which belongs to whom?
System relies on auto-matching with 5% tolerance - risky!
```

#### 2. Late Payment Attribution Errors
- Auto-matching uses 5% amount tolerance
- Two merchants could have similar payment amounts ($100 vs $99)
- System could attribute late payment to wrong merchant
- Financial loss and customer disputes

#### 3. Orphan Payments
- When auto-match fails, funds sit in limbo
- Requires manual intervention to resolve
- Operational burden on support team
- Customer experience degradation

#### 4. Timing Attack Vulnerability
```
Attack Vector:
1. Attacker monitors blockchain for newly reserved addresses
2. Sends small dust payment ($0.01) to reserved address
3. Creates confusion in payment matching
4. Legitimate payment arrives
5. System has to decide: which is the real payment?
```

#### 5. Admin Fee Attribution Problem
- Admin fees from multiple merchants mix in same address
- Cannot determine which merchant generated which fee
- Complicates accounting and reporting
- Sweep threshold based on total, not per-merchant

#### 6. Address Reassignment Race Condition
```
Race Condition:
1. Address reserved for Merchant A
2. Reservation expires (30 min)
3. Cron releases address (status: AVAILABLE)
4. Almost simultaneously:
   - Customer A sends payment
   - Merchant B's customer reserves same address
5. Payment lands in ambiguous state
```

---

## Proposed: Individual Merchant Pool System

### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │  MERCHANT A POOL │  │  MERCHANT B POOL │  ...           │
│  │ ┌─────┐ ┌─────┐  │  │ ┌─────┐ ┌─────┐  │               │
│  │ │Addr1│ │Addr2│  │  │ │Addr1│ │Addr2│  │               │
│  │ └─────┘ └─────┘  │  │ └─────┘ └─────┘  │               │
│  │  company_id=1    │  │  company_id=2    │               │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  Addresses NEVER shared between merchants                   │
│  Each pool isolated and independently managed               │
└─────────────────────────────────────────────────────────────┘
```

### Key Differences

| Aspect | Global Pool | Merchant Pool |
|--------|-------------|---------------|
| Address Ownership | Temporary (during payment) | Permanent (per company) |
| Cross-Merchant Risk | HIGH | NONE |
| Late Payment Handling | Complex auto-matching | Simple - always goes to owner |
| Orphan Payments | Possible | Not possible |
| Fee Attribution | Mixed, unclear | Clear per-merchant |
| Scalability | Better (fewer addresses) | More addresses needed |
| Security | Lower (shared) | Higher (isolated) |
| Auditability | Difficult | Easy |

### Benefits

1. **Complete Isolation** ✅
   - Each merchant's funds stay separate
   - No risk of cross-merchant mixing
   - Clear ownership at all times

2. **Safe Late Payments** ✅
   - Late payment ALWAYS goes to correct merchant
   - No auto-matching complexity
   - Address owner is permanent

3. **Clear Fee Attribution** ✅
   - Know exactly which merchant generated which fees
   - Per-merchant fee reports
   - Better financial reconciliation

4. **Simplified Error Handling** ✅
   - No orphan payment scenarios
   - No auto-matching failures
   - Reduced edge cases

5. **Better Security** ✅
   - No timing attacks between merchants
   - Isolated failure domains
   - Each merchant's pool independent

6. **Improved Auditability** ✅
   - Clear transaction history per merchant
   - Easy compliance reporting
   - Better dispute resolution

---

## Migration Plan

### Phase 1: Database Schema Changes

```sql
-- 1. Add permanent company ownership to pool addresses
ALTER TABLE tbl_usdt_pool_address 
ADD COLUMN owner_company_id INTEGER REFERENCES tbl_company(company_id);

-- 2. Add owner user (merchant who owns this pool)
ALTER TABLE tbl_usdt_pool_address 
ADD COLUMN owner_user_id INTEGER REFERENCES tbl_user(user_id);

-- 3. Create merchant pool configuration table
CREATE TABLE tbl_merchant_pool_config (
  config_id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES tbl_company(company_id) UNIQUE,
  usdt_trc20_enabled BOOLEAN DEFAULT false,
  usdt_erc20_enabled BOOLEAN DEFAULT false,
  min_pool_size INTEGER DEFAULT 2,
  auto_expand BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create index for fast lookups
CREATE INDEX idx_pool_address_owner ON tbl_usdt_pool_address(owner_company_id, wallet_type, status);
```

### Phase 2: Service Layer Changes

#### Modified `reserveAddress` function:
```typescript
export const reserveAddress = async (
  walletType: "USDT-TRC20" | "USDT-ERC20",
  paymentId: string,
  companyId: number,  // Now used for permanent filtering
  userId: number,
  expectedAmount: number
): Promise<any> => {
  // CHANGED: Only look at addresses owned by this merchant
  const poolAddress = await usdtPoolAddressModel.findOne({
    where: {
      wallet_type: walletType,
      status: "AVAILABLE",
      owner_company_id: companyId,  // NEW: Filter by owner
    },
    order: [
      ["admin_fee_balance", "DESC"],
      ["total_transactions", "DESC"],
    ],
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  if (!poolAddress) {
    // Create new address FOR THIS MERCHANT's pool
    const newAddress = await addAddressToMerchantPool(walletType, companyId, userId);
    // ... reserve the new address
  }
  // ... rest of logic
};
```

#### New function: `addAddressToMerchantPool`
```typescript
export const addAddressToMerchantPool = async (
  walletType: "USDT-TRC20" | "USDT-ERC20",
  companyId: number,
  userId: number
): Promise<any> => {
  // Create address with permanent ownership
  const poolAddress = await usdtPoolAddressModel.create({
    wallet_type: walletType,
    wallet_address: address,
    private_key: encryptedPrivateKey,
    derivation_index: nextIndex,
    subscription_id: subscriptionId,
    status: "AVAILABLE",
    owner_company_id: companyId,   // PERMANENT
    owner_user_id: userId,          // PERMANENT
    admin_fee_balance: 0,
    gas_balance: 0,
  });
  return poolAddress;
};
```

#### Simplified `handleLatePayment`:
```typescript
export const handleLatePayment = async (
  walletAddress: string,
  amount: number,
  txId: string
): Promise<{ handled: boolean; action: string; details: any }> => {
  const poolAddress = await usdtPoolAddressModel.findOne({
    where: { wallet_address: walletAddress },
  });

  // SIMPLIFIED: Address always belongs to owner_company_id
  // No auto-matching needed!
  const ownerCompanyId = poolAddress.dataValues.owner_company_id;
  const ownerUserId = poolAddress.dataValues.owner_user_id;

  // Process payment for the permanent owner
  return {
    handled: true,
    action: "PROCESS_FOR_OWNER",
    details: {
      walletAddress,
      amount,
      txId,
      companyId: ownerCompanyId,
      userId: ownerUserId,
    },
  };
};
```

### Phase 3: Migration Script

```typescript
// migrate_global_to_merchant_pools.ts

async function migrateToMerchantPools() {
  // 1. Get all companies that have used USDT payments
  const companiesWithUsdt = await sequelize.query(`
    SELECT DISTINCT company_id, user_id 
    FROM tbl_usdt_pool_transaction 
    WHERE company_id IS NOT NULL
  `);

  // 2. For each company, assign existing addresses or create new ones
  for (const company of companiesWithUsdt) {
    // Option A: Assign some existing addresses to this merchant
    // Option B: Create fresh addresses for each merchant (cleaner)
    
    await createMerchantPool(company.company_id, company.user_id);
  }

  // 3. Handle existing global addresses
  // - Addresses with admin_fee_balance > 0: Sweep to admin wallet first
  // - Addresses with 0 balance: Can be reassigned or disabled
}
```

### Phase 4: New Merchant Onboarding

```typescript
// When merchant enables USDT payments
async function enableUsdtForMerchant(companyId: number, userId: number) {
  // Create pool config
  await merchantPoolConfigModel.create({
    company_id: companyId,
    usdt_trc20_enabled: true,
    usdt_erc20_enabled: true,
    min_pool_size: 2,
    auto_expand: true,
  });

  // Create initial pool addresses
  for (let i = 0; i < 2; i++) {
    await addAddressToMerchantPool("USDT-TRC20", companyId, userId);
    await addAddressToMerchantPool("USDT-ERC20", companyId, userId);
  }
}
```

---

## Cost Analysis

### Tatum Subscriptions
- **Global Pool**: ~6 subscriptions (3 per type × 2 types)
- **Merchant Pool**: 4 subscriptions per merchant × number of merchants

For 100 merchants:
- Global: 6 subscriptions
- Merchant: 400 subscriptions

**Mitigation**: 
- Tatum subscription cost is minimal
- Security benefits far outweigh costs
- Can implement lazy pool creation (only when first USDT payment)

### Address Generation
- Each merchant needs ~4 addresses (2 TRC20 + 2 ERC20)
- One-time generation cost via Tatum API
- No ongoing cost after creation

---

## Rollback Plan

If issues arise, rollback is straightforward:
1. Keep `owner_company_id` nullable initially
2. If rollback needed, set all `owner_company_id = NULL`
3. Service falls back to global pool behavior
4. Feature flag to control which mode is active

```typescript
const USE_MERCHANT_POOLS = process.env.USE_MERCHANT_POOLS === 'true';

if (USE_MERCHANT_POOLS) {
  // New behavior: filter by owner_company_id
} else {
  // Old behavior: global pool
}
```

---

## Implementation Timeline

| Phase | Duration | Description |
|-------|----------|-------------|
| 1 | 2 days | Database schema changes |
| 2 | 3 days | Service layer modifications |
| 3 | 2 days | Migration script & testing |
| 4 | 1 day | New merchant onboarding flow |
| 5 | 2 days | Testing & bug fixes |
| **Total** | **~2 weeks** | Complete migration |

---

## Recommendation

**Strongly recommend migrating to Individual Merchant Pool System** because:

1. **Security**: Eliminates cross-merchant fund mixing risk
2. **Reliability**: Removes complex auto-matching logic
3. **Maintainability**: Simpler error handling
4. **Auditability**: Clear ownership chain
5. **Scalability**: Isolated failure domains

The additional cost (more Tatum subscriptions) is minimal compared to the risk mitigation and operational benefits gained.

---

## Next Steps

1. **Review** this analysis with stakeholders
2. **Decide** on migration approach (gradual vs big-bang)
3. **Implement** Phase 1 (database changes)
4. **Test** thoroughly in staging environment
5. **Monitor** closely after production deployment
