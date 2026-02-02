# USDT Pool vs Merchant Pool - Complete Analysis

## Your Question ✅
> "We have USDT_TRC20_SWEEP=threshold:30, USDT_ERC20_SWEEP=threshold:50, USDC_ERC20_SWEEP=threshold:30
> What is the role of another USDT_POOL_INITIAL_SIZE=2?"

## The Answer: TWO SEPARATE SYSTEMS

You have **TWO different pool systems** running in parallel:

1. **USDT Pool System** (Global, Legacy, ACTIVE)
2. **Merchant Pool System** (Per-merchant, Modern, PRIMARY)

---

## Database Evidence

### Current State:
```
=== USDT Pool (Global System) ===
USDT-TRC20: 3 addresses (AVAILABLE)
USDT-ERC20: 3 addresses (AVAILABLE)
Transactions: 0

=== Merchant Pool (Per-Merchant System) ===
USDT-TRC20: 0 addresses
USDT-ERC20: 0 addresses
Transactions: 0
```

**Key Finding:** USDT payments are currently using the **USDT Pool** (global), NOT the Merchant Pool!

---

## System 1: USDT Pool (Global)

### Purpose
A **global shared pool** of USDT addresses used across ALL merchants.

### Configuration
```bash
USDT_POOL_INITIAL_SIZE=2          # How many addresses to pre-generate
USDT_POOL_SWEEP_THRESHOLD=30      # Sweep when admin fee reaches $30
```

### Code Location
- **Service:** `services/usdtPoolService.ts`
- **Tables:** `tbl_usdt_pool_address`, `tbl_usdt_pool_transaction`, `tbl_usdt_pool_sweep`

### How It Works
1. Pre-generates global USDT addresses (2-3 addresses)
2. **Shared across ALL merchants** (not isolated per merchant)
3. Uses single threshold: $30 USD
4. Sweeps to admin wallets when threshold reached

### Cron Jobs (Active)
```javascript
// Sweep every 30 minutes
cron.schedule("*/30 * * * *", usdtPoolService.sweepAllEligibleAddresses);

// Release expired reservations every 5 minutes
cron.schedule("*/5 * * * *", usdtPoolService.releaseExpiredReservations);

// Process partial payments every 5 minutes
cron.schedule("*/5 * * * *", usdtPoolService.processExpiredPartialPayments);

// Cleanup stale addresses every 15 minutes
cron.schedule("*/15 * * * *", usdtPoolService.cleanupStaleAddresses);
```

### Status: ✅ **ACTIVE AND USED**
```
[Backend] USDT Pool tables synced successfully.
[Backend] [USDTPool] USDT-TRC20 pool already has 3 addresses
[Backend] [USDTPool] USDT-ERC20 pool already has 3 addresses
```

---

## System 2: Merchant Pool (Per-Merchant)

### Purpose
**Per-merchant isolated pools** for ALL crypto payments including USDT.

### Configuration
```bash
MERCHANT_POOL_INITIAL_SIZE=2

# Per-chain sweep configurations
USDT_TRC20_SWEEP=threshold:30      # Sweep USDT-TRC20 at $30
USDT_ERC20_SWEEP=threshold:50      # Sweep USDT-ERC20 at $50  ⚠️ Different!
USDC_ERC20_SWEEP=threshold:30      # Sweep USDC-ERC20 at $30
```

### Code Location
- **Service:** `services/merchantPoolService.ts`
- **Tables:** `tbl_merchant_wallet`, `tbl_merchant_temp_address`, `tbl_merchant_pool_transaction`

### How It Works
1. Each merchant gets their own xpub/mnemonic per chain
2. **Isolated pools** - Merchant A's addresses ≠ Merchant B's addresses
3. Different sweep thresholds per chain
4. More granular control

### Status: ⚠️ **NOT BEING USED FOR USDT**
```
Merchant Pool USDT Addresses: 0
Merchant Pool USDT Transactions: 0
```

---

## The Contradiction Explained

### Why Both Exist?

**Historical Reason:**
1. **USDT Pool** was built first (legacy system)
2. **Merchant Pool** was built later to support ALL chains with per-merchant isolation
3. USDT Pool was **never migrated** to Merchant Pool

### Current Situation:
```bash
# USDT Pool (ACTUALLY BEING USED)
USDT_POOL_INITIAL_SIZE=2
USDT_POOL_SWEEP_THRESHOLD=30       # Single threshold for both chains

# Merchant Pool (NOT BEING USED FOR USDT - YET)
USDT_TRC20_SWEEP=threshold:30
USDT_ERC20_SWEEP=threshold:50      # Would allow different thresholds
```

### The Problem:
You have configurations for USDT in **both systems**, but only USDT Pool is active!

---

## Comparison Table

| Feature | USDT Pool | Merchant Pool |
|---------|-----------|---------------|
| **Scope** | Global (shared) | Per-merchant (isolated) |
| **Chains** | USDT-TRC20, USDT-ERC20 only | ALL chains (BTC, ETH, USDT, etc.) |
| **Threshold Config** | Single: $30 for both | Per-chain: $30/$50 different |
| **Merchant Isolation** | ❌ No | ✅ Yes |
| **Currently Active** | ✅ Yes (3+3 addresses) | ❌ No USDT addresses |
| **Cron Jobs** | ✅ Running (4 jobs) | ✅ Running (sweep job) |
| **Database Usage** | ✅ Has data | ❌ No USDT data |

---

## Which System Is Being Used?

### Based on Database Evidence:
```
✅ USDT Pool: 6 addresses (3 TRC20 + 3 ERC20) - ACTIVE
❌ Merchant Pool: 0 USDT addresses - NOT USED
```

### Confirmed by Logs:
```
[Backend] [USDTPool] USDT-TRC20 pool already has 3 addresses
[Backend] [USDTPool] USDT-ERC20 pool already has 3 addresses
[Backend] [MerchantPool] Configuration validation passed
```

**Verdict:** USDT payments use **USDT Pool** (global), not Merchant Pool.

---

## Why This Matters

### Security/Privacy Issue:
If USDT Pool is global (shared across merchants):
- **Privacy Risk:** All merchants share the same address pool
- **Isolation Problem:** Merchant A and Merchant B could receive payments to same addresses

### Threshold Confusion:
```bash
# This is used (USDT Pool):
USDT_POOL_SWEEP_THRESHOLD=30       # Both chains sweep at $30

# These are NOT used (Merchant Pool):
USDT_TRC20_SWEEP=threshold:30      # Would sweep TRC20 at $30
USDT_ERC20_SWEEP=threshold:50      # Would sweep ERC20 at $50
```

The merchant pool configs are defined but **ignored** because USDT uses the global pool!

---

## Recommended Solutions

### Option 1: Migrate to Merchant Pool (Recommended)
**Pros:**
- ✅ Per-merchant isolation (better security/privacy)
- ✅ Different thresholds per chain (more flexibility)
- ✅ Consistent with other chains (BTC, ETH, etc.)
- ✅ Remove duplicate USDT Pool system

**Cons:**
- ⚠️ Requires migration (addresses need to be regenerated per merchant)
- ⚠️ Breaking change (existing addresses in USDT Pool won't work)

**Implementation:**
1. Disable USDT Pool in server.ts (comment out initialization)
2. Remove USDT Pool cron jobs
3. Ensure Merchant Pool handles USDT-TRC20 and USDT-ERC20
4. Update payment controller to use merchantPoolService for USDT

### Option 2: Keep USDT Pool (Current State)
**Pros:**
- ✅ No changes needed
- ✅ Already working

**Cons:**
- ❌ USDT addresses shared globally (not per-merchant)
- ❌ Can't have different thresholds for TRC20 vs ERC20
- ❌ Inconsistent with other chains
- ❌ Confusing configuration (two systems)

**If keeping:** Remove unused Merchant Pool USDT configs:
```bash
# Remove these (not used):
USDT_TRC20_SWEEP=threshold:30
USDT_ERC20_SWEEP=threshold:50
```

### Option 3: Hybrid Approach
Keep both, but clarify which is used:
```bash
# ==== ACTIVE: USDT Pool (Global System) ====
USDT_POOL_INITIAL_SIZE=2
USDT_POOL_SWEEP_THRESHOLD=30

# ==== INACTIVE: These are not used (Merchant Pool disabled for USDT) ====
# USDT_TRC20_SWEEP=threshold:30
# USDT_ERC20_SWEEP=threshold:50
```

---

## Cleanup Recommendations

### Immediate Action (No Code Change):
Update .env comments to clarify which system is used:

```bash
# ============================================
# USDT Pool System (ACTIVE - Global Pool)
# ============================================
# This is the ACTIVE system for USDT payments
# Addresses are SHARED globally across all merchants
USDT_POOL_INITIAL_SIZE=2
USDT_POOL_SWEEP_THRESHOLD=30

# ============================================
# Merchant Pool System Configuration
# ============================================
MERCHANT_POOL_INITIAL_SIZE=2

# Per-Chain Sweep Configuration
# NOTE: USDT chains below are NOT USED - USDT uses global pool above
TRX_SWEEP=time:10
ETH_SWEEP=time:10

# These are defined but NOT USED (USDT uses global pool):
USDT_TRC20_SWEEP=threshold:30      # Not active
USDT_ERC20_SWEEP=threshold:50      # Not active
USDC_ERC20_SWEEP=threshold:30      # Active (USDC uses merchant pool)
```

### Future Migration (Requires Code Changes):
To use Merchant Pool for USDT:
1. Add USDT to `MERCHANT_POOL_CRYPTO_TYPES` in models
2. Ensure merchantPoolService handles USDT-TRC20/USDT-ERC20
3. Update payment controller to route USDT to merchantPoolService
4. Disable USDT Pool initialization and cron jobs
5. Migrate existing USDT Pool addresses (or deprecate)

---

## Summary

**The Core Issue:**
- You have TWO pool systems
- USDT uses the **old global pool** (USDT_POOL_*)
- Other tokens use the **new merchant pool** (USDT_TRC20_SWEEP, etc.)
- This creates confusion and inconsistency

**Quick Fix:**
Comment out unused variables and add clarifying notes:

```bash
# USDT Pool (ACTIVE - Currently Used)
USDT_POOL_INITIAL_SIZE=2
USDT_POOL_SWEEP_THRESHOLD=30

# Merchant Pool (INACTIVE for USDT - Config exists but not used)
# USDT_TRC20_SWEEP=threshold:30      # Not active
# USDT_ERC20_SWEEP=threshold:50      # Not active

# Merchant Pool (ACTIVE for USDC)
USDC_ERC20_SWEEP=threshold:30        # Active
```

**Long-term Solution:**
Migrate USDT to Merchant Pool for consistency and per-merchant isolation.

---

**Status:** Analysis complete. Recommend clarifying .env comments or migrating USDT to Merchant Pool.
