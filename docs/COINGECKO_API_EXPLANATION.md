# ETH to USD Conversion - API Used

## Answer: **CoinGecko API** 🦎

### API Details:

**Endpoint:**
```
https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd
```

**Implementation Location:**
```typescript
File: /app/backend/controller/paymentController.ts
Function: getCryptoPriceForPayment() (Lines 3731-3765)
```

### How It Works:

```typescript
const getCryptoPriceForPayment = async (symbol: string): Promise<number> => {
  try {
    // Map crypto symbols to CoinGecko IDs
    const idMap: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'LTC': 'litecoin',
      'DOGE': 'dogecoin',
      'TRX': 'tron',
      'USDT': 'tether',
      'USDT_ERC20': 'tether',
      'USDT_TRC20': 'tether',
      'BCH': 'bitcoin-cash',
    };

    const coinId = idMap[symbol.toUpperCase()] || symbol.toLowerCase();
    
    // Call CoinGecko API
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    
    return response.data[coinId]?.usd || 0;
    
  } catch (error) {
    // Fallback prices if CoinGecko API fails
    const fallbackPrices: Record<string, number> = {
      'BTC': 95000,
      'ETH': 3300,
      'LTC': 100,
      'DOGE': 0.35,
      'TRX': 0.25,
      'USDT': 1,
      'USDT_ERC20': 1,
      'USDT_TRC20': 1,
      'BCH': 450,
    };
    return fallbackPrices[symbol.toUpperCase()] || 0;
  }
};
```

### When Is It Called?

**1. Payment Amount Calculation API:**
```
POST /api/pay/calculatePaymentAmount
Body: { amount_usd: "10", chain: "ETH", fee_payer: "customer" }
```

Used by frontend to show exact crypto amount before payment.

**2. During Payment Processing:**
Called internally when processing crypto payments to convert USD amounts to crypto.

### Example for ETH Payment ($10):

**API Call:**
```bash
curl "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
```

**Response:**
```json
{
  "ethereum": {
    "usd": 2940.54
  }
}
```

**Calculation:**
```
Amount in USD: $10
ETH Price: $2,940.54
Amount in ETH: 10 / 2940.54 = 0.0034 ETH
```

### Supported Cryptocurrencies:

| Symbol | CoinGecko ID | Example Price |
|--------|--------------|---------------|
| BTC | bitcoin | $95,000 |
| ETH | ethereum | $2,940 |
| LTC | litecoin | $100 |
| DOGE | dogecoin | $0.35 |
| TRX | tron | $0.25 |
| USDT | tether | $1.00 |
| BCH | bitcoin-cash | $450 |

### Fallback Mechanism:

If CoinGecko API fails (network issue, rate limit, etc.), the system uses **hardcoded fallback prices**:

```typescript
fallbackPrices = {
  'BTC': 95000,
  'ETH': 3300,   // ← Fallback ETH price
  'LTC': 100,
  'DOGE': 0.35,
  'TRX': 0.25,
  'USDT': 1,
  'BCH': 450,
}
```

### Why CoinGecko?

**Advantages:**
- ✅ Free API (no key required for basic usage)
- ✅ Reliable and widely used
- ✅ Real-time price data
- ✅ Supports all major cryptocurrencies
- ✅ Simple REST API
- ✅ Good uptime

**Limitations:**
- ⚠️ Rate limited (50 calls/minute on free tier)
- ⚠️ No historical data in this simple endpoint
- ⚠️ Requires internet connection

### Alternative APIs (Not Currently Used):

1. **Tatum Rate API:** `GET /v3/tatum/rate` (could be used, more integrated)
2. **CoinMarketCap:** More features, requires API key
3. **Binance API:** Good for exchange rates
4. **CryptoCompare:** Popular alternative

### Rate Refresh:

The system calls CoinGecko API **on every payment calculation**, ensuring real-time pricing:
- When customer creates payment
- When calculating payment amounts
- When displaying conversion rates

No caching is implemented, so rates are always current (but subject to API rate limits).

---

## Summary:

**API Used:** CoinGecko Public API
**Endpoint:** `https://api.coingecko.com/api/v3/simple/price`
**Cost:** Free (no API key needed)
**Update Frequency:** Real-time (called on every payment)
**Fallback:** Hardcoded prices if API fails
**For Your ETH Payment:** Used CoinGecko to get $2,940.54/ETH rate
