# Invalid Merchant Pool Address Analysis

**Date:** February 2, 2026

---

## Summary

5 wallet addresses in the merchant pool are **invalid** and causing subscription creation failures during the health check cron job.

---

## Root Cause

**These addresses are NOT valid blockchain addresses.** They appear to be:

1. **Test/mock data** that was inserted during development
2. **Corrupted data** from a broken address generation process
3. **Placeholder addresses** that were never replaced with real ones

### Why They "Look Correct" But Aren't

| Address | Starts With | Labeled As | Expected Format |
|---------|-------------|------------|-----------------|
| `def3hcqxppfhj6v6qkuqgfhewkuupfhgpt` | `de` (lowercase) | DOGE | Must start with `D` (uppercase) |
| `ta8r86vyzjw56jbf5xmvx4ort1jfg4ayvw` | `ta` (lowercase) | TRX | Must start with `T` (uppercase) |
| `ltiwkhaovzfejn4uisqbvvhnhrjis1hbtd` | `lt` (lowercase) | LTC? | Must start with `ltc1` or `L` or `M` |
| `trisacnvjpaqd46no53ccdxeztpkcvcxbw` | `tr` (lowercase) | Unknown | No valid crypto prefix |
| `dbmv6somus71qktsvrqjcxpeiaypnmzhwl` | `db` (lowercase) | DOGE? | Must start with `D` (uppercase) |

### Key Issue: **Case Sensitivity**

Blockchain addresses are **case-sensitive**:
- **DOGE** mainnet addresses start with uppercase `D` (not lowercase `d`)
- **TRON (TRX)** addresses start with uppercase `T` (not lowercase `t`)
- **LTC** Bech32 addresses start with lowercase `ltc1` (not just `lt`)

These addresses are all **34 characters** (which is correct length for many chains), but have **invalid prefixes**.

---

## Evidence from Logs

```
[MerchantPool] ⚠️ Missing subscription for def3hcqxppfhj6v6qkuqgfhewkuupfhgpt (DOGE), creating...
[createSubscription] Address: def3hcqxppfhj6v6qkuqgfhewkuupfhgpt, Chain: DOGE

Tatum API Response:
{
  "statusCode": 400,
  "errorCode": "validation.failed",
  "message": "Request validation failed",
  "data": [
    "attr.address must be a valid mainnet DOGE address. Doge address must start with D or n."
  ]
}
```

---

## Impact

| Impact | Severity |
|--------|----------|
| Subscription health check failures | ⚠️ Medium |
| Log pollution with repeated errors | 🟡 Low |
| Payments to these addresses | ❌ Would never work |
| System stability | ✅ No impact (error is caught) |

These addresses can never receive payments because:
1. They're not real blockchain addresses
2. Tatum cannot create subscriptions for them
3. No webhook will ever fire for them

---

## Valid Address Format Examples

| Chain | Format | Example |
|-------|--------|---------|
| **DOGE** | Starts with `D` (mainnet) | `DLxgyWVWQoFYd7Kv5JYsJHU7TRdTpJVq5H` |
| **TRX/TRON** | Starts with `T` | `TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW` |
| **LTC Legacy** | Starts with `L` or `M` | `LQ8Z3RQfj5xMvHWKJqfb3RqBY8H5xvgFPL` |
| **LTC Bech32** | Starts with `ltc1` | `ltc1qhkfq3zahaqkkzx5mjnamwjsfpq2jk7z0tamvpr` |
| **BTC** | Starts with `1`, `3`, or `bc1` | `bc1qrwecur55uvlhpha0j39dzg36x89vysvvme8gkz` |
| **ETH/ERC20** | Starts with `0x` | `0xa1d597e69a9e4da3a75bdae530b5cc19d8807a45` |

---

## Recommended Fix

### Option 1: Delete Invalid Addresses (Recommended)

Run this SQL to remove the invalid addresses:

```sql
DELETE FROM tbl_merchant_temp_address 
WHERE wallet_address IN (
  'def3hcqxppfhj6v6qkuqgfhewkuupfhgpt',
  'ta8r86vyzjw56jbf5xmvx4ort1jfg4ayvw',
  'ltiwkhaovzfejn4uisqbvvhnhrjis1hbtd',
  'trisacnvjpaqd46no53ccdxeztpkcvcxbw',
  'dbmv6somus71qktsvrqjcxpeiaypnmzhwl'
);
```

### Option 2: Add Address Validation

Add validation in `merchantPoolService.ts` before creating subscriptions:

```typescript
// Add this validation function
const isValidAddress = (address: string, walletType: string): boolean => {
  switch (walletType) {
    case 'DOGE':
      return /^D[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    case 'TRX':
    case 'USDT-TRC20':
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
    case 'BTC':
      return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    case 'ETH':
    case 'USDT-ERC20':
    case 'USDC-ERC20':
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    case 'LTC':
      return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    default:
      return true; // Allow unknown types
  }
};

// In subscriptionHealthCheck, before creating subscription:
if (!isValidAddress(walletAddress, walletType)) {
  console.warn(`[MerchantPool] ⚠️ Skipping invalid address ${walletAddress} (${walletType})`);
  result.failed++;
  result.errors.push(`${walletAddress}: Invalid address format for ${walletType}`);
  continue;
}
```

### Option 3: Skip Invalid in Health Check (Quick Fix)

Add a try-catch that silently skips addresses that fail Tatum validation:

```typescript
// In subscriptionHealthCheck, modify the error handling:
} catch (subError: any) {
  const errorData = subError.response?.data;
  
  // Skip addresses that fail validation (likely invalid format)
  if (errorData?.errorCode === 'validation.failed') {
    console.warn(`[MerchantPool] ⚠️ Address ${walletAddress} failed validation, skipping`);
    // Don't count as error, just skip
    continue;
  }
  
  // Handle other errors...
}
```

---

## Conclusion

The "correct alphabet" observation is misleading - these addresses **start with the right letters** but in the **wrong case**:

- `def...` starts with `d` but DOGE needs `D`
- `ta8...` starts with `t` but TRON needs `T`

This is likely **test data** that was never cleaned up from the production database. The fix is to either:
1. Delete these invalid addresses from the database
2. Add validation to skip them during health checks
