# Payment Link API - Field Name Guide

## Overview

The Payment Link Creation API supports **TWO field naming formats** for backward compatibility. You should use **ONLY ONE** format per request.

---

## ✅ Choose ONE Format

### 💡 Option 1: NEW Format (Recommended)

**Use these field names:**
- `base_amount` - Payment amount
- `base_currency` - Currency code

**Example Request:**
```json
POST /api/pay/createPaymentLink
{
  "base_amount": 100.00,
  "base_currency": "USD",
  "company_id": 1,
  "description": "Order #12345",
  "expire": "24h"
}
```

**Why recommended?**
- Clearer naming convention
- Consistent with other DynoPay APIs
- Better alignment with multi-currency architecture

---

### 🔄 Option 2: LEGACY Format (Backward Compatible)

**Use these field names:**
- `amount` - Payment amount
- `currency` - Currency code

**Example Request:**
```json
POST /api/pay/createPaymentLink
{
  "amount": 100.00,
  "currency": "USD",
  "company_id": 1,
  "description": "Order #12345",
  "expire": "24h"
}
```

**When to use?**
- Existing integrations that already use this format
- No need to update working code
- Smooth migration path

---

## ❌ Don't Mix Formats

**WRONG - Don't do this:**
```json
{
  "amount": 100.00,           // ❌ Don't send both
  "base_amount": 100.00,      // ❌ Redundant
  "currency": "USD",          // ❌ Don't send both
  "base_currency": "USD",     // ❌ Redundant
  "company_id": 1
}
```

**Why not?**
- Redundant and confusing
- Wastes bandwidth
- Risk of conflicting values
- Not necessary for compatibility

---

## Priority Rules (If Both Sent)

If you accidentally send both formats, the API uses this priority:

1. **`base_currency`** takes priority over `currency`
2. **`base_amount`** takes priority over `amount`

**Example:**
```json
{
  "amount": 100,              // ← Ignored
  "base_amount": 200,         // ← Used (priority)
  "currency": "EUR",          // ← Ignored
  "base_currency": "USD",     // ← Used (priority)
  "company_id": 1
}
```
**Result:** Creates a payment link for **$200 USD** (not €100 EUR)

---

## Complete Field Reference

### Required Fields (Choose ONE amount/currency combination)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `company_id` | integer | ✅ Yes | Your company ID |
| `base_amount` OR `amount` | number | ✅ Yes | Payment amount |
| `base_currency` OR `currency` | string | ✅ Yes | Currency code |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `email` | string | null | Customer email for notifications |
| `modes` | array | `["crypto", "card"]` | Allowed payment methods |
| `description` | string | null | Payment description |
| `expire` | string | `"No"` | Expiration: `"24h"`, `"7d"`, `"30d"`, `"No"` |
| `callback_url` | string | null | URL called after payment |
| `redirect_url` | string | null | URL for customer redirect |
| `webhook_url` | string | null | URL for webhook notifications |
| `fee_payer` | string | `"company"` | Who pays fees: `"customer"` or `"company"` |

---

## Supported Currencies

- **Fiat**: `USD`, `EUR`, `GBP`, `NGN`
- **Crypto**: `BTC`, `ETH`

---

## Example Use Cases

### 1️⃣ Simple E-commerce Payment
```json
POST /api/pay/createPaymentLink
{
  "base_amount": 49.99,
  "base_currency": "USD",
  "company_id": 1,
  "description": "T-shirt Order #789"
}
```

### 2️⃣ Invoice Payment with Callback
```json
POST /api/pay/createPaymentLink
{
  "amount": 1500.00,
  "currency": "EUR",
  "company_id": 1,
  "description": "Invoice #INV-2024-001",
  "expire": "7d",
  "callback_url": "https://myapp.com/invoice/paid",
  "email": "client@company.com"
}
```

### 3️⃣ Crypto-Only Payment
```json
POST /api/pay/createPaymentLink
{
  "base_amount": 0.005,
  "base_currency": "BTC",
  "company_id": 1,
  "modes": ["crypto"],
  "description": "Bitcoin Donation",
  "expire": "30d"
}
```

### 4️⃣ Subscription with Webhook
```json
POST /api/pay/createPaymentLink
{
  "base_amount": 29.99,
  "base_currency": "USD",
  "company_id": 1,
  "description": "Monthly Subscription - Pro Plan",
  "webhook_url": "https://myapp.com/webhooks/subscription",
  "redirect_url": "https://myapp.com/thank-you"
}
```

---

## Validation Rules

The API validates your request and returns clear error messages:

### Missing Amount
```json
Response: 400 Bad Request
{
  "message": "Amount is required"
}
```

### Missing Currency (with no default)
```json
Response: 400 Bad Request
{
  "message": "Currency is required"
}
```
**Note:** If only amount is provided, currency defaults to `USD`

### Invalid Company ID
```json
Response: 400 Bad Request
{
  "message": "Invalid company_id or company does not belong to this user"
}
```

---

## Migration Guide

### If You're Using Legacy Format:

**Current code (works fine):**
```javascript
const response = await fetch('/api/pay/createPaymentLink', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    amount: 100,
    currency: 'USD',
    company_id: 1
  })
});
```

**No changes needed!** This will continue to work indefinitely.

### If You Want to Migrate to New Format:

**Simply rename the fields:**
```javascript
const response = await fetch('/api/pay/createPaymentLink', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    base_amount: 100,        // Changed from 'amount'
    base_currency: 'USD',    // Changed from 'currency'
    company_id: 1
  })
});
```

---

## FAQs

### Q: Do I need to send both field formats?
**A:** No! Send **ONLY ONE** format. The API accepts either format.

### Q: What happens if I send both?
**A:** The new format (`base_amount`, `base_currency`) takes priority. But don't do this - it's unnecessary.

### Q: Will the legacy format be deprecated?
**A:** No immediate plans. Both formats are fully supported for the foreseeable future.

### Q: Which format should new integrations use?
**A:** Use the **NEW format** (`base_amount`, `base_currency`) - it's clearer and recommended.

### Q: Can I mix formats (amount + base_currency)?
**A:** Technically yes, but **don't**. It's confusing and not recommended. Pick one format and stick to it.

### Q: What if I don't provide currency at all?
**A:** The API defaults to `USD` if no currency is specified.

---

## Testing Recommendations

### Test with NEW format:
```bash
curl -X POST https://api.dynopay.com/api/pay/createPaymentLink \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "base_amount": 100,
    "base_currency": "USD",
    "company_id": 1
  }'
```

### Test with LEGACY format:
```bash
curl -X POST https://api.dynopay.com/api/pay/createPaymentLink \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD",
    "company_id": 1
  }'
```

Both should work identically!

---

## Summary

✅ **Choose ONE field format** (new OR legacy)  
✅ **Both formats work equally well**  
✅ **No need to change existing integrations**  
✅ **New integrations should use new format**  
❌ **Don't send both formats in same request**

Need help? Check the Swagger documentation at `/api/docs` or contact support.
