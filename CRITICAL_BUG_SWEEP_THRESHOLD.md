# CRITICAL BUG ANALYSIS - Merchant Pool Sweep Threshold

## 🚨 CRITICAL ISSUE IDENTIFIED

### Problem Statement
The merchant pool sweep threshold comparison has a **critical type mismatch bug**:
- `admin_fee_balance` is stored in **CRYPTO AMOUNT** (e.g., 0.001 BTC, 1.5 ETH, 50 USDT)
- `SWEEP_THRESHOLD` is configured in **USD** ($30)
- Direct comparison without USD conversion causes incorrect sweep behavior

---

## Current Implementation Analysis

### Configuration
```typescript
// From merchantPoolService.ts line 34
const POOL_CONFIG = {
  SWEEP_THRESHOLD: parseFloat(process.env.MERCHANT_POOL_SWEEP_THRESHOLD || "30"),  // $30 USD
};
```

### Database Schema
```typescript
// From merchantPoolModels/index.ts line 166-170
admin_fee_balance: {
  type: DataTypes.DECIMAL(20, 8),
  defaultValue: 0,
  comment: "Accumulated admin fees in this address",  // ⚠️ In CRYPTO, not USD!
}
```

### Sweep Logic (BUGGY)
```typescript
// From merchantPoolService.ts line 842-848
export const sweepAllEligibleAddresses = async (): Promise<void> => {
  const eligibleAddresses = await merchantTempAddressModel.findAll({
    where: {
      status: "AVAILABLE",
      admin_fee_balance: { [Op.gte]: POOL_CONFIG.SWEEP_THRESHOLD },  // ❌ BUG: Comparing crypto to USD!
    },
  });
  // ...
};
```

---

## Impact Analysis

### Per-Chain Behavior

#### ✅ Works Correctly (by accident):
1. **Stablecoins** (USDT-TRC20, USDT-ERC20, USDC-ERC20)
   - admin_fee_balance: 50 USDT ≈ $50 USD
   - Threshold: $30 USD
   - Comparison: `50 >= 30` ✅ TRUE → Sweep triggered correctly

#### ❌ Broken Behavior:
2. **BTC**
   - admin_fee_balance: 0.0005 BTC ≈ $50 USD (if BTC = $100,000)
   - Threshold: $30 USD
   - Comparison: `0.0005 >= 30` ❌ FALSE → **NEVER SWEEPS!**

3. **ETH**
   - admin_fee_balance: 0.015 ETH ≈ $50 USD (if ETH = $3,333)
   - Threshold: $30 USD
   - Comparison: `0.015 >= 30` ❌ FALSE → **NEVER SWEEPS!**

4. **TRX**
   - admin_fee_balance: 200 TRX ≈ $50 USD (if TRX = $0.25)
   - Threshold: $30 USD
   - Comparison: `200 >= 30` ✅ TRUE → Sweeps too early (at ~$7.50)

5. **DOGE**
   - admin_fee_balance: 100 DOGE ≈ $50 USD (if DOGE = $0.50)
   - Threshold: $30 USD
   - Comparison: `100 >= 30` ✅ TRUE → Sweeps too early (at ~$15)

6. **LTC**
   - admin_fee_balance: 0.5 LTC ≈ $50 USD (if LTC = $100)
   - Threshold: $30 USD
   - Comparison: `0.5 >= 30` ❌ FALSE → **NEVER SWEEPS!**

---

## Real-World Scenarios

### Scenario 1: BTC Pool Address
```
Admin Fee Balance: 0.001 BTC (≈ $100 USD)
Threshold Check: 0.001 >= 30 → FALSE
Result: ❌ Never sweeps, fees accumulate indefinitely
Risk: Security issue - funds stuck in pool address
```

### Scenario 2: ETH Pool Address
```
Admin Fee Balance: 0.05 ETH (≈ $166 USD)
Threshold Check: 0.05 >= 30 → FALSE
Result: ❌ Never sweeps, fees accumulate indefinitely
Risk: Security issue - funds stuck in pool address
```

### Scenario 3: USDT Pool Address
```
Admin Fee Balance: 50 USDT (≈ $50 USD)
Threshold Check: 50 >= 30 → TRUE
Result: ✅ Sweeps correctly (works by accident)
```

### Scenario 4: TRX Pool Address
```
Admin Fee Balance: 35 TRX (≈ $8.75 USD)
Threshold Check: 35 >= 30 → TRUE
Result: ⚠️ Sweeps too early (wastes gas fees)
```

---

## Root Cause

### Why This Bug Exists

1. **Missing USD Conversion**: The code imports `currencyConvert` but doesn't use it in sweep logic
2. **Type Confusion**: Database stores crypto amounts, config is in USD
3. **No Documentation**: Comment says "Accumulated admin fees" but doesn't specify unit
4. **Stablecoins Hide Bug**: System works for USDT/USDC, masking the issue

---

## Correct Implementation

### Option 1: Convert to USD Before Comparison (RECOMMENDED)

```typescript
export const sweepAllEligibleAddresses = async (): Promise<void> => {
  // Get all addresses with any accumulated fees
  const addressesWithFees = await merchantTempAddressModel.findAll({
    where: {
      status: "AVAILABLE",
      admin_fee_balance: { [Op.gt]: 0 },
    },
  });

  const eligibleAddresses = [];
  
  // Check each address against USD threshold
  for (const address of addressesWithFees) {
    const cryptoAmount = parseFloat(address.dataValues.admin_fee_balance);
    const walletType = address.dataValues.wallet_type;
    
    // Convert crypto amount to USD
    const usdValue = await currencyConvert({
      from: [walletType],
      to: ['USD'],
      amount: [cryptoAmount.toString()],
    });
    
    const usdAmount = parseFloat(usdValue?.data?.[0] || "0");
    
    // Compare USD value to threshold
    if (usdAmount >= POOL_CONFIG.SWEEP_THRESHOLD) {
      console.log(`[MerchantPool] ${address.dataValues.wallet_address}: ${cryptoAmount} ${walletType} = $${usdAmount} USD (threshold: $${POOL_CONFIG.SWEEP_THRESHOLD})`);
      eligibleAddresses.push(address);
    }
  }

  console.log(`[MerchantPool] Found ${eligibleAddresses.length} addresses eligible for sweep`);

  for (const address of eligibleAddresses) {
    try {
      await sweepPoolAddress(address.dataValues.temp_address_id);
    } catch (error) {
      console.error(`[MerchantPool] Failed to sweep ${address.dataValues.wallet_address}:`, error);
    }
  }
};
```

### Option 2: Store USD Value in Database

**Pros**: Faster queries, no API calls
**Cons**: Requires database migration, needs price updates

```typescript
// Add new column
admin_fee_balance_usd: {
  type: DataTypes.DECIMAL(20, 2),
  defaultValue: 0,
  comment: "Admin fees in USD equivalent",
}

// Update on every fee accumulation
const usdValue = await currencyConvert(...);
await poolAddress.update({
  admin_fee_balance: cryptoAmount,
  admin_fee_balance_usd: usdValue,
});

// Query becomes simple
const eligibleAddresses = await merchantTempAddressModel.findAll({
  where: {
    status: "AVAILABLE",
    admin_fee_balance_usd: { [Op.gte]: POOL_CONFIG.SWEEP_THRESHOLD },
  },
});
```

### Option 3: Per-Chain Thresholds in Crypto

**Pros**: No conversion needed, predictable
**Cons**: Needs manual updates when prices change

```typescript
const SWEEP_THRESHOLDS_CRYPTO = {
  'BTC': 0.0003,        // ~$30 at $100k/BTC
  'ETH': 0.009,         // ~$30 at $3.3k/ETH
  'USDT-TRC20': 30,     // $30
  'USDT-ERC20': 30,     // $30
  'USDC-ERC20': 30,     // $30
  'TRX': 120,           // ~$30 at $0.25/TRX
  'LTC': 0.3,           // ~$30 at $100/LTC
  'DOGE': 60,           // ~$30 at $0.50/DOGE
};

// Check per wallet type
const threshold = SWEEP_THRESHOLDS_CRYPTO[walletType];
if (admin_fee_balance >= threshold) {
  // Sweep
}
```

---

## Recommended Solution

### Use **Option 1** (Convert to USD)

**Reasons**:
1. ✅ No database migration required
2. ✅ Always accurate (uses live prices)
3. ✅ Single threshold value ($30 USD)
4. ✅ Works for all chains consistently
5. ✅ Uses existing `currencyConvert` function

**Trade-offs**:
- ⚠️ API calls during sweep (acceptable, runs periodically)
- ⚠️ Slight performance impact (negligible)

---

## Implementation Priority

### 🚨 CRITICAL (Fix Immediately)
This bug causes:
1. **BTC/ETH/LTC fees never sweep** → Funds stuck in pool addresses
2. **TRX/DOGE fees sweep too early** → Wasted gas fees
3. **Security risk** → Accumulated funds in pool addresses
4. **Revenue loss** → Admin fees not collected

### Estimated Impact
- **High-value chains** (BTC, ETH): Fees never collected
- **Low-value chains** (TRX, DOGE): Inefficient sweeping
- **Stablecoins** (USDT, USDC): Working correctly (by accident)

---

## Testing Requirements

After fix, test:

1. **BTC Pool**: Accumulate 0.0005 BTC (~$50), verify sweep triggers
2. **ETH Pool**: Accumulate 0.02 ETH (~$66), verify sweep triggers
3. **USDT Pool**: Accumulate 50 USDT, verify sweep still works
4. **TRX Pool**: Accumulate 35 TRX (~$9), verify NO sweep (below $30)
5. **Multi-chain**: Multiple addresses from different chains

---

## Current Status

❌ **BROKEN**: 
- BTC, ETH, LTC pools never sweep (fees stuck)
- TRX, DOGE pools sweep too early (wasteful)

✅ **WORKING** (by accident):
- USDT-TRC20, USDT-ERC20, USDC-ERC20 (1:1 USD parity)

⚠️ **RISK LEVEL**: HIGH
- Funds accumulating in pool addresses
- May require manual intervention to recover

---

## Next Steps

1. ✅ **Document the bug** (this file)
2. ⏳ **Implement Option 1 fix** (USD conversion)
3. ⏳ **Test with all chains**
4. ⏳ **Deploy to production**
5. ⏳ **Monitor sweep behavior**
6. ⏳ **Consider Option 2 for optimization** (later)

---

## Files to Modify

1. `/app/backend/services/merchantPoolService.ts`
   - Function: `sweepAllEligibleAddresses()` (line 842)
   - Add USD conversion before threshold check

2. `/app/backend/models/merchantPoolModels/index.ts`
   - Optional: Add `admin_fee_balance_usd` column (Option 2)
   - Update comments to clarify units

3. `/app/backend/.env`
   - Document that SWEEP_THRESHOLD is in USD

---

*Last Updated: 2026-01-28*
*Severity: CRITICAL*
*Status: IDENTIFIED - REQUIRES FIX*
