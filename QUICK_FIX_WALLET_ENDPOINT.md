# 🚀 Quick Fix: "No wallet addresses found" Error

## Problem
You're seeing this error even though you have wallet addresses configured:
```
"No wallet addresses found. Add your first wallet address to start receiving payments."
```

## Root Cause
**Frontend is calling the wrong endpoint!**

❌ Currently using: `/api/wallet/getWalletAddresses`
✅ Should use: `/api/wallet/getWallet`

## Solution

### Option 1: Update Frontend Code

**Before:**
```javascript
fetch(`${API_URL}/wallet/getWalletAddresses?company_id=${companyId}`)
```

**After:**
```javascript
fetch(`${API_URL}/wallet/getWallet?company_id=${companyId}`)
```

### Option 2: Test with curl

```bash
# ❌ Wrong endpoint (returns empty)
curl -X GET "https://setup-app.preview.emergentagent.com/api/wallet/getWalletAddresses?company_id=38" \
  -H "Authorization: Bearer YOUR_TOKEN"

# ✅ Correct endpoint (returns your wallets)
curl -X GET "https://setup-app.preview.emergentagent.com/api/wallet/getWallet?company_id=38" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Why Two Endpoints?

| Endpoint | Table | Status |
|----------|-------|--------|
| `/getWallet` | `tbl_user_wallet` | ✅ Main system |
| `/getWalletAddresses` | `tbl_user_wallet_address` | ⚠️ Legacy |

Your wallets (added via OTP verification) are in `tbl_user_wallet`, so you must use `/getWallet`.

## Verification

After switching to `/getWallet`, you should see:
```json
{
  "message": "Successfully retrieved 2 wallet",
  "data": [
    {
      "wallet_type": "ETH",
      "wallet_address": "0x9a7221b5e32d5f99e8da95585835442e29afb38f",
      "company_id": 38
    },
    {
      "wallet_type": "BTC", 
      "wallet_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
      "company_id": 38
    }
  ]
}
```

## Full Documentation
See `/app/WALLET_API_ENDPOINTS_GUIDE.md` for complete details.
