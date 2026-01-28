# Environment Variable Contradiction Analysis

## Issue Identified ✅

### Problem: `MERCHANT_POOL_SWEEP_THRESHOLD=30` appears unused and contradictory

---

## Analysis

### Current .env Configuration

```bash
# Merchant Pool System Configuration
MERCHANT_POOL_INITIAL_SIZE=2
MERCHANT_POOL_SWEEP_THRESHOLD=30    # ⚠️ NOT USED IN CODE

# Per-Chain Sweep Configuration
TRX_SWEEP=time:10
ETH_SWEEP=time:10
USDT_TRC20_SWEEP=threshold:30
USDT_ERC20_SWEEP=threshold:50
USDC_ERC20_SWEEP=threshold:30
```

### Code Analysis Results

#### 1. **MERCHANT_POOL_SWEEP_THRESHOLD** - ❌ NOT USED
**Search Result:**
```bash
grep -r "MERCHANT_POOL_SWEEP_THRESHOLD" /app/backend/*.ts
# No matches found
```

**Conclusion:** This variable is defined in .env but **never referenced in the codebase**.

#### 2. **MERCHANT_POOL_INITIAL_SIZE** - ✅ USED CORRECTLY
**Usage:**
```typescript
// services/merchantPoolService.ts:33
INITIAL_SIZE: parseInt(process.env.MERCHANT_POOL_INITIAL_SIZE || "2")

// services/merchantPoolValidator.ts:105
const poolInitialSize = parseInt(process.env.MERCHANT_POOL_INITIAL_SIZE || "2");
```

**Purpose:** Controls how many addresses are pre-generated per chain when merchant pool is initialized.

#### 3. **Per-Chain Sweep Configs** - ✅ USED CORRECTLY
**Usage:**
```typescript
// services/merchantPoolService.ts:72-80
const envKey = `${walletType.replace(/-/g, "_")}_SWEEP`;
const configValue = process.env[envKey];

// Supported formats:
// - UTXO chains (BTC, LTC, DOGE, BCH): Auto batch mode
// - Native chains: threshold:30 or time:10
// - Tokens: threshold:30 (only threshold allowed)
```

**Purpose:** Each chain has its own sweep configuration independently.

#### 4. **USDT_POOL_SWEEP_THRESHOLD** - ✅ USED (Different System)
**Usage:**
```typescript
// services/usdtPoolService.ts:26
SWEEP_THRESHOLD: parseFloat(process.env.USDT_POOL_SWEEP_THRESHOLD || "30")
```

**Note:** This is for the **USDT pool system** (different from merchant pool).

---

## Contradiction Summary

| Variable | Status | Purpose | Contradiction |
|----------|--------|---------|---------------|
| `MERCHANT_POOL_SWEEP_THRESHOLD` | ❌ Unused | Unknown | **Should be removed** - Not used in code |
| `MERCHANT_POOL_INITIAL_SIZE` | ✅ Used | Pool size per chain | None |
| `TRX_SWEEP`, `ETH_SWEEP`, etc. | ✅ Used | Per-chain sweep rules | None - these are the actual sweep configs |
| `USDT_POOL_SWEEP_THRESHOLD` | ❌ Missing | USDT pool sweep | **Should be added** if USDT pool is used |

---

## Recommended Changes

### 1. Remove Unused Variable
```bash
# REMOVE THIS LINE - Not used in code
MERCHANT_POOL_SWEEP_THRESHOLD=30
```

### 2. Add Missing USDT Pool Variables (if USDT pool is used)
```bash
# USDT Pool System (separate from merchant pool)
USDT_POOL_INITIAL_SIZE=2
USDT_POOL_SWEEP_THRESHOLD=30
```

**Note:** The code references `USDT_POOL_SWEEP_THRESHOLD` but it's not in the .env file. Currently defaults to 30.

### 3. Keep Per-Chain Configurations (Correct as-is)
```bash
# Per-Chain Sweep Configuration - CORRECT ✅
# UTXO Chains (BTC, LTC, DOGE, BCH): Batch transfer (no config needed)
# Native Currencies (TRX, ETH): threshold OR time
TRX_SWEEP=time:10          # Sweep 10 minutes after merchant payout
ETH_SWEEP=time:10          # Sweep 10 minutes after merchant payout

# Tokens: threshold ONLY
USDT_TRC20_SWEEP=threshold:30   # Sweep when admin fee reaches $30
USDT_ERC20_SWEEP=threshold:50   # Sweep when admin fee reaches $50
USDT_ERC20_SWEEP=threshold:30   # Sweep when admin fee reaches $30
```

---

## Why The Confusion Exists

### Two Different Pool Systems:

1. **Merchant Pool System** (merchantPoolService.ts)
   - Manages per-merchant pools for ALL crypto payments
   - Uses per-chain sweep configs: `TRX_SWEEP`, `ETH_SWEEP`, etc.
   - Uses `MERCHANT_POOL_INITIAL_SIZE` for initial pool size
   - ❌ Does NOT use `MERCHANT_POOL_SWEEP_THRESHOLD`

2. **USDT Pool System** (usdtPoolService.ts)
   - Separate global USDT pool (legacy or alternative system)
   - Uses `USDT_POOL_INITIAL_SIZE` and `USDT_POOL_SWEEP_THRESHOLD`
   - May be deprecated or used for different purpose

---

## Health Endpoint Status ✅

### Available Endpoints (All Working):

1. **Root Health Check**
   ```bash
   GET http://localhost:3300/health
   GET http://localhost:8001/health
   
   Response:
   {
     "status": "healthy",
     "service": "DynoPay Backend",
     "database": "connected",
     "timestamp": "2026-01-28T21:45:12.459Z",
     "uptime": 183.517
   }
   ```

2. **Status API Health Check**
   ```bash
   GET http://localhost:3300/api/status/health
   GET http://localhost:8001/api/status/health
   
   Response:
   {
     "status": "healthy",
     "timestamp": "2026-01-28T21:45:13.473Z",
     "version": "1.0.0"
   }
   ```

### Earlier Error Explanation

The "Cannot GET /api/health" error occurred because:
- The endpoint is `/health` (root) or `/api/status/health` (nested)
- There is **no** `/api/health` endpoint
- The service was still starting up during initial check
- Health endpoints are now fully functional

---

## Final Recommendations

### Action Items:

1. ✅ **Remove** `MERCHANT_POOL_SWEEP_THRESHOLD=30` from .env (unused)
2. ⚠️ **Add** `USDT_POOL_INITIAL_SIZE=2` and `USDT_POOL_SWEEP_THRESHOLD=30` if USDT pool system is active
3. ✅ **Keep** all per-chain sweep configurations as-is (they're correct)
4. ✅ **Use** `/health` or `/api/status/health` for health checks (both work)

### Updated .env Structure (Recommended):

```bash
# ============================================
# Merchant Pool System Configuration
# ============================================
MERCHANT_POOL_INITIAL_SIZE=2

# Per-Chain Sweep Configuration
# UTXO Chains (BTC, LTC, DOGE, BCH): Batch transfer (no config needed)
# Native Currencies (TRX, ETH): threshold OR time
TRX_SWEEP=time:10
ETH_SWEEP=time:10

# Tokens: threshold ONLY
USDT_TRC20_SWEEP=threshold:30
USDT_ERC20_SWEEP=threshold:50
USDC_ERC20_SWEEP=threshold:30

# ============================================
# USDT Pool System (If Used - Legacy/Alternative)
# ============================================
# USDT_POOL_INITIAL_SIZE=2
# USDT_POOL_SWEEP_THRESHOLD=30
```

---

## Conclusion

The contradiction exists because:
1. `MERCHANT_POOL_SWEEP_THRESHOLD` was likely added from user's provided config but is not used in code
2. The actual sweep thresholds are per-chain (`TRX_SWEEP`, `ETH_SWEEP`, etc.)
3. There's a separate USDT pool system that may use `USDT_POOL_SWEEP_THRESHOLD`
4. Health endpoint works - just use correct path: `/health` or `/api/status/health`

**Status:** Analysis complete ✅ Ready for cleanup.
