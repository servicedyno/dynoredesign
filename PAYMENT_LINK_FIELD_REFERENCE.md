# Payment Link API - Complete Field Reference & Validation Rules

## Date: 2025-01-25
## Version: 2.0 (Updated with improved validation)

---

## Overview

The Payment Link Creation API (`POST /api/pay/createPaymentLink`) accepts flexible field naming for backward compatibility while enforcing clear validation rules.

---

## Required Fields

### ✅ Must Provide:

1. **Amount Field** (choose one):
   - `amount`: Recommended for most use cases
   - `base_amount`: Alternative (works identically)
   - **Validation**: Must be > 0
   - **Error if missing**: "Amount is required. Please provide either 'amount' or 'base_amount' field."

2. **Currency Field** (choose one):
   - `currency`: Recommended for most use cases
   - `base_currency`: Alternative (works identically)
   - **Validation**: Must be one of: USD, EUR, NGN, GBP, BTC, ETH
   - **Error if missing**: "Currency is required. Please provide either 'currency' or 'base_currency' field."

3. **Company ID**:
   - `company_id`: Integer
   - **Validation**: Must exist and belong to authenticated user
   - **Error if invalid**: "Invalid company_id or company does not belong to this user"

4. **Email**:
   - `email`: String (email format)
   - **Validation**: Must contain '@' symbol
   - **Error if invalid**: "Invalid email format. Please provide a valid email address."

5. **Payment Modes**:
   - `modes`: Array of strings
   - **Validation**: Must be UPPERCASE and from valid list
   - **Valid modes**: 
     * `CRYPTO` - Cryptocurrency payments
     * `CARD` - Credit/debit card payments
     * `BANK_TRANSFER` - Bank transfer
     * `GOOGLE_PAY` - Google Pay
     * `APPLE_PAY` - Apple Pay
     * `USSD` - USSD payments
     * `MOBILE_MONEY` - Mobile money
     * `QR_CODE` - QR code payments
   - **Error if invalid**: "Invalid payment modes: [mode]. Valid modes are: CRYPTO, CARD, BANK_TRANSFER, GOOGLE_PAY, APPLE_PAY, USSD, MOBILE_MONEY, QR_CODE"

---

## Optional Fields

| Field | Type | Default | Validation |
|-------|------|---------|------------|
| `description` | string | null | Any text |
| `expire` | string | "No" | Must be: "24h", "7d", "30d", or "No" |
| `callback_url` | string (URL) | null | Valid URL format |
| `redirect_url` | string (URL) | null | Valid URL format |
| `webhook_url` | string (URL) | null | Valid URL format |
| `fee_payer` | string | "company" | Must be: "customer" or "company" |

---

## Field Naming Flexibility

### Both Naming Conventions Work:

**Standard Format** (Recommended):
```json
{
  "amount": 100.00,
  "currency": "USD"
}
```

**Alternative Format**:
```json
{
  "base_amount": 100.00,
  "base_currency": "USD"
}
```

### Priority Rules:

If both formats are provided (not recommended), the API prioritizes:
1. `base_amount` over `amount`
2. `base_currency` over `currency`

**Example**:
```json
{
  "amount": 50,
  "base_amount": 100,  // This wins
  "currency": "EUR",
  "base_currency": "USD"  // This wins
}
```
Result: Uses 100 USD, not 50 EUR

---

## Validation Rules & Error Messages

### 1. Amount Validation

**Rule**: Must be greater than zero

**Error Message**:
```json
{
  "status": 400,
  "message": "Amount must be greater than zero."
}
```

**Examples**:
```json
// ❌ Invalid
{ "amount": 0 }      → "Amount must be greater than zero."
{ "amount": -100 }   → "Amount must be greater than zero."

// ✅ Valid
{ "amount": 0.01 }   → OK
{ "amount": 100.50 } → OK
```

---

### 2. Currency Validation

**Rule**: Must be from supported list

**Supported Currencies**:
- **Fiat**: USD, EUR, GBP, NGN
- **Crypto**: BTC, ETH

**Error Message**:
```json
{
  "status": 400,
  "message": "Currency is required. Please provide either 'currency' or 'base_currency' field."
}
```

---

### 3. Email Validation

**Rule**: Must contain '@' symbol

**Error Message**:
```json
{
  "status": 400,
  "message": "Invalid email format. Please provide a valid email address."
}
```

**Examples**:
```json
// ❌ Invalid
{ "email": "notanemail" }        → Error
{ "email": "invalid.com" }       → Error

// ✅ Valid
{ "email": "user@example.com" }  → OK
{ "email": "test@test.co" }      → OK
```

---

### 4. Payment Modes Validation

**Rule**: Must be UPPERCASE and from valid list

**Auto-Correction**: API automatically converts lowercase to uppercase

**Error Message**:
```json
{
  "status": 400,
  "message": "Invalid payment modes: invalid_mode. Valid modes are: CRYPTO, CARD, BANK_TRANSFER, GOOGLE_PAY, APPLE_PAY, USSD, MOBILE_MONEY, QR_CODE"
}
```

**Examples**:
```json
// ✅ Valid (UPPERCASE)
{ "modes": ["CRYPTO", "CARD"] }           → OK

// ✅ Valid (auto-converted)
{ "modes": ["crypto", "card"] }           → Converted to ["CRYPTO", "CARD"]

// ❌ Invalid
{ "modes": ["invalid"] }                  → Error
{ "modes": ["CRYPTO", "INVALID_MODE"] }   → Error: invalid_mode
```

---

### 5. Expiration Validation

**Rule**: Must be one of the supported values

**Supported Values**:
- `"24h"` - Expires in 24 hours
- `"7d"` - Expires in 7 days
- `"30d"` - Expires in 30 days
- `"No"` - Never expires (default)

**Error Message**:
```json
{
  "status": 400,
  "message": "Invalid expire value. Valid options are: '24h', '7d', '30d', or 'No'."
}
```

**Examples**:
```json
// ✅ Valid
{ "expire": "24h" }   → OK
{ "expire": "7d" }    → OK
{ "expire": "No" }    → OK
// (not provided)    → Defaults to "No"

// ❌ Invalid
{ "expire": "1h" }    → Error
{ "expire": "never" } → Error
{ "expire": "3d" }    → Error
```

---

## Complete Request Examples

### Minimal Required Fields:
```json
POST /api/pay/createPaymentLink
Headers: 
  Authorization: Bearer {JWT_TOKEN}
  Content-Type: application/json

Body:
{
  "amount": 100.00,
  "currency": "USD",
  "company_id": 1,
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD"]
}

Response: 200 OK
{
  "message": "Payment link created successfully",
  "data": {
    "link_id": "abc123",
    "payment_link": "https://checkout.dynopay.com/pay?d=...",
    "expires_at": null
  }
}
```

---

### Full Example with All Options:
```json
POST /api/pay/createPaymentLink

Body:
{
  "amount": 199.99,
  "currency": "USD",
  "company_id": 1,
  "email": "customer@example.com",
  "modes": ["CRYPTO", "CARD", "GOOGLE_PAY"],
  "description": "Order #12345 - Premium Subscription",
  "expire": "7d",
  "callback_url": "https://myapp.com/api/payment/callback",
  "redirect_url": "https://myapp.com/thank-you",
  "webhook_url": "https://myapp.com/webhooks/payment",
  "fee_payer": "company"
}

Response: 200 OK
{
  "message": "Payment link created successfully",
  "data": {
    "link_id": "xyz789",
    "transaction_id": "uuid-here",
    "payment_link": "https://checkout.dynopay.com/pay?d=...",
    "base_amount": 199.99,
    "base_currency": "USD",
    "description": "Order #12345 - Premium Subscription",
    "expires_at": "2025-02-01T12:00:00Z",
    "allowedModes": "CRYPTO,CARD,GOOGLE_PAY"
  }
}
```

---

### Crypto-Only Payment:
```json
{
  "amount": 0.001,
  "currency": "BTC",
  "company_id": 1,
  "email": "crypto@example.com",
  "modes": ["CRYPTO"],
  "description": "Bitcoin Payment - Invoice #001",
  "expire": "30d",
  "webhook_url": "https://myapp.com/webhooks/btc"
}
```

---

## Error Response Examples

### Missing Amount:
```json
Request:
{
  "currency": "USD",
  "company_id": 1,
  "email": "test@test.com",
  "modes": ["CRYPTO"]
}

Response: 400 Bad Request
{
  "message": "Amount is required. Please provide either 'amount' or 'base_amount' field."
}
```

---

### Invalid Payment Mode:
```json
Request:
{
  "amount": 100,
  "currency": "USD",
  "company_id": 1,
  "email": "test@test.com",
  "modes": ["CRYPTO", "INVALID_MODE"]
}

Response: 400 Bad Request
{
  "message": "Invalid payment modes: INVALID_MODE. Valid modes are: CRYPTO, CARD, BANK_TRANSFER, GOOGLE_PAY, APPLE_PAY, USSD, MOBILE_MONEY, QR_CODE"
}
```

---

### Invalid Email:
```json
Request:
{
  "amount": 100,
  "currency": "USD",
  "company_id": 1,
  "email": "notanemail",
  "modes": ["CRYPTO"]
}

Response: 400 Bad Request
{
  "message": "Invalid email format. Please provide a valid email address."
}
```

---

### Negative Amount:
```json
Request:
{
  "amount": -100,
  "currency": "USD",
  "company_id": 1,
  "email": "test@test.com",
  "modes": ["CRYPTO"]
}

Response: 400 Bad Request
{
  "message": "Amount must be greater than zero."
}
```

---

### Invalid Expiration:
```json
Request:
{
  "amount": 100,
  "currency": "USD",
  "company_id": 1,
  "email": "test@test.com",
  "modes": ["CRYPTO"],
  "expire": "1hour"
}

Response: 400 Bad Request
{
  "message": "Invalid expire value. Valid options are: '24h', '7d', '30d', or 'No'."
}
```

---

## Best Practices

### ✅ DO:
1. Use `amount` and `currency` for standard integrations
2. Always provide payment modes in **UPPERCASE**
3. Validate email format on frontend before sending
4. Use webhook_url for reliable payment status updates
5. Set appropriate expiration based on use case

### ❌ DON'T:
1. Send both `amount` and `base_amount` (confusing, unnecessary)
2. Use lowercase payment modes (works but not recommended)
3. Send zero or negative amounts
4. Omit required fields (email, modes)
5. Use invalid expire values

---

## Migration Guide

### From Old Format:
```json
// Before (if you were using this)
{
  "base_amount": 100,
  "base_currency": "USD"
}

// After (recommended)
{
  "amount": 100,
  "currency": "USD"
}
```

**Note**: Both formats work, but `amount`/`currency` is now the recommended standard.

---

## Testing Checklist

- [ ] Test with minimal required fields
- [ ] Test with all optional fields
- [ ] Test with invalid amount (0, negative)
- [ ] Test with invalid email format
- [ ] Test with invalid payment modes
- [ ] Test with invalid expiration values
- [ ] Test with uppercase modes
- [ ] Test with lowercase modes (auto-correction)
- [ ] Test with both amount & base_amount (priority check)
- [ ] Test with missing required fields

---

## API Endpoint Summary

**Endpoint**: `POST /api/pay/createPaymentLink`  
**Authentication**: Required (JWT Bearer token)  
**Rate Limiting**: Standard API limits apply  
**Timeout**: 30 seconds  
**Documentation**: Available at `/api/docs`

---

## Support

For questions or issues:
1. Check Swagger documentation: `/api/docs`
2. Review this field reference guide
3. Check validation error messages (they're descriptive)
4. Contact support with specific error messages

---

**Document Version**: 2.0  
**Last Updated**: 2025-01-25  
**Status**: Production Ready ✅
