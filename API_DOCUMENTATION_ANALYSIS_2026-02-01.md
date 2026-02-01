# DynoPay API Documentation Analysis Report
**Date:** 2026-02-01
**Analyst:** Agent Review

---

## Executive Summary

After analyzing the Swagger documentation (`/app/backend/swagger/paths/`) and comparing with actual controller implementations, the API documentation is **well-maintained and comprehensive**. However, there are some inconsistencies and recommendations for improvement.

---

## 1. Documentation Quality Assessment ✅

### Strengths:
- **Clear examples** with multiple scenarios (standard, minimal, with tax, etc.)
- **Good field descriptions** with emojis indicating REQUIRED vs OPTIONAL
- **Backward compatibility** documented (amount vs base_amount)
- **Webhook documentation** is excellent with all event types

### Areas for Improvement:
- Some response schemas don't match actual controller responses
- Missing some newer fields in documentation
- Update endpoint path inconsistencies

---

## 2. Field Analysis: Required vs Optional

### `/api/pay/createPaymentLink` - CREATE PAYMENT LINK

| Field | Swagger Says | Code Actually Requires | Recommendation |
|-------|--------------|----------------------|----------------|
| `company_id` | ✅ Required | ❌ Optional (defaults to first company) | **Make OPTIONAL** - code handles missing |
| `modes` | ✅ Required | ❌ Optional (defaults to ['CRYPTO']) | **Make OPTIONAL** - has default |
| `amount` | Required (one of) | ✅ Required | ✅ Correct |
| `currency` | Required (one of) | ❌ Defaults to 'USD' | **Make OPTIONAL** - has default |
| `email` | Optional | Optional | ✅ Correct |
| `description` | Optional | Optional | ✅ Correct |
| `expire` | Optional | Optional | ✅ Correct |
| `fee_payer` | Optional | Optional (default: 'company') | ✅ Correct |
| `apply_tax` | Optional | Optional (default: false) | ✅ Correct |
| `webhook_url` | Optional | Optional | ✅ Correct |
| `redirect_url` | Optional | Optional | ✅ Correct |
| `callback_url` | Optional | Optional | ✅ Correct |

**Recommendation:** Update Swagger to show:
- `company_id` as OPTIONAL (but recommended)
- `modes` as OPTIONAL with default ['CRYPTO']
- `currency` as OPTIONAL with default 'USD'

### `/api/company/addCompany` - CREATE COMPANY

| Field | Swagger Says | Code Actually Requires | Recommendation |
|-------|--------------|----------------------|----------------|
| `company_name` | ✅ Required | ✅ Required | ✅ Correct |
| `email` | ✅ Required | ✅ Required | ✅ Correct |
| `mobile` | Optional | Optional | ✅ Correct |
| `website` | Optional | Optional | ✅ Correct |
| `address_*` | Optional | Optional | ✅ Correct |
| `vat_number` | Optional | Optional | ✅ Correct |
| `image` | Optional | Optional | ✅ Correct |

**Status:** ✅ Documentation is accurate

### `/api/user/registerUser` - USER REGISTRATION

| Field | Swagger Says | Code Actually Requires | Recommendation |
|-------|--------------|----------------------|----------------|
| `name` | ✅ Required | ✅ Required | ✅ Correct |
| `email` | ✅ Required | ✅ Required | ✅ Correct |
| `password` | ✅ Required | ✅ Required | ✅ Correct |
| `referral_code` | Optional | Optional | ✅ Correct |

**Status:** ✅ Documentation is accurate

### `/api/userApi/addApi` - CREATE API KEY

| Field | Swagger Says | Code Actually Requires | Recommendation |
|-------|--------------|----------------------|----------------|
| `api_name` | ✅ Required | ✅ Required | ✅ Correct |
| `base_currency` | Optional | Optional (default: 'USD') | ✅ Correct |
| `webhook_url` | Optional | Optional | ✅ Correct |
| `withdrawal_whitelist` | Optional | Optional | ✅ Correct |
| `environment` | Not documented | Optional (default: 'development') | **ADD TO DOCS** |

---

## 3. Endpoint Path Inconsistencies

| Issue | Current | Should Be |
|-------|---------|-----------|
| Update payment link | `/api/pay/links/{id}` (PUT) | ✅ Correct |
| Delete payment link | `/api/pay/deletePaymentLink/{id}` | Consider `/api/pay/links/{id}` (DELETE) for consistency |

---

## 4. Missing Documentation

### Fields not documented but exist in code:

1. **`/api/pay/createPaymentLink`**
   - `tax_percentage` - Fixed tax rate option
   - `tax_name` - Custom tax label
   - `name` - Customer name

2. **`/api/userApi/addApi`**
   - `environment` - 'development' or 'production'
   - `permissions` - Array of permissions

3. **`/api/pay/links/{id}` (PUT)**
   - `base_amount` - Update amount
   - `base_currency` - Update currency
   - `allowedModes` - Update payment modes

---

## 5. Recommended Changes

### 5.1 Update `/api/pay/createPaymentLink` Schema

```javascript
required: ['amount'], // OR base_amount - only amount is truly required
properties: {
  company_id: {
    description: '📝 OPTIONAL: Company ID (defaults to user\'s first company)',
    // Remove from required array
  },
  modes: {
    description: '📝 OPTIONAL: Payment modes (defaults to ["CRYPTO"])',
    default: ['CRYPTO']
    // Remove from required array
  },
  currency: {
    description: '📝 OPTIONAL: Currency code (defaults to "USD")',
    default: 'USD'
  }
}
```

### 5.2 Add Missing Fields to Documentation

```javascript
// Add to createPaymentLink
tax_percentage: {
  type: 'number',
  description: '📝 OPTIONAL: Fixed tax percentage (alternative to apply_tax)',
  example: 10
},
tax_name: {
  type: 'string',
  description: '📝 OPTIONAL: Custom tax label',
  example: 'Sales Tax'
},
name: {
  type: 'string',
  description: '📝 OPTIONAL: Customer name',
  example: 'John Doe'
}
```

### 5.3 Add Environment Field to API Keys

```javascript
// Add to addApi
environment: {
  type: 'string',
  enum: ['development', 'production'],
  description: '📝 OPTIONAL: API key environment (defaults to development)',
  default: 'development'
}
```

---

## 6. Response Schema Fixes

### `/api/pay/createPaymentLink` Response

**Current response fields (from code):**
```json
{
  "message": "Payment link created successfully",
  "data": {
    "link_id": 248,
    "transaction_id": "uuid",
    "payment_link": "https://...",
    "base_amount": 10,
    "base_currency": "USD",
    "email": "customer@example.com",
    "allowedModes": "CRYPTO",
    "status": "pending",
    "fee_payer": "customer",
    "apply_tax": true,
    "expires_at": "2026-02-02T18:40:15.834Z",
    "createdAt": "2026-02-01T18:32:35.756Z"
  }
}
```

**Swagger shows different field names** - should be updated to match actual response.

---

## 7. Simple Example Updates

### Minimal Payment Link (Recommended Default)
```json
{
  "amount": 10,
  "email": "customer@example.com"
}
```
*Note: currency defaults to USD, modes defaults to CRYPTO, company_id defaults to first company*

### Standard Payment Link
```json
{
  "amount": 100,
  "currency": "USD",
  "email": "customer@example.com",
  "modes": ["CRYPTO"],
  "description": "Order #12345"
}
```

### Full Payment Link (All Options)
```json
{
  "amount": 100,
  "currency": "EUR",
  "company_id": 38,
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"],
  "description": "Premium Subscription",
  "expire": "24h",
  "fee_payer": "customer",
  "apply_tax": true,
  "redirect_url": "https://mysite.com/success",
  "webhook_url": "https://mysite.com/webhook"
}
```

---

## 8. Summary of Recommendations

### High Priority:
1. ✅ Update `required` array in createPaymentLink to only include `amount`
2. ✅ Add default values for `currency`, `modes`, `company_id`
3. ✅ Add missing `environment` field to API key docs
4. ✅ Update response schemas to match actual responses

### Medium Priority:
1. Add `tax_percentage`, `tax_name`, `name` fields to createPaymentLink docs
2. Update PUT `/api/pay/links/{id}` with all updatable fields
3. Standardize delete endpoint path

### Low Priority:
1. Add more error response examples
2. Add rate limiting documentation
3. Add pagination examples for list endpoints

---

## Appendix: Quick Reference

### Truly Required Fields by Endpoint

| Endpoint | Required Fields |
|----------|----------------|
| `POST /api/pay/createPaymentLink` | `amount` (or `base_amount`) |
| `POST /api/company/addCompany` | `company_name`, `email` |
| `POST /api/user/registerUser` | `name`, `email`, `password` |
| `POST /api/user/login` | `email`, `password` |
| `POST /api/userApi/addApi` | `api_name` |
| `POST /api/pay/getData` | `data` (payment reference) |
| `POST /api/pay/createCryptoPayment` | `transaction_id`, `crypto_currency` |

---

*Report generated by API Documentation Analysis Tool*
