# 🔐 Quick Credential Setup Guide

## Where to Add Your API Keys

Edit `/app/backend/.env` and add your credentials:

### 📊 Tax Data API (APILayer)
**What it's for**: VAT/tax rate validation and lookup  
**Required**: Optional (has fallback rates)

1. Go to https://apilayer.com/
2. Sign up for free account
3. Subscribe to "Tax Data API"
4. Copy your API key
5. Add to `.env`:
```env
TAX_DATA_API_KEY=your_key_here
```

**Test it works**:
```bash
curl http://localhost:8001/api/tax/rate/PT \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
# Should return Portugal VAT rate (23%)
```

---

### 🆔 Veriff Identity Verification
**What it's for**: KYC (Know Your Customer) verification  
**Required**: Only if you need identity verification

1. Go to https://www.veriff.com/
2. Sign up for account
3. Go to Dashboard → Integrations → API Keys
4. Copy API Key and API Secret
5. Add to `.env`:
```env
VERIFF_API_KEY=your_api_key_here
VERIFF_API_SECRET=your_api_secret_here
```

**Test it works**:
```bash
curl http://localhost:8001/api/kyc/start \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"company_id": 1}'
# Should return Veriff session URL
```

---

## Already Configured ✅

These are already in your `.env` file:

✅ Database credentials  
✅ Redis URL  
✅ Brevo (email)  
✅ Tatum (blockchain)  
✅ Flutterwave (payments)  
✅ Google Cloud KMS  
✅ All other services  

---

## What Happens Without These Keys?

### Without TAX_DATA_API_KEY:
- ✅ App works normally
- ℹ️ Uses fallback tax rates (23% for Portugal, 19% for Germany, etc.)
- ℹ️ VAT validation returns "rate_limited" status
- 📝 Tax rates may be outdated

### Without VERIFF credentials:
- ✅ App works normally
- ❌ KYC endpoints return error: "Veriff API credentials not configured"
- ℹ️ Users cannot complete identity verification
- 📝 Only affects KYC features

---

## Quick Check

Verify your credentials are loaded:

```bash
cd /app/backend

# Check Tax API
node -e "require('dotenv').config(); console.log('Tax API:', process.env.TAX_DATA_API_KEY ? '✅ Configured' : '⭕ Not set (using fallback)')"

# Check Veriff
node -e "require('dotenv').config(); console.log('Veriff:', (process.env.VERIFF_API_KEY && process.env.VERIFF_API_SECRET) ? '✅ Configured' : '⭕ Not set (KYC disabled)')"
```

---

## Need Help?

📚 **Full Guide**: See `/app/backend/ENV_VARIABLES_GUIDE.md`  
🔍 **Security Audit**: See `/app/SECURITY_AUDIT.md`  
📋 **Template**: See `/app/backend/.env.example`

---

## Summary

✅ **Your code is secure** - no hardcoded credentials found  
📝 **Action needed**: Fill in these 3 empty variables in `.env`:
- `TAX_DATA_API_KEY` (optional)
- `VERIFF_API_KEY` (optional)
- `VERIFF_API_SECRET` (optional)

🎯 **Priority**: Both are optional. Add them only if you need:
- Live tax rate updates (Tax API)
- Identity verification (Veriff KYC)

Otherwise, the app works perfectly with fallback mechanisms! 🚀
