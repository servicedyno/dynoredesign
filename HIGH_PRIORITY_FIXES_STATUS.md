# Remaining High-Priority Fixes Implementation

## Status: Implementation Scripts Created

The following fixes have been prepared and need to be integrated:

---

## 4. ✅ Currency Conversion Fallback with Caching

**File to create**: `/app/backend/services/currencyConversionCache.ts`

```typescript
/**
 * Currency Conversion with Caching Fallback
 * Prevents sweep failures when conversion API is down
 */

import { getRedisItem, setRedisItem } from "../utils/redisInstance";

interface CachedRate {
  rate: number;
  timestamp: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function convertCryptoToUSD(
  cryptoAmount: number,
  walletType: string
): Promise<number | null> {
  const cacheKey = `conversion_rate:${walletType}:USD`;
  
  try {
    // Try live conversion first
    const result = await currencyConvert({
      from: [walletType],
      to: ["USD"],
      amount: [cryptoAmount.toString()],
    });
    
    const usdAmount = parseFloat(result?.data?.[0] || "0");
    
    // Cache the rate
    const rate = usdAmount / cryptoAmount;
    await setRedisItem(cacheKey, {
      rate,
      timestamp: Date.now(),
    });
    
    return usdAmount;
    
  } catch (error) {
    console.warn(`[ConversionCache] Live conversion failed for ${walletType}, trying cache...`);
    
    // Fallback to cached rate
    const cached = await getRedisItem(cacheKey) as CachedRate;
    
    if (cached && cached.timestamp) {
      const age = Date.now() - cached.timestamp;
      
      if (age < CACHE_TTL_MS) {
        const usdAmount = cryptoAmount * cached.rate;
        console.warn(`[ConversionCache] Using cached rate for ${walletType} (${Math.floor(age/60000)} min old)`);
        return usdAmount;
      } else {
        console.error(`[ConversionCache] Cached rate too old for ${walletType} (${Math.floor(age/3600000)} hours)`);
      }
    }
    
    // No cache or expired - sweep must wait
    console.error(`[ConversionCache] No valid conversion rate for ${walletType}, skipping sweep`);
    return null;
  }
}
```

**Integration**: Replace `currencyConvert` calls in sweep functions with `convertCryptoToUSD`

---

## 5. ✅ Fee Wallet Balance Monitoring

**Add to**: `/app/backend/services/merchantPoolService.ts`

```typescript
/**
 * Check fee wallet balance before funding gas
 * Prevents failures and sends alerts when low
 */
export const checkFeeWalletBalance = async (
  gasToken: string,
  amountNeeded: number
): Promise<{ sufficient: boolean; balance: number }> => {
  const feeWallet = FEE_WALLETS[gasToken];
  
  if (!feeWallet) {
    throw new Error(`Fee wallet not found for ${gasToken}`);
  }
  
  try {
    // Get current balance
    const balanceData = await tatumApi.getAddressBalance(feeWallet, gasToken);
    const balance = parseFloat(balanceData?.balance || "0");
    
    console.log(`[MerchantPool] Fee wallet ${gasToken} balance: ${balance}`);
    
    // Check if sufficient
    if (balance < amountNeeded) {
      console.error(`[MerchantPool] 🚨 INSUFFICIENT FEE WALLET BALANCE`);
      console.error(`[MerchantPool] 🚨 ${gasToken}: Have ${balance}, Need ${amountNeeded}`);
      
      // TODO: Send alert email/notification
      // await sendAlert(`Fee wallet ${gasToken} needs funding`);
      
      return { sufficient: false, balance };
    }
    
    // Warn if getting low (< 10x needed amount)
    if (balance < amountNeeded * 10) {
      console.warn(`[MerchantPool] ⚠️  Fee wallet ${gasToken} running low: ${balance}`);
      // TODO: Send low balance warning
    }
    
    return { sufficient: true, balance };
    
  } catch (error) {
    console.error(`[MerchantPool] Failed to check fee wallet balance:`, error);
    throw error;
  }
};

// Update fundGasIfNeeded to use this check
```

---

## 6. ✅ Profitability Check for Sweeps

**Add to sweep functions in**: `/app/backend/services/merchantPoolService.ts`

```typescript
/**
 * Check if sweep is profitable (fees don't exceed balance)
 */
export const isSweepProfitable = async (
  cryptoAmount: number,
  walletType: string
): Promise<{ profitable: boolean; reason?: string }> => {
  try {
    // Convert admin fee to USD
    const adminFeeUSD = await convertCryptoToUSD(cryptoAmount, walletType);
    
    if (!adminFeeUSD) {
      return { profitable: false, reason: "Unable to convert to USD" };
    }
    
    // Estimate transaction fee (simplified - actual implementation varies)
    const estimatedFeeCrypto = await estimateSweepFee(walletType);
    const feeUSD = await convertCryptoToUSD(estimatedFeeCrypto, walletType);
    
    if (!feeUSD) {
      return { profitable: false, reason: "Unable to estimate fee cost" };
    }
    
    // Profitable if balance >= fee * 1.5 (50% minimum profit margin)
    const minRequired = feeUSD * 1.5;
    
    if (adminFeeUSD < minRequired) {
      const reason = `Unprofitable: $${adminFeeUSD.toFixed(2)} < $${minRequired.toFixed(2)} (fee: $${feeUSD.toFixed(2)})`;
      return { profitable: false, reason };
    }
    
    return { profitable: true };
    
  } catch (error) {
    console.error(`[MerchantPool] Profitability check failed:`, error);
    return { profitable: false, reason: "Check failed" };
  }
};

// Use in sweep logic:
// const profitCheck = await isSweepProfitable(amount, walletType);
// if (!profitCheck.profitable) {
//   console.warn(`Skipping sweep: ${profitCheck.reason}`);
//   continue;
// }
```

---

## 7. ✅ Gas Recovery Mechanism

**Add new function to**: `/app/backend/services/merchantPoolService.ts`

```typescript
/**
 * Recover excess gas from pool addresses
 * Run periodically to reclaim TRX/ETH stuck in addresses
 */
export const recoverExcessGas = async (): Promise<void> => {
  console.log(`[MerchantPool] 🔄 Starting excess gas recovery...`);
  
  // Define thresholds (recover if gas_balance > threshold)
  const GAS_RECOVERY_THRESHOLDS = {
    TRX: 50,  // Recover if > 50 TRX
    ETH: 0.005,  // Recover if > 0.005 ETH
  };
  
  try {
    // Find addresses with excess gas
    const addressesWithGas = await merchantTempAddressModel.findAll({
      where: {
        status: "AVAILABLE",
        wallet_type: { [Op.in]: ["USDT-TRC20", "USDT-ERC20", "USDC-ERC20"] }, // Tokens
        gas_balance: { [Op.gt]: 0 },
      },
    });
    
    console.log(`[MerchantPool] Found ${addressesWithGas.length} addresses with gas`);
    
    let recovered = 0;
    
    for (const address of addressesWithGas) {
      const walletType = address.dataValues.wallet_type;
      const gasBalance = parseFloat(address.dataValues.gas_balance);
      
      // Determine gas token
      const gasToken = walletType.includes("TRC20") ? "TRX" : "ETH";
      const threshold = GAS_RECOVERY_THRESHOLDS[gasToken];
      
      if (gasBalance >= threshold) {
        try {
          console.log(`[MerchantPool] Recovering ${gasBalance} ${gasToken} from ${address.dataValues.wallet_address}`);
          
          // Transfer gas back to fee wallet
          const privateKey = await tatumApi.decryptSymmetric(
            address.dataValues.private_key,
            process.env.TEMP_KEY_ID
          );
          
          const feeWallet = FEE_WALLETS[gasToken];
          
          const result = await tatumApi.assetToOtherAddress({
            currency: gasToken,
            fromAddress: address.dataValues.wallet_address,
            toAddress: feeWallet,
            privateKey,
            amount: gasBalance.toString(),
          });
          
          // Update gas_balance
          await address.update({ gas_balance: 0 });
          
          console.log(`[MerchantPool] ✅ Recovered ${gasBalance} ${gasToken} (tx: ${result.txId})`);
          recovered++;
          
        } catch (error) {
          console.error(`[MerchantPool] Failed to recover gas from ${address.dataValues.wallet_address}:`, error);
        }
      }
    }
    
    console.log(`[MerchantPool] 🎉 Gas recovery complete: ${recovered} addresses`);
    
  } catch (error) {
    console.error(`[MerchantPool] Gas recovery failed:`, error);
  }
};

// Add to cron jobs:
// Run daily at 3 AM
// cron.schedule("0 3 * * *", recoverExcessGas);
```

---

## Integration Status

### ✅ Implemented (in code):
1. Duplicate transaction detection
2. Sweep database consistency
3. Startup configuration validation

### 📝 Scripts Created (need integration):
4. Currency conversion caching
5. Fee wallet balance monitoring
6. Profitability checks
7. Gas recovery

### Next Steps:

1. **Restart backend** to test critical fixes
2. **Integrate remaining scripts** (4-7) into merchantPoolService
3. **Test each fix** with simulated scenarios
4. **Monitor logs** for validation success

---

## Testing Commands

```bash
# Restart backend with new fixes
sudo supervisorctl restart backend

# Check startup validation
tail -f /var/log/supervisor/backend.out.log | grep "MerchantPool.*Configuration"

# Should see:
# [MerchantPool] 🔍 Validating configuration...
# [MerchantPool] ✅ Configuration validation passed

# Test duplicate detection (if webhook fires twice)
# Should see:
# [cryptoVerification] ⚠️  DUPLICATE WEBHOOK DETECTED

# Test sweep consistency
# Should see improved logging with phases
```

---

**Status**: 3/7 fixes deployed, 4/7 ready for integration
**Estimated remaining time**: 2-3 hours to integrate and test
