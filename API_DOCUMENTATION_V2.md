# DynoPay API Documentation - Phase 10 & Overpayment Updates

**Version:** 2.0  
**Last Updated:** January 25, 2025  
**Changes:** Phase 10 currency validation, Overpayment indication with base currency support

---

## 📋 TABLE OF CONTENTS

1. [Phase 10: Partial Wallet Configuration](#phase-10-partial-wallet-configuration)
2. [Overpayment Handling](#overpayment-handling)
3. [API Key Base Currency](#api-key-base-currency)
4. [Updated API Endpoints](#updated-api-endpoints)
5. [Response Structure Changes](#response-structure-changes)
6. [Migration Guide](#migration-guide)

---

## 🆕 PHASE 10: PARTIAL WALLET CONFIGURATION

### Overview
Phase 10 enables merchants to create API keys and accept payments with partial wallet configuration (minimum 1 wallet) instead of requiring all cryptocurrencies to be configured.

### Key Features
1. ✅ **Minimum 1 Wallet** - Create API keys with at least 1 configured wallet
2. ✅ **Smart Currency Selection** - Show only available payment options to customers
3. ✅ **Currency Validation** - Prevent payments with unconfigured currencies
4. ✅ **Multi-Company Support** - Company-level wallet isolation

---

## 🔧 NEW ENDPOINT: Get Configured Currencies

### `GET /api/wallet/configured-currencies`

Returns the list of currencies that the merchant has wallets configured for.

**Headers:**
```http
Authorization: Bearer {JWT_TOKEN}
```

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| company_id | integer | No | Filter by company ID |

**Request Example:**
```bash
curl -X GET "https://api.dynopay.com/api/wallet/configured-currencies?company_id=1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (200 OK):**
```json
{
  "status": 200,
  "message": "Configured currencies retrieved successfully",
  "data": {
    "configured_currencies": ["BTC", "ETH", "USDT-TRC20", "USDT-ERC20"],
    "wallet_count": 12,
    "wallets": [
      {
        "currency": "BTC",
        "label": "Main BTC Wallet",
        "address_masked": "1JH5Tn...1Do7"
      },
      {
        "currency": "ETH",
        "label": "Main ETH Wallet",
        "address_masked": "0x9a72...b38f"
      }
    ],
    "skip_selection": false
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| configured_currencies | array | List of available cryptocurrency types |
| wallet_count | integer | Total number of configured wallets |
| wallets | array | Detailed wallet information with masked addresses |
| skip_selection | boolean | `true` if only 1 currency (frontend can auto-select) |

**Use Case:**
- Call this endpoint before showing payment options to customers
- If `skip_selection: true`, automatically select the only available currency
- If `skip_selection: false`, show currency selector with available options

---

## 🚫 UPDATED: Currency Validation

### Behavior Change
**Before Phase 10:**
- Payment requests accepted for any cryptocurrency
- Failures occurred later in the process

**After Phase 10:**
- Payment requests validated against configured wallets
- Immediate 400 error if currency not configured
- Clear error message guides merchant to add wallet

### Error Response (400 Bad Request):
```json
{
  "success": false,
  "status": 400,
  "message": "No wallet address configured for XRP. Please add a XRP wallet first."
}
```

**Example Flow:**
```
1. Merchant has BTC and ETH configured
2. Customer attempts to pay with DOGE
3. API returns 400 error immediately
4. Payment not created (prevents failures)
```

---

## 💰 OVERPAYMENT HANDLING

### Overview
When customers send MORE cryptocurrency than the payment requires, DynoPay now provides detailed overpayment information in the API key's base currency.

### How Overpayment Works

**1. Detection:**
- System compares received amount vs. expected amount
- If received > expected, overpayment detected

**2. Forwarding:**
- **Total amount** (including overpayment) forwarded to merchant
- Fees calculated on total amount
- Threshold logic applied to total amount
- Merchant receives: Total - Fees

**3. Indication:**
- Overpayment amount shown in both crypto and base currency
- Included in API responses
- Uses API key's configured base_currency

---

## 🌍 API KEY BASE CURRENCY

### Overview
Each API key has a `base_currency` field that determines how amounts are reported and displayed.

### Supported Base Currencies
- **USD** (United States Dollar) - Default
- **EUR** (Euro)
- **GBP** (British Pound)
- **BTC** (Bitcoin)
- **NGN** (Nigerian Naira)
- **And more...**

### Setting Base Currency

**During API Key Creation:**
```bash
POST /api/userApi/addApi
```

**Request Body:**
```json
{
  "api_name": "My Production Key",
  "environment": "production",
  "base_currency": "EUR",
  "company_id": 1
}
```

**Response:**
```json
{
  "status": 200,
  "data": {
    "api_id": 123,
    "api_name": "My Production Key",
    "base_currency": "EUR",
    "api_key": "sk_live_...",
    "environment": "production"
  }
}
```

### How Base Currency is Used

1. **Payment Amounts:** Main transaction amounts converted to base currency
2. **Overpayment Indication:** Overpayment shown in base currency
3. **Reporting:** All financial reports use base currency
4. **Webhooks:** Amounts in webhook notifications use base currency

---

## 📊 UPDATED RESPONSE STRUCTURES

### Payment Completion Response (With Overpayment)

**Scenario:** Customer overpaid by 0.01 BTC ($20 USD)

```json
{
  "status": 200,
  "message": "Transaction successful!",
  "paymentStatus": "complete",
  "resData": {
    "transaction_id": "uuid-123-456-789",
    "status": "successful",
    "amount_paid": "0.06",
    "currency_paid": "BTC",
    "amount_base": "120.00",
    "currency_base": "USD"
  },
  "overpayment": {
    "detected": true,
    "amount_crypto": "0.01",
    "currency_crypto": "BTC",
    "amount_base": 20.00,
    "currency_base": "USD"
  }
}
```

**Overpayment Object Fields:**
| Field | Type | Description |
|-------|------|-------------|
| detected | boolean | `true` if overpayment occurred |
| amount_crypto | string | Overpayment amount in cryptocurrency |
| currency_crypto | string | Cryptocurrency type (BTC, ETH, etc.) |
| amount_base | number | Overpayment amount in API key's base currency |
| currency_base | string | API key's base currency (USD, EUR, GBP, etc.) |

---

### Overpayment-Specific Response (createPayment pathType)

**When overpayment threshold exceeded (>$5 equivalent):**

```json
{
  "status": 200,
  "paymentStatus": "overpayment",
  "overpayment": {
    "amount_crypto": "0.01",
    "currency_crypto": "BTC",
    "amount_base": 20.00,
    "currency_base": "USD"
  },
  "message": "Overpayment detected! 0.01 BTC (20 USD)"
}
```

---

## 🔄 EXAMPLES BY BASE CURRENCY

### Example 1: USD API Key

**Setup:**
- API key base_currency: USD
- Payment for: $100
- Customer sends: $120 worth of BTC

**Response:**
```json
{
  "status": 200,
  "paymentStatus": "complete",
  "overpayment": {
    "detected": true,
    "amount_crypto": "0.01",
    "currency_crypto": "BTC",
    "amount_base": 20.00,
    "currency_base": "USD"
  }
}
```
**Merchant sees:** "$20 USD overpaid"

---

### Example 2: EUR API Key

**Setup:**
- API key base_currency: EUR
- Payment for: €90
- Customer sends: €108 worth of BTC

**Response:**
```json
{
  "status": 200,
  "paymentStatus": "complete",
  "overpayment": {
    "detected": true,
    "amount_crypto": "0.01",
    "currency_crypto": "BTC",
    "amount_base": 18.00,
    "currency_base": "EUR"
  }
}
```
**Merchant sees:** "€18 EUR overpaid"

---

### Example 3: GBP API Key

**Setup:**
- API key base_currency: GBP
- Payment for: £80
- Customer sends: £96 worth of BTC

**Response:**
```json
{
  "status": 200,
  "paymentStatus": "complete",
  "overpayment": {
    "detected": true,
    "amount_crypto": "0.01",
    "currency_crypto": "BTC",
    "amount_base": 16.00,
    "currency_base": "GBP"
  }
}
```
**Merchant sees:** "£16 GBP overpaid"

---

## 🔔 WEBHOOK NOTIFICATIONS (Updated)

### Webhook Payload Changes

Webhook notifications now include overpayment information:

```json
{
  "event": "payment.completed",
  "transaction_id": "uuid-123-456",
  "status": "successful",
  "amount": {
    "expected": "0.05",
    "received": "0.06",
    "currency": "BTC",
    "base_currency": "USD",
    "base_amount": "120.00"
  },
  "overpayment": {
    "detected": true,
    "amount_crypto": "0.01",
    "currency_crypto": "BTC",
    "amount_base": 20.00,
    "currency_base": "USD"
  },
  "timestamp": "2025-01-25T10:30:45.123Z"
}
```

---

## 🚀 MIGRATION GUIDE

### For Existing Integrations

**No Breaking Changes!** All existing integrations continue to work without modification.

**Optional Enhancements:**

1. **Check Configured Currencies Before Payment:**
```javascript
// NEW: Get available currencies
const response = await fetch('/api/wallet/configured-currencies', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const { configured_currencies, skip_selection } = response.data;

// Show only available currencies in your UI
if (skip_selection) {
  // Auto-select the only currency
  selectCurrency(configured_currencies[0]);
} else {
  // Show selector with available currencies
  showCurrencySelector(configured_currencies);
}
```

2. **Handle Overpayment in Responses:**
```javascript
// Check for overpayment in response
if (response.overpayment && response.overpayment.detected) {
  const { amount_base, currency_base } = response.overpayment;
  
  // Show overpayment notification
  notify(`Customer overpaid by ${amount_base} ${currency_base}`);
  
  // Update accounting
  recordOverpayment(amount_base, currency_base);
}
```

3. **Set Base Currency for New API Keys:**
```javascript
// When creating API keys, specify base currency
const apiKey = await createApiKey({
  api_name: "Production Key",
  environment: "production",
  base_currency: "EUR",  // Set your preferred currency
  company_id: 1
});
```

---

## 📋 SUMMARY OF CHANGES

| Feature | Old Behavior | New Behavior |
|---------|--------------|--------------|
| Wallet Requirements | All wallets required | Minimum 1 wallet required |
| Currency Validation | Post-payment validation | Pre-payment validation (400 error) |
| Overpayment Indication | Not clearly indicated | Shown in crypto + base currency |
| Base Currency | Hardcoded USD | Uses API key's base_currency |
| Currency Selection | Show all options | Show only configured options |
| Error Messages | Generic errors | Specific currency guidance |

---

## 🔐 AUTHENTICATION

All endpoints require JWT authentication:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

Get JWT token from login endpoint:
```bash
POST /api/user/login
{
  "email": "user@example.com",
  "password": "password"
}
```

---

## 🌐 BASE URL

```
Production: https://api.dynopay.com
Development: https://dev.dynopay.com
```

---

## 💡 BEST PRACTICES

1. **Check Configured Currencies First**
   - Call `/api/wallet/configured-currencies` before showing payment options
   - Only show currencies the merchant actually supports

2. **Handle Currency Validation Errors**
   - Expect 400 errors for unconfigured currencies
   - Show clear messages guiding users to add wallets

3. **Monitor Overpayments**
   - Check `overpayment.detected` in responses
   - Alert merchants to significant overpayments
   - Use `currency_base` for proper accounting

4. **Use Appropriate Base Currency**
   - Set `base_currency` matching your business location
   - EUR for European merchants
   - GBP for UK merchants
   - USD for US merchants

5. **Update Your UI**
   - Hide unsupported payment methods
   - Show overpayment notifications
   - Display amounts in base currency

---

## 📞 SUPPORT

For questions or issues:
- **Email:** support@dynopay.com
- **Documentation:** https://docs.dynopay.com
- **API Status:** https://status.dynopay.com

---

## 📝 CHANGELOG

### Version 2.0 (January 25, 2025)
- ✅ Added Phase 10: Partial wallet configuration
- ✅ New endpoint: GET /api/wallet/configured-currencies
- ✅ Enhanced currency validation (400 errors)
- ✅ Overpayment indication in API responses
- ✅ Multi-currency base currency support
- ✅ Updated webhook payload with overpayment data
- ✅ Improved error messages

### Version 1.0
- Initial API release
- Basic payment processing
- Cryptocurrency support

---

**API Version:** 2.0  
**Document Version:** 1.0  
**Last Updated:** January 25, 2025  
**Status:** ✅ Production Ready
