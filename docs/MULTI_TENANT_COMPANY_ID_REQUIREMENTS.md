# Multi-Tenant Architecture: company_id Requirements Analysis

**Date:** February 2, 2026

---

## Summary

Analyzed all API endpoints and swagger documentation to ensure `company_id` is properly required for multi-tenant data isolation.

---

## Changes Made

### 1. `/app/backend/swagger/paths/payment.ts` - createPaymentLink Examples

**Problem:** Examples showed requests without `company_id` even though it's a required field.

**Fixed Examples:**
| Example | Before | After |
|---------|--------|-------|
| Minimal Required | `{ amount: 10.00 }` | `{ amount: 10.00, company_id: 1 }` |
| With Customer Email | Missing company_id | Added `company_id: 1` |
| Standard Payment | Missing company_id | Added `company_id: 1` |
| With Tax Enabled | Missing company_id | Added `company_id: 1` |
| Customer Pays Fees | Missing company_id | Added `company_id: 1` |
| With Expiration | Missing company_id | Added `company_id: 1` |
| Crypto Only Payment | Missing company_id | Added `company_id: 1` |

**Note:** Removed misleading "SIMPLEST: Only amount required" example that suggested company_id was optional.

### 2. `/app/backend/swagger/paths/subscription.ts` - Create Subscription

**Problem:** `company_id` was described as required in the field description but NOT in the `required` array.

**Fixed:**
```typescript
// Before
required: ['customer_email', 'amount', 'currency', 'interval']

// After
required: ['customer_email', 'amount', 'currency', 'interval', 'company_id']
```

Also added examples that include `company_id`:
- Monthly Subscription example
- Annual Subscription example

---

## Endpoints Where company_id IS Required

These endpoints handle multi-tenant data and MUST have company_id:

| Endpoint | Required | Validation |
|----------|----------|------------|
| `POST /api/pay/createPaymentLink` | ✅ Required | Backend validates ownership |
| `POST /api/wallet/validateWalletAddress` | ✅ Required | In required array |
| `POST /api/wallet/verifyOtp` | ✅ Required | In required array |
| `POST /api/userApi/addApi` | ✅ Required | In required array |
| `POST /api/subscriptions` | ✅ Required (FIXED) | Now in required array |

---

## Endpoints Where company_id is Optional Filter

These endpoints allow filtering by company but return data for all user's companies if omitted:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/pay/getPaymentLinks` | Filter payment links by company |
| `GET /api/wallet/getWallet` | Filter wallets by company |
| `GET /api/subscriptions` | Filter subscriptions by company |
| `GET /api/notifications` | Filter notifications by company |
| `GET /api/userApi/getApis` | Filter API keys by company |

---

## Endpoints Where company_id is Not Needed

These endpoints operate at user level or system level:

| Category | Endpoints |
|----------|-----------|
| **Authentication** | `/api/auth/login`, `/api/auth/register`, `/api/auth/forgotPassword` |
| **User Profile** | `/api/user/profile`, `/api/user/2fa` |
| **System Status** | `/api/status`, `/api/status/health`, `/api/status/services` |
| **Company Management** | `/api/company/createCompany`, `/api/company/getCompany` |
| **KYC** | `/api/kyc/submit`, `/api/kyc/status` |
| **Direct API** | Uses API key authentication (company implicit) |

---

## Backend Validation

The backend (`paymentController.ts`) correctly validates company_id:

```typescript
// Line 4177-4198
// company_id is REQUIRED - validate it exists
if (!company_id) {
  return res.status(400).json({
    message: "company_id is required. Please specify which company this payment link belongs to.",
    error: "COMPANY_ID_REQUIRED"
  });
}

// Verify the company belongs to this user
const userCompany = await companyModel.findOne({
  where: { 
    company_id: company_id,
    user_id: userData.user_id 
  }
});

if (!userCompany) {
  return res.status(400).json({
    message: "Invalid company_id. The specified company does not exist or does not belong to you.",
    error: "INVALID_COMPANY_ID"
  });
}
```

---

## How to Get Your company_id

Users should call `GET /api/company/getCompany` to retrieve their company IDs:

```bash
curl -X GET "https://api.dynopay.com/api/company/getCompany" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "message": "Companies retrieved",
  "data": [
    {
      "company_id": 1,
      "company_name": "My Company",
      "is_default": true
    },
    {
      "company_id": 2,
      "company_name": "Second Company",
      "is_default": false
    }
  ]
}
```

---

## Testing Checklist

- [x] `POST /api/pay/createPaymentLink` - Returns 400 if company_id missing
- [x] `POST /api/subscriptions` - Now requires company_id in schema
- [x] All swagger examples include company_id where required
- [x] Backend validates company ownership before creating resources

---

## Files Modified

1. `/app/backend/swagger/paths/payment.ts` - Fixed all createPaymentLink examples
2. `/app/backend/swagger/paths/subscription.ts` - Added company_id to required array + examples
