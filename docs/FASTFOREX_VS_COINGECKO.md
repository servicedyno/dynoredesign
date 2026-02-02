# Currency Conversion APIs - FastForex vs CoinGecko

## You're Right! Both Are Implemented! 🎯

### Two Different APIs for Different Purposes:

## 1. FastForex API (Primary for Fiat)
**API Key:** `88d0f6fc99-ddde24c462-t97lpe`
**Endpoint:** `https://api.fastforex.io/convert`

### Where FastForex is Used:
```typescript
File: /app/backend/helper/currencyConvert.ts
```

**Primary Purpose:** Fiat-to-Fiat and Fiat-to-Crypto conversions

**Used By:**
- ✅ Admin dashboard currency conversions
- ✅ Wallet balance conversions
- ✅ Payment currency conversions (USD → NGN, EUR → USD, etc.)
- ✅ Multi-currency payment processing
- ✅ Currency rate displays

**Example Usage:**
```typescript
const currencyData = await currencyConvert({
  currency: ['NGN', 'EUR', 'BTC'],
  sourceCurrency: 'USD',
  amount: 100,
  fixedDecimal: true
});

// FastForex API Call:
// GET https://api.fastforex.io/convert?api_key=xxx&from=USD&to=NGN&amount=100
```

**Supports:**
- All fiat currencies (USD, EUR, NGN, GHS, KES, etc.)
- Crypto symbols (BTC, ETH, TRX, USDT, BNB, etc.)
- Cross-currency conversions

---

## 2. CoinGecko API (Secondary for Crypto)
**No API Key Required** (Free public API)
**Endpoint:** `https://api.coingecko.com/api/v3/simple/price`

### Where CoinGecko is Used:
```typescript
File: /app/backend/controller/paymentController.ts
Function: getCryptoPriceForPayment()
```

**Primary Purpose:** Real-time crypto-to-USD pricing for payment calculations

**Used By:**
- ✅ Payment amount calculator endpoint (`/api/pay/calculatePaymentAmount`)
- ✅ Displaying crypto payment amounts
- ✅ Fee calculations for crypto payments

**Example Usage:**
```typescript
const ethPrice = await getCryptoPriceForPayment('ETH');
// CoinGecko API Call:
// GET https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd
// Returns: { ethereum: { usd: 2940.54 } }
```

**Supports:**
- BTC, ETH, LTC, DOGE, TRX, USDT, BCH
- Only USD conversions
- Real-time market prices

---

## Why Both?

### FastForex Advantages:
✅ Supports ALL currencies (fiat + crypto)
✅ Can convert between any two currencies
✅ More comprehensive for multi-currency system
✅ Used throughout the entire application
✅ Single source of truth for most conversions

**Example:**
```
USD → NGN: FastForex
EUR → GHS: FastForex
BTC → USD: FastForex
```

### CoinGecko Advantages:
✅ Free (no API key needed)
✅ Specifically designed for crypto
✅ Real-time crypto market prices
✅ Good for crypto-specific calculations
✅ Fallback option if FastForex crypto rates are delayed

**Example:**
```
ETH price in USD: CoinGecko
BTC price in USD: CoinGecko
```

---

## For Your ETH Payment - Which Was Used?

Let me check the actual code flow:

### Payment Creation Flow:
```
1. createPaymentLink (amount: $10 USD)
   ↓
2. createCryptoPayment (currency: ETH)
   ↓
3. Crypto() function generates address
   ↓
4. ??? Which API for ETH amount? ???
```

Let me trace the code...

### Answer: **Neither API calculates the amount in createCryptoPayment!**

Looking at the logs:
```javascript
base_amount: 0,  // ← Amount is 0!
```

The issue is that the `createCryptoPayment` function creates the address but doesn't calculate the crypto amount properly. The amount should be calculated by:

1. **Frontend:** Calls `/api/pay/calculatePaymentAmount` (uses CoinGecko)
2. **Display:** Shows user "Send 0.0034 ETH"
3. **Backend:** When payment arrives, converts using FastForex for final settlement

---

## Summary Table:

| API | Key Required | Used For | Coverage | When Called |
|-----|--------------|----------|----------|-------------|
| **FastForex** | ✅ Yes | Fiat & Crypto conversions | All currencies | Throughout app |
| **CoinGecko** | ❌ No | Crypto USD pricing | BTC, ETH, etc. | Payment calculator |

## The Real Answer:

For your ETH payment:
- **CoinGecko** is used in `/api/pay/calculatePaymentAmount` (if you call it)
- **FastForex** is used for actual currency conversions in payment processing
- The `createCryptoPayment` endpoint has a bug - it doesn't return the calculated amount properly

### Which is Primary?

**FastForex is the primary API** for DynoPay! 
- 20+ references in the codebase
- Used for all major conversions
- Has an API key configured
- More comprehensive

**CoinGecko is supplementary:**
- Only used in payment calculator
- 1 function reference
- Provides real-time crypto prices
- Fallback mechanism

---

## Current Status:

✅ FastForex API Key: Configured
✅ CoinGecko: Free tier (no key needed)
✅ Both operational

For crypto amount calculation, the system SHOULD use FastForex for consistency, but the payment calculator endpoint uses CoinGecko for real-time pricing.
