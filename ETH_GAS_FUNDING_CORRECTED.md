# ETH Payment Gas Funding - CORRECTED ✅

## You're Absolutely Right!

For **native currencies like ETH**, gas is paid from the **pool address's own ETH balance**, NOT from a separate gas funding wallet.

---

## How Gas Works for Different Chain Types

### **1. Native Currencies (ETH, TRX, BTC, LTC, DOGE, BCH)**

**Gas is paid from the address's own balance:**

```
Pool Address has: 0.00332151 ETH
    ↓
Need to send: 0.00325588 ETH (merchant payout)
    ↓
Gas cost: ~0.00006563 ETH (from same address)
    ↓
Total deducted from pool address: 0.00332151 ETH
    ↓
Merchant receives: 0.00325588 ETH
Gas consumed: 0.00006563 ETH (burned)
```

**No external gas funding needed!** The ETH payment itself contains enough ETH to pay for gas.

---

### **2. Token Currencies (USDT-ERC20, USDT-TRC20, USDC-ERC20)**

**Gas MUST be funded separately:**

```
Pool Address has: 10 USDT-ERC20
BUT: 0 ETH (no gas!)
    ↓
PROBLEM: Can't send USDT without ETH for gas
    ↓
SOLUTION: Fund gas from ETH_FEE_WALLET
    ↓
ETH_FEE_WALLET sends: 0.001 ETH → Pool Address
    ↓
Now pool address has: 10 USDT + 0.001 ETH
    ↓
Can now transfer USDT (using ETH for gas)
```

**External gas funding required!** Tokens can't pay for their own gas.

---

## Corrected ETH Payment Flow

### **When You Send 0.00332151 ETH to Pool Address:**

```
0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51 receives: 0.00332151 ETH
```

**Distribution:**
- Merchant payout: 0.00325588 ETH (98%)
- Admin fee: 0.00006563 ETH (2%)

**Merchant Payout Transaction:**
```
FROM: 0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51 (pool address)
TO: 0x9a7221b5e32d5f99e8da95585835442e29afb38f (merchant wallet)
AMOUNT: 0.00325588 ETH
GAS: Paid from pool address's own ETH (~0.00001 ETH)
NO EXTERNAL GAS FUNDING NEEDED ✅
```

**Admin Fee Sweep (10 minutes later):**
```
FROM: 0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51 (pool address)
TO: 0x9a7221b5e32d5f99e8da95585835442e29afb38f (admin wallet)
AMOUNT: 0.00006563 ETH (remaining balance minus gas)
GAS: Paid from pool address's own ETH (~0.00001 ETH)
NO EXTERNAL GAS FUNDING NEEDED ✅
```

---

## Role of ETH_FEE_WALLET

**ETH_FEE_WALLET is used ONLY for tokens, NOT for native ETH:**

```bash
ETH_FEE_WALLET=0x033d2bb052e3d85bfe96fbd86cf876a350ad6b1c
```

**When it's used:**
- ✅ USDT-ERC20 transfer (needs ETH for gas)
- ✅ USDC-ERC20 transfer (needs ETH for gas)
- ❌ ETH transfer (uses its own ETH)

**When it's NOT used:**
- ❌ ETH payment (native - pays own gas)
- ❌ TRX payment (native - pays own gas)
- ❌ BTC/LTC/DOGE/BCH (UTXO - no gas concept)

---

## Code Reference

From `services/merchantPoolService.ts`:

```typescript
export const fundGasIfNeeded = async (
  poolAddress: any,
  walletType: string
): Promise<{ funded: boolean; amount: number; txId?: string }> => {
  // UTXO chains don't need separate gas funding
  if (UTXO_CHAINS.includes(walletType)) {
    return { funded: false, amount: 0 };
  }

  const gasToken = GAS_TOKEN_MAPPING[walletType];
  
  // For ETH: gasToken = null (ETH pays its own gas)
  // For USDT-ERC20: gasToken = "ETH" (needs external ETH)
  
  if (!gasToken) {
    return { funded: false, amount: 0 };  // ← ETH returns here
  }
  
  // ... rest is only for tokens
}
```

**GAS_TOKEN_MAPPING:**
```typescript
const GAS_TOKEN_MAPPING: Record<string, string> = {
  "USDT-ERC20": "ETH",  // Token needs ETH
  "USDC-ERC20": "ETH",  // Token needs ETH
  "USDT-TRC20": "TRX",  // Token needs TRX
  // ETH not in mapping - doesn't need external gas!
  // TRX not in mapping - doesn't need external gas!
};
```

---

## Summary Table

| Chain Type | Example | Gas Funded From | External Wallet Needed? |
|------------|---------|-----------------|------------------------|
| **Native (UTXO)** | BTC, LTC, DOGE, BCH | Transaction fees deducted | ❌ No |
| **Native (Account)** | ETH, TRX | Own address balance | ❌ No |
| **Token (ERC20)** | USDT-ERC20, USDC-ERC20 | ETH_FEE_WALLET | ✅ Yes |
| **Token (TRC20)** | USDT-TRC20 | TRX_FEE_WALLET | ✅ Yes |

---

## Corrected $10 ETH Payment Flow

### **Merchant Payout ($9.80):**
```
1. Pool address has: 0.00332151 ETH ($10)
2. Calculate merchant amount: $9.80 = 0.00325588 ETH
3. Transfer: 
   FROM: 0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51 (pool address)
   TO: 0x9a7221b5e32d5f99e8da95585835442e29afb38f (merchant)
   AMOUNT: 0.00325588 ETH
   GAS: ~0.00001 ETH (deducted from pool address balance)
4. No external gas funding ✅
5. Record in tbl_merchant_pool_transaction
6. Remaining in pool: 0.00006563 ETH (admin fee + leftover)
```

### **Admin Fee Sweep ($0.20):**
```
1. Pool address has: ~0.00005563 ETH (admin fee minus gas from payout)
2. Wait 10 minutes
3. Transfer:
   FROM: 0xf6dc2d96fa94a4de7fe78aff63e3e2a1fe7cba51 (pool address)
   TO: 0x9a7221b5e32d5f99e8da95585835442e29afb38f (admin)
   AMOUNT: ~0.00004563 ETH (balance minus gas)
   GAS: ~0.00001 ETH (deducted from amount being swept)
4. No external gas funding ✅
5. Record in tbl_merchant_pool_sweep
6. Pool address now empty, ready for reuse
```

---

## What ETH_FEE_WALLET Actually Does

**Example: USDT-ERC20 Payment ($10)**

```
Customer sends: 10 USDT-ERC20 to pool address
    ↓
Pool address has: 10 USDT but 0 ETH
    ↓
Can't transfer USDT without ETH!
    ↓
ETH_FEE_WALLET funds: 0.001 ETH → Pool address
    ↓
Now pool has: 10 USDT + 0.001 ETH
    ↓
Transfer USDT using ETH for gas ✅
```

**But for ETH payments:**
```
Customer sends: 0.00332151 ETH to pool address
    ↓
Pool address has ETH (which IS the gas!)
    ↓
No gas funding needed ✅
    ↓
Transfer ETH directly using ETH for gas ✅
```

---

## Conclusion

You're **100% correct!** 

- **ETH uses its own balance for gas** - no external funding
- **ETH_FEE_WALLET is only for tokens** (USDT, USDC)
- **Native currencies (ETH, TRX, BTC, etc.) pay their own way**

The original response was **incorrect** about ETH gas funding. Thank you for catching this!

**Corrected Status:** ETH payments use their own ETH for gas fees. No external wallet involved.
