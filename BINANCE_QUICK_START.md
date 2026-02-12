# Binance Proxy Testing - Quick Reference
**Fast setup for testing Binance integration with proxy**

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Add Proxy to Environment

```bash
# Edit backend .env file
nano /app/backend/.env

# Add this line (choose a working proxy from list below):
BINANCE_PROXY_URL=http://proxy-address:port

# Also ensure Binance credentials are set:
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
```

### Step 2: Restart Backend

```bash
sudo supervisorctl restart backend
```

### Step 3: Run Test Script

```bash
cd /app/backend
npx ts-node scripts/test-binance-proxy.ts
```

---

## 🌐 Free Proxy List (for testing only)

**Find current working proxies:** https://free-proxy-list.net/

**Example proxies (may change):**
```bash
# Example 1:
BINANCE_PROXY_URL=http://47.88.3.19:8080

# Example 2:
BINANCE_PROXY_URL=http://51.159.115.233:3128

# Example 3:
BINANCE_PROXY_URL=http://103.152.112.162:80
```

⚠️ **Note:** Free proxies are unreliable. Try multiple if one fails.

---

## ✅ Success Indicators

### In Logs:
```bash
tail -f /var/log/supervisor/backend.out.log | grep Binance
```

**You should see:**
```
[Binance] Using proxy: http://your-proxy:port
```

### In Test Script:
```
✅ SUCCESS - Server time: 2026-02-12T...
✅ SUCCESS - Ping successful
✅ SUCCESS - Exchange info retrieved
✅ SUCCESS - Account info retrieved
✅ SUCCESS - Quote received

🎉 All tests passed!
```

---

## ❌ Common Errors & Fixes

### Error: "ETIMEDOUT"
**Cause:** Proxy not responding  
**Fix:** Try different proxy from list

### Error: "ECONNREFUSED"
**Cause:** Proxy offline  
**Fix:** Use another proxy

### Error: "Binance API error [-2015]"
**Cause:** Invalid API key  
**Fix:** Check BINANCE_API_KEY in .env

### Error: "418 I'm a teapot"
**Cause:** IP banned by Binance  
**Fix:** Wait 2 hours or use different proxy

---

## 🧪 Manual Test (Without Script)

```bash
# Test 1: Check proxy works
curl -x http://your-proxy:port https://api.binance.com/api/v3/time

# Expected: {"serverTime":1707739200000}

# Test 2: Test from backend
curl http://localhost:8001/diagnostics/conversion-stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected: {"success": true, "binanceConnected": true}
```

---

## 📊 Test Full Conversion Flow

### 1. Enable auto-convert for company:
```bash
# Update in database or via API
UPDATE tbl_company 
SET auto_convert_enabled = true,
    settlement_currency = 'USDT'
WHERE company_id = 1;
```

### 2. Create payment with crypto:
```bash
curl -X POST http://localhost:8001/api/user/cryptoPayment \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{"amount": 10, "currency": "USD", "crypto": "BTC"}'
```

### 3. Send crypto to returned address

### 4. Wait for conversion cron (5 min) or trigger manually:
```bash
curl -X POST http://localhost:8001/diagnostics/trigger-conversion \
  -H "Authorization: Bearer ADMIN_JWT"
```

### 5. Check conversion status:
```bash
curl http://localhost:8001/api/company/conversion-history/1 \
  -H "Authorization: Bearer YOUR_JWT"
```

---

## 🔄 Paid Proxy Services (Reliable)

### SmartProxy (Recommended for testing)
```bash
# Cost: ~$75/month
# Setup: https://smartproxy.com/
BINANCE_PROXY_URL=http://username:password@gate.smartproxy.com:7000
```

### Bright Data (Enterprise)
```bash
# Cost: ~$500/month
# Setup: https://brightdata.com/
BINANCE_PROXY_URL=http://username:password@zproxy.lum-superproxy.io:22225
```

---

## 🌍 Alternative: Deploy to Non-US Region

### Railway (Easiest)
1. Go to Railway dashboard
2. Click project → Settings
3. Change region to "Europe" or "Asia"
4. Redeploy
5. Remove BINANCE_PROXY_URL from .env

### AWS / DigitalOcean
1. Create new server in Amsterdam, Frankfurt, or Singapore
2. Deploy app to new server
3. No proxy needed!

---

## 📝 Environment Variables Needed

```bash
# Required for basic testing:
BINANCE_PROXY_URL=http://proxy:port

# Required for authenticated endpoints:
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_secret_key

# Optional (defaults work fine):
BINANCE_BASE_URL=https://api.binance.com
BINANCE_CONVERT_INTERVAL_MINUTES=5
```

---

## 🎯 Testing Checklist

- [ ] Proxy added to .env
- [ ] Backend restarted
- [ ] Test script shows success for public endpoints
- [ ] API key configured (for authenticated tests)
- [ ] Test script shows success for all tests
- [ ] Logs show "Using proxy: ..."
- [ ] Ready to test conversion flow!

---

## 🆘 Still Having Issues?

1. **Check proxy is working:**
   ```bash
   curl -x $BINANCE_PROXY_URL https://api.binance.com/api/v3/time
   ```

2. **Try multiple proxies** - Free proxies go down frequently

3. **Use paid proxy** - Much more reliable

4. **Deploy to non-US** - Best long-term solution

5. **Check full guide:** `/app/BINANCE_TESTING_GUIDE.md`

---

## 📞 Quick Commands

```bash
# Check if proxy is configured
grep BINANCE_PROXY /app/backend/.env

# Restart backend
sudo supervisorctl restart backend

# View Binance-related logs
tail -f /var/log/supervisor/backend.out.log | grep Binance

# Run test script
cd /app/backend && npx ts-node scripts/test-binance-proxy.ts

# Manual API test
curl -x $BINANCE_PROXY_URL https://api.binance.com/api/v3/time
```

---

**You're ready to test Binance integration! 🚀**

*For production, deploy to non-US region for best results.*

---

*Quick Reference v1.0*
