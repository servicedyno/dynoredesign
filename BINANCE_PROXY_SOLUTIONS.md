# Binance Testing - Proxy Solutions
**Tested on 2026-02-12**

---

## ❌ Current Situation

**Direct Connection Test Result:**
```json
{
  "code": 0,
  "msg": "Service unavailable from a restricted location according to 'b. Eligibility' 
         in https://www.binance.com/en/terms. Please contact customer service if you 
         believe you received this message in error."
}
```

**Confirmation:** ✅ Binance API is blocking US-based IP addresses (as expected)

**Free Proxy Test Result:**
- Tested 14 free proxies
- Result: ❌ All proxies are offline or not working
- Conclusion: Free proxies are too unreliable for testing

---

## ✅ Recommended Solutions

### Option 1: Paid Proxy Services (Best for Testing)

#### SmartProxy - $28 for 2GB (Recommended)
**Best for: Short-term testing**

**Setup:**
```bash
# 1. Sign up: https://smartproxy.com/pricing
# 2. Choose "Residential Proxies" - $28 starter plan
# 3. Get credentials from dashboard
# 4. Add to .env:

BINANCE_PROXY_URL=http://USERNAME:PASSWORD@gate.smartproxy.com:7000
```

**Pros:**
- ✅ Pay as you go ($28 for 2GB = ~200 API calls)
- ✅ Working immediately
- ✅ Residential IPs (less likely to be blocked)
- ✅ 195+ countries available

**Test after setup:**
```bash
sudo supervisorctl restart backend
cd /app/backend && npx ts-node scripts/test-binance-proxy.ts
```

---

#### Bright Data (formerly Luminati) - $10 trial
**Best for: Serious testing**

**Setup:**
```bash
# 1. Sign up: https://brightdata.com/
# 2. Get $10 trial credit (no credit card required)
# 3. Add to .env:

BINANCE_PROXY_URL=http://USERNAME:PASSWORD@zproxy.lum-superproxy.io:22225
```

**Pros:**
- ✅ $10 free trial
- ✅ Enterprise-grade
- ✅ Very reliable
- ✅ Used by Fortune 500 companies

---

#### WebShare.io - $2.99 for 10 proxies/month
**Best for: Budget testing**

**Setup:**
```bash
# 1. Sign up: https://www.webshare.io/
# 2. Choose 10 proxies for $2.99/month
# 3. Download proxy list
# 4. Add to .env:

BINANCE_PROXY_URL=http://username:password@proxy-server:port
```

**Pros:**
- ✅ Very cheap ($0.30 per proxy)
- ✅ Datacenter proxies (fast)
- ✅ Good uptime

---

### Option 2: SSH Tunnel (Free with Your Own Server)

If you have a server outside US (AWS, DigitalOcean, etc.):

**Setup:**
```bash
# On your local machine / development server:
ssh -D 8080 -N user@your-non-us-server.com

# This creates SOCKS5 proxy on localhost:8080

# Then add to .env:
BINANCE_PROXY_URL=socks5://127.0.0.1:8080
```

**Note:** Requires `socks-proxy-agent` instead of `https-proxy-agent`

---

### Option 3: Deploy to Non-US Region (Best for Production)

#### Railway (Easiest)
```bash
# 1. Go to Railway dashboard
# 2. Click your project → Settings
# 3. Change "Region" to:
#    - Europe (eu-west-1)
#    - Asia (ap-southeast-1)
# 4. Click "Deploy"
# 5. Remove BINANCE_PROXY_URL from .env
```

**Cost:** Same as current ($5-20/month based on usage)

---

#### AWS EC2
```bash
# Launch new EC2 instance in:
# - Ireland (eu-west-1)
# - Singapore (ap-southeast-1)
# - Tokyo (ap-northeast-1)

# Deploy your app there
# No proxy needed!
```

---

#### DigitalOcean
```bash
# Create droplet in:
# - Amsterdam (ams3)
# - Singapore (sgp1)
# - Frankfurt (fra1)

# Deploy app
# No proxy needed!
```

---

## 🧪 Quick Test Guide

### After Adding Proxy:

**Step 1: Update .env**
```bash
nano /app/backend/.env

# Add line:
BINANCE_PROXY_URL=http://your-proxy:port
```

**Step 2: Restart**
```bash
sudo supervisorctl restart backend
```

**Step 3: Check logs**
```bash
tail -f /var/log/supervisor/backend.out.log | grep Binance
# Should see: [Binance] Using proxy: http://your-proxy:port
```

**Step 4: Run test script**
```bash
cd /app/backend
npx ts-node scripts/test-binance-proxy.ts
```

**Expected output:**
```
🧪 Testing Binance API Connection
🌐 Using proxy: http://your-proxy:port
Test 1: Server Time (public endpoint)
✅ SUCCESS - Server time: 2026-02-12T12:00:00.000Z

Test 2: Ping (connectivity check)
✅ SUCCESS - Ping successful

Test 3: Exchange Info (public endpoint)
✅ SUCCESS - Exchange info retrieved
   Trading pairs available: 2431

Test 4: Account Info (requires authentication)
✅ SUCCESS - Account info retrieved
   Account type: SPOT
   Balance entries: 15

Test 5: Convert Quote (BTC → USDT)
✅ SUCCESS - Quote received
   From: 0.001 BTC
   To: 42.35 USDT
   Quote ID: abc123xyz

🎉 All tests passed! Binance integration is working correctly.
```

---

## 💰 Cost Comparison

| Solution | Cost | Setup Time | Best For |
|----------|------|------------|----------|
| **SmartProxy** | $28 (2GB) | 5 min | Quick testing |
| **Bright Data** | $10 trial | 10 min | Thorough testing |
| **WebShare** | $3/month | 5 min | Budget testing |
| **SSH Tunnel** | Free* | 15 min | Have non-US server |
| **Deploy Non-US** | $5-20/month | 30 min | Production |

*Free if you already have a non-US server

---

## 🎯 My Recommendation

### For Your Situation:

**Short-term testing (today):**
→ **SmartProxy** ($28 for 2GB)
- Sign up in 5 minutes
- Working immediately
- Enough credits for comprehensive testing

**Long-term (production):**
→ **Deploy to non-US region**
- No proxy needed
- Better performance
- No monthly proxy fees
- More reliable

---

## 📝 Proxies to Whitelist (For Paid Services)

Once you choose a paid proxy service, you may need to whitelist IPs:

**Your Current Server IP:**
```bash
# Get your server's public IP:
curl -s ifconfig.me
```

**Binance API Endpoints to Whitelist:**
```
api.binance.com
sapi.binance.com
```

Most proxy services don't require whitelisting - they work immediately.

---

## 🆘 If You Need Testing NOW

**Quick temporary solution:**

1. **Use Bright Data's $10 trial:**
   - Go to https://brightdata.com/
   - Sign up (no credit card for trial)
   - Get proxy credentials instantly
   - Add to .env as shown above
   - Test within 5 minutes

2. **Or deploy to non-US Railway:**
   - Go to Railway dashboard
   - Change region to Europe
   - Redeploy (takes 10 minutes)
   - Test immediately, no proxy needed

---

## 📞 Need Help Setting Up?

**SmartProxy Setup:**
1. Visit https://smartproxy.com/pricing
2. Click "Residential Proxies"
3. Choose "$28 - 2GB" plan
4. Complete signup
5. Dashboard → Proxy Setup → Get credentials
6. Add to .env: `BINANCE_PROXY_URL=http://user:pass@gate.smartproxy.com:7000`

**Bright Data Setup:**
1. Visit https://brightdata.com/
2. Click "Start Free Trial"
3. Choose "Residential Proxies"
4. Dashboard → Access Parameters
5. Copy proxy credentials
6. Add to .env: `BINANCE_PROXY_URL=http://user:pass@zproxy.lum-superproxy.io:22225`

---

## ✅ Credentials Already Configured

Your Binance API credentials are set:
```
BINANCE_API_KEY=Ue0UNcTaS7Sydd3H4TDPcR6S3kO9o6hnLqiIAh6v2HlU4Zj6PNPaTSTCLdqE2K2T
BINANCE_API_SECRET=h5fd... (configured)
```

**You only need to:**
1. Add working proxy
2. Restart backend
3. Run test script

---

## 🎬 Ready to Test?

Once you have a proxy:

```bash
# Add to .env
echo 'BINANCE_PROXY_URL=http://your-proxy:port' >> /app/backend/.env

# Restart
sudo supervisorctl restart backend

# Test
cd /app/backend && npx ts-node scripts/test-binance-proxy.ts
```

**That's it! 🚀**

---

*Document created: 2026-02-12*  
*Free proxies tested: 14 (all offline)*  
*Recommendation: SmartProxy $28 or deploy to non-US*
