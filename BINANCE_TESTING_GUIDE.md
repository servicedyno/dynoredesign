# Binance Integration Testing Guide
**Testing Binance API with Proxy Configuration**

---

## 🌐 Problem: Binance API Blocked in US

Binance's API (`api.binance.com`) is geo-restricted and blocks US-based IP addresses. This prevents testing the auto-stablecoin conversion feature from US servers.

**Solution:** Route Binance API calls through a proxy server located in a non-restricted region.

---

## ✅ Proxy Support Added

I've modified `/app/backend/services/binanceService.ts` to support proxy configuration:

- Uses `https-proxy-agent` for proxy support
- Configurable via `BINANCE_PROXY_URL` environment variable
- Automatically routes all Binance API calls through proxy when configured
- Backward compatible (works without proxy if not configured)

---

## 🔧 Setup Options

### Option 1: Use a Public Proxy (Quick Test)

**Free proxy services** (use with caution, not for production):
```bash
# Add to /app/backend/.env
BINANCE_PROXY_URL=http://proxy-server:port

# Examples (find current working proxies):
BINANCE_PROXY_URL=http://51.159.115.233:3128
BINANCE_PROXY_URL=http://47.88.3.19:8080
```

⚠️ **Warning:** Public proxies are:
- Unreliable (may go down)
- Slow
- Not secure for production
- Good for testing only

**Find current working proxies:**
- https://www.proxy-list.download/HTTPS
- https://free-proxy-list.net/
- https://www.us-proxy.org/

---

### Option 2: Use Proxy Service (Recommended)

**Paid proxy services** (reliable, secure):

#### A. Bright Data (formerly Luminati)
```bash
BINANCE_PROXY_URL=http://username:password@zproxy.lum-superproxy.io:22225
```
- Cost: ~$500/month
- Reliable residential proxies
- Good for production

#### B. SmartProxy
```bash
BINANCE_PROXY_URL=http://username:password@gate.smartproxy.com:7000
```
- Cost: ~$75/month
- Good balance of price/quality

#### C. Oxylabs
```bash
BINANCE_PROXY_URL=http://username:password@pr.oxylabs.io:7777
```
- Enterprise grade
- Cost: Custom pricing

---

### Option 3: Deploy to Non-US Server (Best)

Deploy your application to a server outside the US:

**Recommended Regions:**
- Europe (Amsterdam, Frankfurt, London)
- Asia (Singapore, Tokyo, Hong Kong)
- Canada (Toronto)

**Cloud Providers:**
- **Railway:** Deploy to EU region
- **AWS:** Use eu-west-1 (Ireland)
- **DigitalOcean:** Use Amsterdam datacenter
- **Heroku:** Use European dyno

---

## 🧪 Testing Steps

### Step 1: Configure Proxy

Add proxy URL to `.env`:
```bash
# /app/backend/.env
BINANCE_PROXY_URL=http://your-proxy:port

# Also ensure you have Binance API credentials:
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_secret_key
```

### Step 2: Restart Backend

```bash
sudo supervisorctl restart backend
```

Check logs to confirm proxy is being used:
```bash
tail -f /var/log/supervisor/backend.out.log | grep Binance
```

You should see:
```
[Binance] Using proxy: http://your-proxy:port
```

### Step 3: Test Connectivity

Create a test script to verify Binance connection:

```bash
curl -X POST http://localhost:8001/diagnostics/test-binance \
  -H "Content-Type: application/json"
```

Expected response:
```json
{
  "success": true,
  "connectivity": "OK",
  "serverTime": 1707739200000,
  "proxyUsed": true
}
```

---

## 🧪 Testing Auto-Stablecoin Conversion

### Prerequisites

1. **Binance Account Setup:**
   - Create Binance account (not Binance.US)
   - Enable API access
   - Generate API key with "Enable Trading" permission
   - Whitelist your server IP (or use universal API key)

2. **Fund Binance Account:**
   - Deposit some crypto (BTC, ETH, etc.) for conversion testing
   - Minimum: $50 equivalent for testing

3. **Configure Company:**
   ```bash
   curl -X PUT http://localhost:8001/api/company/auto-convert/1 \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "auto_convert_enabled": true,
       "settlement_currency": "USDT",
       "settlement_wallet_address": "YOUR_USDT_WALLET",
       "settlement_chain": "ERC20"
     }'
   ```

---

### Test Case 1: Check Binance Connectivity

**Endpoint:** `GET /diagnostics/conversion-stats`

```bash
curl http://localhost:8001/diagnostics/conversion-stats \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "pendingConversions": 0,
  "completedToday": 0,
  "binanceConnected": true
}
```

---

### Test Case 2: Manual Conversion Trigger

**Endpoint:** `POST /diagnostics/trigger-conversion`

```bash
curl -X POST http://localhost:8001/diagnostics/trigger-conversion \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "conversionsProcessed": 0,
  "conversionsSucceeded": 0,
  "conversionsFailed": 0
}
```

---

### Test Case 3: Full Conversion Flow

**Step 1: Create a crypto payment with auto-convert enabled**

```bash
curl -X POST http://localhost:8001/api/user/cryptoPayment \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "currency": "USD",
    "crypto": "BTC",
    "description": "Test conversion payment"
  }'
```

**Step 2: Send crypto to the address provided**

Send BTC to the address from response. Wait for confirmation.

**Step 3: Monitor conversion status**

```bash
curl http://localhost:8001/api/company/conversion-history/1 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "conversions": [
    {
      "conversion_id": "abc123",
      "status": "PENDING_DEPOSIT",
      "from_currency": "BTC",
      "to_currency": "USDT",
      "amount_received": "0.0002",
      "created_at": "2026-02-12T..."
    }
  ]
}
```

**Step 4: Wait for conversion cron (runs every 5 minutes)**

Or manually trigger:
```bash
curl -X POST http://localhost:8001/diagnostics/trigger-conversion \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN"
```

**Step 5: Check final status**

Status should progress through:
1. `PENDING_DEPOSIT` → Waiting for funds to reach Binance
2. `DEPOSIT_CREDITED` → Funds confirmed on Binance
3. `CONVERTING` → Converting to stablecoin
4. `CONVERTED` → Conversion complete
5. `WITHDRAWING` → Sending to merchant wallet
6. `COMPLETED` → Done!

---

## 📊 Monitoring Conversion Process

### Check Conversion Logs

```bash
tail -f /var/log/supervisor/backend.out.log | grep -E "(Conversion|Binance)"
```

**Successful conversion log:**
```
[Conversion] Processing conversion abc123: BTC → USDT
[Binance] Detected deposit: 0.0002 BTC
[Binance] Getting quote: BTC → USDT
[Binance] Quote received: 0.0002 BTC = 8.45 USDT
[Binance] Accepting quote: quoteId xyz789
[Binance] Conversion successful: 8.45 USDT
[Binance] Initiating withdrawal to 0x...
[Conversion] Status updated: COMPLETED
```

---

## 🐛 Troubleshooting

### Issue 1: "ETIMEDOUT" or "ECONNREFUSED"

**Problem:** Proxy not reachable

**Solution:**
```bash
# Test proxy manually
curl -x http://your-proxy:port https://api.binance.com/api/v3/time

# If this fails, proxy is down. Try another proxy.
```

---

### Issue 2: "Binance API error [418]"

**Problem:** IP banned by Binance (too many requests)

**Solution:**
- Wait 2 hours
- Use different proxy IP
- Reduce request frequency

---

### Issue 3: "Binance API error [-2015]: Invalid API-key"

**Problem:** API key incorrect or restricted

**Solution:**
- Verify `BINANCE_API_KEY` in .env
- Check API key has "Enable Trading" permission
- Ensure API key is from binance.com (not binance.us)

---

### Issue 4: "Proxy authentication required"

**Problem:** Proxy needs username/password

**Solution:**
```bash
# Format: http://username:password@proxy:port
BINANCE_PROXY_URL=http://myuser:mypass@proxy-server:3128
```

---

### Issue 5: Conversion stuck in "PENDING_DEPOSIT"

**Problem:** Funds not reaching Binance deposit address

**Solution:**
- Verify correct deposit address used
- Check blockchain explorer for transaction
- Wait for required confirmations (BTC: 2, ETH: 12)
- Check Binance deposit history

---

## 🔒 Security Considerations

### For Testing (OK):
✅ Use free public proxies  
✅ Test with small amounts  
✅ Use testnet when possible  

### For Production (DO NOT):
❌ Use free public proxies (not secure)  
❌ Use proxies without SSL/TLS  
❌ Send Binance API keys over unencrypted proxies  

### For Production (DO):
✅ Deploy to non-US region (best option)  
✅ Use paid proxy service with authentication  
✅ Use HTTPS proxies only  
✅ Monitor proxy uptime (>99.9%)  
✅ Have backup proxy configured  

---

## 📝 Proxy Configuration Examples

### Example 1: No Auth Proxy
```bash
BINANCE_PROXY_URL=http://proxy.example.com:8080
```

### Example 2: Auth Proxy
```bash
BINANCE_PROXY_URL=http://username:password@proxy.example.com:8080
```

### Example 3: SOCKS5 Proxy (requires socks-proxy-agent)
```bash
BINANCE_PROXY_URL=socks5://username:password@proxy.example.com:1080
```

### Example 4: No Proxy (Disable)
```bash
# Comment out or remove:
# BINANCE_PROXY_URL=
```

---

## 🧪 Test Script

Create `/app/backend/scripts/test-binance-proxy.ts`:

```typescript
import * as binanceService from '../services/binanceService';

async function testBinanceConnection() {
  console.log('🧪 Testing Binance API connection...\n');
  
  try {
    // Test 1: Server time (public endpoint, no auth)
    console.log('Test 1: Public endpoint (server time)');
    const serverTime = await binanceService.getServerTime();
    console.log('✅ Success! Server time:', new Date(serverTime));
    
    // Test 2: Account info (requires API key)
    console.log('\nTest 2: Account info (requires API key)');
    const accountInfo = await binanceService.getAccountInfo();
    console.log('✅ Success! Account balances:', accountInfo.balances?.length || 0);
    
    // Test 3: Convert quote
    console.log('\nTest 3: Get conversion quote (BTC → USDT)');
    const quote = await binanceService.getConvertQuote('BTC', 'USDT', 0.001);
    console.log('✅ Success! Quote:', quote);
    
    console.log('\n🎉 All tests passed! Binance integration working.');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

testBinanceConnection();
```

**Run the test:**
```bash
cd /app/backend
npx ts-node scripts/test-binance-proxy.ts
```

---

## 📊 Expected Results

### Without Proxy (US Server):
```
❌ Test 1: ETIMEDOUT
Error: connect ETIMEDOUT 104.18.12.11:443
```

### With Working Proxy:
```
✅ Test 1: Success! Server time: 2026-02-12T12:00:00.000Z
✅ Test 2: Success! Account balances: 15
✅ Test 3: Success! Quote: { ... }
🎉 All tests passed!
```

---

## 🚀 Recommended Approach

### For Development/Testing:
1. Use free proxy for initial testing
2. Test basic connectivity first
3. Test with small amounts
4. Monitor logs carefully

### For Staging:
1. Use paid proxy service (SmartProxy, etc.)
2. Full end-to-end testing
3. Load testing with proxy
4. Monitor proxy performance

### For Production:
1. **Best:** Deploy to non-US region (no proxy needed)
2. **Alternative:** Enterprise proxy (Bright Data, Oxylabs)
3. Set up monitoring and alerting
4. Configure failover proxies

---

## 📞 Need Help?

### Free Proxy Not Working?
- Try multiple proxies from list
- Check proxy is HTTPS compatible
- Verify proxy supports CONNECT method

### Paid Proxy Setup?
- Contact proxy provider for configuration
- Ask for API-specific proxy setup
- Request residential IP pool

### Deploy to Non-US Region?
- **Railway:** Change region in project settings
- **AWS:** Create new deployment in eu-west-1
- **DigitalOcean:** Create droplet in AMS3

---

## ✅ Quick Start Checklist

- [ ] Add `BINANCE_PROXY_URL` to `.env`
- [ ] Add `BINANCE_API_KEY` to `.env`
- [ ] Add `BINANCE_API_SECRET` to `.env`
- [ ] Restart backend: `sudo supervisorctl restart backend`
- [ ] Check logs: `tail -f /var/log/supervisor/backend.out.log | grep Binance`
- [ ] Run test: `npx ts-node scripts/test-binance-proxy.ts`
- [ ] Test conversion flow end-to-end
- [ ] Monitor conversion status in logs

---

**Your Binance integration is ready to test with proxy support! 🚀**

*For production, deploy to non-US region for best performance.*

---

*END OF GUIDE*
