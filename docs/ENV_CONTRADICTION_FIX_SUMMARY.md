# Environment Variables - Contradiction Fix Summary

## Issues Found & Fixed ✅

### 1. Unused Variable Removed
**Problem:** `MERCHANT_POOL_SWEEP_THRESHOLD=30` was defined but never used in code.

**Fix:** ✅ Removed from .env

```diff
# Merchant Pool System Configuration
MERCHANT_POOL_INITIAL_SIZE=2
- MERCHANT_POOL_SWEEP_THRESHOLD=30  # ❌ Removed - not used in code
```

---

### 2. Missing USDT Pool Variables Added
**Problem:** Code references `USDT_POOL_SWEEP_THRESHOLD` but it wasn't in .env (defaulting to 30).

**Fix:** ✅ Added explicit USDT Pool configuration

```diff
+ # ============================================
+ # USDT Pool System (Legacy/Alternative Pool)
+ # ============================================
+ USDT_POOL_INITIAL_SIZE=2
+ USDT_POOL_SWEEP_THRESHOLD=30
```

---

### 3. Health Endpoint - No Fix Needed ✅
**Problem:** Earlier "Cannot GET /api/health" error

**Root Cause:** Service was still starting + incorrect endpoint path used

**Solution:** 
- ✅ Service now fully started
- ✅ Correct endpoints available:
  - `GET /health` → Root health check with database status
  - `GET /api/status/health` → Status API health check
- ❌ `/api/health` does NOT exist (this was the error)

---

## Final .env Structure

### Merchant Pool System
```bash
MERCHANT_POOL_INITIAL_SIZE=2

# Per-chain sweep configurations (each chain independent)
TRX_SWEEP=time:10          # Time-based: sweep 10 min after payout
ETH_SWEEP=time:10          # Time-based: sweep 10 min after payout
USDT_TRC20_SWEEP=threshold:30   # Threshold: sweep at $30 USD
USDT_ERC20_SWEEP=threshold:50   # Threshold: sweep at $50 USD
USDC_ERC20_SWEEP=threshold:30   # Threshold: sweep at $30 USD
```

### USDT Pool System (Separate)
```bash
USDT_POOL_INITIAL_SIZE=2
USDT_POOL_SWEEP_THRESHOLD=30
```

---

## Understanding the Two Pool Systems

### System 1: Merchant Pool (Main System)
- **File:** `services/merchantPoolService.ts`
- **Purpose:** Per-merchant pools for ALL crypto payments
- **Configuration:** Per-chain sweep rules
- **Variables Used:**
  - `MERCHANT_POOL_INITIAL_SIZE` ✅
  - `TRX_SWEEP`, `ETH_SWEEP`, etc. ✅
  - ~~`MERCHANT_POOL_SWEEP_THRESHOLD`~~ ❌ (was not used)

### System 2: USDT Pool (Legacy/Alternative)
- **File:** `services/usdtPoolService.ts`
- **Purpose:** Global USDT pool (separate system)
- **Configuration:** Single threshold for both USDT chains
- **Variables Used:**
  - `USDT_POOL_INITIAL_SIZE` ✅
  - `USDT_POOL_SWEEP_THRESHOLD` ✅

---

## Why There's No Contradiction Anymore

**Before:**
```bash
MERCHANT_POOL_SWEEP_THRESHOLD=30    # Global threshold? (unused)
ETH_SWEEP=time:10                   # Per-chain time-based
USDT_ERC20_SWEEP=threshold:50       # Per-chain threshold $50
```
This looked contradictory - why have both global and per-chain thresholds?

**After:**
```bash
# Merchant Pool - Per-chain configurations
MERCHANT_POOL_INITIAL_SIZE=2
ETH_SWEEP=time:10
USDT_TRC20_SWEEP=threshold:30
USDT_ERC20_SWEEP=threshold:50

# USDT Pool - Separate system with its own threshold
USDT_POOL_INITIAL_SIZE=2
USDT_POOL_SWEEP_THRESHOLD=30
```
Now it's clear: merchant pool uses per-chain configs, USDT pool has its own system.

---

## Health Check Endpoints (Working)

### 1. Root Health Check
```bash
curl http://localhost:8001/health

Response:
{
  "status": "healthy",
  "service": "DynoPay Backend",
  "database": "connected",
  "timestamp": "2026-01-28T21:45:12.459Z",
  "uptime": 183.517
}
```

### 2. Status API Health Check
```bash
curl http://localhost:8001/api/status/health

Response:
{
  "status": "healthy",
  "timestamp": "2026-01-28T21:45:13.473Z",
  "version": "1.0.0"
}
```

### 3. ❌ Invalid Endpoint (Does Not Exist)
```bash
curl http://localhost:8001/api/health
# Error: Cannot GET /api/health
```

**Why?** The endpoint is either `/health` (root) or `/api/status/health` (nested), not `/api/health`.

---

## Testing Recommendations

After this cleanup, test:

1. **Merchant Pool Initialization**
   ```bash
   # Check logs for merchant pool initialization
   tail -f /var/log/supervisor/backend.out.log | grep MerchantPool
   ```

2. **USDT Pool Initialization**
   ```bash
   # Check logs for USDT pool initialization
   tail -f /var/log/supervisor/backend.out.log | grep USDTPool
   ```

3. **Health Endpoints**
   ```bash
   curl http://localhost:8001/health
   curl http://localhost:8001/api/status/health
   ```

---

## Summary

✅ **Removed:** Unused `MERCHANT_POOL_SWEEP_THRESHOLD`
✅ **Added:** Missing `USDT_POOL_INITIAL_SIZE` and `USDT_POOL_SWEEP_THRESHOLD`
✅ **Clarified:** Two separate pool systems with different configurations
✅ **Fixed:** Health endpoint understanding (use `/health` or `/api/status/health`)
✅ **No Restart Needed:** These variables were either unused or have defaults

**Status:** All contradictions resolved ✅
